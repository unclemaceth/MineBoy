// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IApeBitMintable {
    function mint(address to, uint256 amount) external;
}

/**
 * @title MiningClaimRouter
 * @dev Signature-based router for verifying and processing mining claims
 * @notice Verifies EIP-712 signatures and mints rewards for valid mining claims
 */
contract MiningClaimRouter is AccessControl, EIP712 {
    using ECDSA for bytes32;
    
    // EIP-712 type hash for Claim struct
    bytes32 private constant CLAIM_TYPEHASH = keccak256(
        "Claim(address wallet,address cartridge,uint256 tokenId,address rewardToken,uint256 rewardAmount,bytes32 workHash,uint64 attempts,bytes32 nonce,uint64 expiry)"
    );
    
    // State variables
    address public immutable rewardToken;
    address public signer;
    
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
    
    /**
     * @dev Constructor sets up EIP-712 domain and initial configuration
     * @param _rewardToken Address of the ApeBitToken contract
     * @param _signer Address authorized to sign claims
     * @param admin Address that will have DEFAULT_ADMIN_ROLE
     */
    constructor(
        address _rewardToken,
        address _signer,
        address admin
    ) EIP712("MinerBoyClaim", "1") {
        rewardToken = _rewardToken;
        signer = _signer;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }
    
    /**
     * @dev Processes a mining claim with signature verification
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
     * @dev Returns the EIP-712 domain separator
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
    
    /**
     * @dev Returns the claim type hash
     */
    function getClaimTypeHash() external pure returns (bytes32) {
        return CLAIM_TYPEHASH;
    }
}
