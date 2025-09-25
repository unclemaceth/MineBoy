// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IApeBitMintable {
    function mint(address to, uint256 amount) external;
}

/**
 * @title MiningClaimRouter
 * @dev Signature-based router for verifying and processing mining claims
 * @notice Verifies EIP-712 signatures and mints rewards for valid mining claims
 */
contract MiningClaimRouter is AccessControl, EIP712, Pausable {
    using ECDSA for bytes32;
    
    // EIP-712 type hash for Claim struct (V1 - legacy)
    bytes32 private constant CLAIM_TYPEHASH = keccak256(
        "Claim(address wallet,address cartridge,uint256 tokenId,address rewardToken,uint256 rewardAmount,bytes32 workHash,uint64 attempts,bytes32 nonce,uint64 expiry)"
    );
    
    // EIP-712 type hash for ClaimV2 struct (no rewardAmount - derived from tier)
    bytes32 private constant CLAIM_V2_TYPEHASH = keccak256(
        "ClaimV2(address wallet,address cartridge,uint256 tokenId,address rewardToken,bytes32 workHash,uint64 attempts,bytes32 nonce,uint64 expiry)"
    );
    
    // State variables
    address public immutable rewardToken;
    address public signer;
    
    // Reward tier system (0-15 based on first nibble of workHash)
    uint256[16] public rewardPerTier;
    
    // Mappings
    mapping(address => bool) public allowedCartridge;
    mapping(bytes32 => bool) public nonceUsed;
    
    // Events
    event Claimed(
        address indexed wallet,
        address indexed cartridge,
        uint256 indexed tokenId,
        uint256 rewardAmount,
        bytes32 workHash,
        uint64 attempts,
        bytes32 nonce
    );
    
    event RewardPaid(
        address indexed wallet,
        bytes32 workHash,
        uint8 tier,
        uint256 amount
    );
    
    event RewardTableUpdated(uint256[16] table);
    event RewardTierUpdated(uint8 indexed tier, uint256 amount);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event CartridgeAllowedUpdated(address indexed cartridge, bool allowed);
    
    // Structs
    struct Claim {
        address wallet;
        address cartridge;
        uint256 tokenId;
        address rewardToken;
        uint256 rewardAmount;
        bytes32 workHash;
        uint64 attempts;
        bytes32 nonce;
        uint64 expiry;
    }
    
    struct ClaimV2 {
        address wallet;
        address cartridge;
        uint256 tokenId;
        address rewardToken;
        bytes32 workHash;
        uint64 attempts;
        bytes32 nonce;
        uint64 expiry;
    }
    
    /**
     * @dev Constructor sets up EIP-712 domain and initial configuration
     * @param _rewardToken Address of the ApeBitToken contract
     * @param _signer Address authorized to sign claims
     * @param admin Address that will have DEFAULT_ADMIN_ROLE
     * @param initialRewardTable Initial reward amounts for tiers 0-15
     */
    constructor(
        address _rewardToken,
        address _signer,
        address admin,
        uint256[16] memory initialRewardTable
    ) EIP712("MinerBoyClaim", "1") {
        rewardToken = _rewardToken;
        signer = _signer;
        rewardPerTier = initialRewardTable;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }
    
    /**
     * @dev Helper function to derive tier from first nibble of workHash
     * @param workHash The work hash to analyze
     * @return tier The tier (0-15) based on first nibble
     */
    function _tierFromHash(bytes32 workHash) internal pure returns (uint8) {
        return uint8(uint256(workHash) >> 252) & 0x0f; // 256-4 = 252
    }
    
    /**
     * @dev Processes a mining claim with signature verification (V1 - legacy)
     * @param claimData The claim data struct
     * @param signature EIP-712 signature from authorized signer
     */
    function claim(Claim calldata claimData, bytes calldata signature) external {
        // Basic validations
        require(block.timestamp <= claimData.expiry, "Claim expired");
        require(msg.sender == claimData.wallet, "Invalid caller");
        require(allowedCartridge[claimData.cartridge], "Cartridge not allowed");
        require(claimData.rewardToken == rewardToken, "Invalid reward token");
        require(!nonceUsed[claimData.nonce], "Nonce already used");
        
        // Verify cartridge ownership
        require(
            IERC721(claimData.cartridge).ownerOf(claimData.tokenId) == msg.sender,
            "Not cartridge owner"
        );
        
        // Verify EIP-712 signature
        bytes32 structHash = keccak256(abi.encode(
            CLAIM_TYPEHASH,
            claimData.wallet,
            claimData.cartridge,
            claimData.tokenId,
            claimData.rewardToken,
            claimData.rewardAmount,
            claimData.workHash,
            claimData.attempts,
            claimData.nonce,
            claimData.expiry
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address recoveredSigner = hash.recover(signature);
        require(recoveredSigner == signer, "Invalid signature");
        
        // Mark nonce as used
        nonceUsed[claimData.nonce] = true;
        
        // Mint reward tokens
        IApeBitMintable(rewardToken).mint(claimData.wallet, claimData.rewardAmount);
        
        // Emit event
        emit Claimed(
            claimData.wallet,
            claimData.cartridge,
            claimData.tokenId,
            claimData.rewardAmount,
            claimData.workHash,
            claimData.attempts,
            claimData.nonce
        );
    }
    
    /**
     * @dev Processes a mining claim with dynamic tier-based rewards (V2)
     * @param claimData The claim data struct (without rewardAmount)
     * @param signature EIP-712 signature from authorized signer
     */
    function claimV2(ClaimV2 calldata claimData, bytes calldata signature) external whenNotPaused {
        // Basic validations
        require(block.timestamp <= claimData.expiry, "Claim expired");
        require(msg.sender == claimData.wallet, "Invalid caller");
        require(allowedCartridge[claimData.cartridge], "Cartridge not allowed");
        require(claimData.rewardToken == rewardToken, "Invalid reward token");
        require(!nonceUsed[claimData.nonce], "Nonce already used");
        
        // Verify cartridge ownership
        require(
            IERC721(claimData.cartridge).ownerOf(claimData.tokenId) == msg.sender,
            "Not cartridge owner"
        );
        
        // Verify EIP-712 signature (no rewardAmount in struct)
        bytes32 structHash = keccak256(abi.encode(
            CLAIM_V2_TYPEHASH,
            claimData.wallet,
            claimData.cartridge,
            claimData.tokenId,
            claimData.rewardToken,
            claimData.workHash,
            claimData.attempts,
            claimData.nonce,
            claimData.expiry
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address recoveredSigner = hash.recover(signature);
        require(recoveredSigner == signer, "Invalid signature");
        
        // Mark nonce as used
        nonceUsed[claimData.nonce] = true;
        
        // Derive tier and amount from workHash
        uint8 tier = _tierFromHash(claimData.workHash);
        uint256 amount = rewardPerTier[tier];
        require(amount > 0, "Tier disabled");
        
        // Mint reward tokens
        IApeBitMintable(rewardToken).mint(claimData.wallet, amount);
        
        // Emit events
        emit Claimed(
            claimData.wallet,
            claimData.cartridge,
            claimData.tokenId,
            amount,
            claimData.workHash,
            claimData.attempts,
            claimData.nonce
        );
        
        emit RewardPaid(claimData.wallet, claimData.workHash, tier, amount);
    }
    
    /**
     * @dev Updates the authorized signer address
     * @param newSigner New signer address
     */
    function setSigner(address newSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newSigner != address(0), "Invalid signer");
        address oldSigner = signer;
        signer = newSigner;
        emit SignerUpdated(oldSigner, newSigner);
    }
    
    /**
     * @dev Updates cartridge allowlist status
     * @param cartridge Cartridge contract address
     * @param allowed Whether the cartridge is allowed
     */
    function setCartridgeAllowed(address cartridge, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allowedCartridge[cartridge] = allowed;
        emit CartridgeAllowedUpdated(cartridge, allowed);
    }
    
    /**
     * @dev Updates the entire reward table
     * @param table New reward amounts for all tiers (0-15)
     */
    function setRewardTable(uint256[16] calldata table) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardPerTier = table;
        emit RewardTableUpdated(table);
    }
    
    /**
     * @dev Updates a single reward tier
     * @param tier The tier to update (0-15)
     * @param amount The new reward amount for this tier
     */
    function setRewardPerTier(uint8 tier, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tier < 16, "Invalid tier");
        rewardPerTier[tier] = amount;
        emit RewardTierUpdated(tier, amount);
    }
    
    /**
     * @dev Pauses claim processing (emergency stop)
     */
    function pauseClaims() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpauses claim processing
     */
    function unpauseClaims() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Returns the EIP-712 domain separator
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
    
    /**
     * @dev Returns the claim type hash (V1)
     */
    function getClaimTypeHash() external pure returns (bytes32) {
        return CLAIM_TYPEHASH;
    }
    
    /**
     * @dev Returns the claimV2 type hash
     */
    function getClaimV2TypeHash() external pure returns (bytes32) {
        return CLAIM_V2_TYPEHASH;
    }
}
