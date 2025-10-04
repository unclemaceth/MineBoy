// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IApeBitMintable {
    function mint(address to, uint256 amount) external;
}

/**
 * @title MiningClaimRouterV3
 * @dev Advanced router with dynamic fees, NFT multipliers, and multi-contract support
 * @notice Features:
 *  - Dynamic fee distribution to multiple recipients
 *  - NFT-based reward multipliers (e.g., NAPC holders get bonus rewards)
 *  - Multi-contract support (cartridges + pickaxes)
 *  - On-chain configuration (no env vars needed)
 */
contract MiningClaimRouterV3 is AccessControl, EIP712, Pausable {
    using ECDSA for bytes32;
    
    // Roles
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    
    // EIP-712 type hash for ClaimV3
    bytes32 private constant CLAIM_V3_TYPEHASH = keccak256(
        "ClaimV3(address cartridge,uint256 tokenId,address wallet,bytes32 nonce,uint256 tier,uint256 tries,uint256 elapsedMs,bytes32 hash,uint256 expiry)"
    );
    
    // State variables
    address public immutable rewardToken;
    
    // Fee system: Dynamic multi-recipient fees
    struct FeeRecipient {
        address recipient;
        uint256 amount; // in wei (e.g., 0.002 ether)
        bool active;
    }
    FeeRecipient[] public feeRecipients;
    
    // Multiplier system: NFT-based reward bonuses
    struct NFTMultiplier {
        address nftContract;
        uint256 minBalance; // Minimum NFTs to hold
        uint256 multiplierBps; // 10000 = 1x, 12000 = 1.2x, 15000 = 1.5x
        bool active;
        string name; // "NAPC", "Partner", etc.
    }
    NFTMultiplier[] public multipliers;
    
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
        uint256 baseReward,
        uint256 finalReward,
        uint256 multiplierBps,
        bytes32 workHash,
        uint256 tries,
        bytes32 nonce
    );
    
    event RewardPaid(
        address indexed wallet,
        bytes32 workHash,
        uint8 tier,
        uint256 baseAmount,
        uint256 finalAmount
    );
    
    event FeesPaid(
        address indexed wallet,
        uint256 totalFee,
        uint256 recipientCount
    );
    
    event FeeRecipientAdded(uint256 indexed index, address recipient, uint256 amount);
    event FeeRecipientUpdated(uint256 indexed index, address recipient, uint256 amount);
    event FeeRecipientActiveToggled(uint256 indexed index, bool active);
    event FeeRecipientRemoved(uint256 indexed index);
    
    event MultiplierAdded(uint256 indexed index, address nftContract, uint256 minBalance, uint256 multiplierBps, string name);
    event MultiplierUpdated(uint256 indexed index, uint256 minBalance, uint256 multiplierBps);
    event MultiplierActiveToggled(uint256 indexed index, bool active);
    event MultiplierRemoved(uint256 indexed index);
    
    event RewardTableUpdated(uint256[16] table);
    event RewardTierUpdated(uint8 indexed tier, uint256 amount);
    event CartridgeAllowedUpdated(address indexed cartridge, bool allowed);
    
    // Structs
    struct ClaimV3 {
        address cartridge;
        uint256 tokenId;
        address wallet;
        bytes32 nonce;
        uint256 tier;
        uint256 tries;
        uint256 elapsedMs;
        bytes32 hash;
        uint256 expiry;
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
    ) EIP712("MiningClaimRouter", "3") {
        rewardToken = _rewardToken;
        rewardPerTier = initialRewardTable;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SIGNER_ROLE, _signer);
    }
    
    /**
     * @dev Helper function to derive tier from first nibble of workHash
     */
    function _tierFromHash(bytes32 workHash) internal pure returns (uint8) {
        return uint8(uint256(workHash) >> 252) & 0x0f;
    }
    
    /**
     * @dev Calculate total mine fee (sum of all active recipients)
     */
    function getTotalMineFee() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < feeRecipients.length; i++) {
            if (feeRecipients[i].active) {
                total += feeRecipients[i].amount;
            }
        }
        return total;
    }
    
    /**
     * @dev Calculate multiplier for a wallet based on NFT holdings
     * @param wallet Address to check NFT balances for
     * @return multiplierBps The multiplier in basis points (10000 = 1x, 12000 = 1.2x)
     * 
     * Logic:
     * - For each NFT contract, apply the HIGHEST multiplier the user qualifies for
     * - Then multiply across different NFT contracts (e.g., 1.2x NAPC * 1.1x Partner = 1.32x total)
     * 
     * Note: For gas efficiency, we use a simplified approach:
     * - We find the highest multiplier the user qualifies for across ALL multipliers
     * - This works well when most users hold NFTs from a single collection
     * - To implement true cross-collection stacking, track unique contracts and multiply their highest values
     */
    function calculateMultiplier(address wallet) public view returns (uint256 multiplierBps) {
        uint256 highestMultiplier = 10000; // Start at 1x (10000 basis points)
        
        // Iterate through all multipliers and find the highest one the user qualifies for
        for (uint256 i = 0; i < multipliers.length; i++) {
            NFTMultiplier memory m = multipliers[i];
            
            if (!m.active) continue;
            
            // Check user's balance for this NFT contract
            uint256 balance = IERC721(m.nftContract).balanceOf(wallet);
            
            // If user qualifies and this multiplier is higher, use it
            if (balance >= m.minBalance && m.multiplierBps > highestMultiplier) {
                highestMultiplier = m.multiplierBps;
            }
        }
        
        return highestMultiplier;
    }
    
    /**
     * @dev Process a mining claim with V3 features (fees + multipliers)
     */
    function claimV3(
        ClaimV3 calldata claimData,
        bytes calldata signature
    ) external payable whenNotPaused {
        // Basic validations
        require(block.timestamp <= claimData.expiry, "Claim expired");
        require(msg.sender == claimData.wallet, "Invalid caller");
        require(allowedCartridge[claimData.cartridge], "Cartridge not allowed");
        require(!nonceUsed[claimData.nonce], "Nonce already used");
        require(msg.value >= getTotalMineFee(), "Insufficient mine fee");
        
        // Verify cartridge ownership
        require(
            IERC721(claimData.cartridge).ownerOf(claimData.tokenId) == msg.sender,
            "Not cartridge owner"
        );
        
        // Verify EIP-712 signature
        {
            bytes32 structHash = keccak256(abi.encode(
                CLAIM_V3_TYPEHASH,
                claimData.cartridge,
                claimData.tokenId,
                claimData.wallet,
                claimData.nonce,
                claimData.tier,
                claimData.tries,
                claimData.elapsedMs,
                claimData.hash,
                claimData.expiry
            ));
            
            bytes32 hash = _hashTypedDataV4(structHash);
            require(hasRole(SIGNER_ROLE, hash.recover(signature)), "Invalid signature");
        }
        
        // Mark nonce as used
        nonceUsed[claimData.nonce] = true;
        
        // Calculate rewards
        require(claimData.tier < 16, "Invalid tier");
        uint256 baseReward = rewardPerTier[claimData.tier];
        require(baseReward > 0, "Tier disabled");
        
        uint256 multiplierBps = calculateMultiplier(claimData.wallet);
        uint256 finalReward = (baseReward * multiplierBps) / 10000;
        
        // Distribute fees
        _distributeFees();
        
        // Mint reward tokens
        IApeBitMintable(rewardToken).mint(claimData.wallet, finalReward);
        
        // Emit events
        emit Claimed(
            claimData.wallet,
            claimData.cartridge,
            claimData.tokenId,
            baseReward,
            finalReward,
            multiplierBps,
            claimData.hash,
            claimData.tries,
            claimData.nonce
        );
        
        emit RewardPaid(
            claimData.wallet,
            claimData.hash,
            uint8(claimData.tier),
            baseReward,
            finalReward
        );
    }
    
    /**
     * @dev Internal function to distribute fees to all active recipients
     */
    function _distributeFees() private {
        uint256 totalFee = 0;
        uint256 recipientCount = 0;
        
        for (uint256 i = 0; i < feeRecipients.length; i++) {
            if (feeRecipients[i].active) {
                (bool success, ) = feeRecipients[i].recipient.call{
                    value: feeRecipients[i].amount,
                    gas: 50000
                }("");
                require(success, "Fee transfer failed");
                totalFee += feeRecipients[i].amount;
                recipientCount++;
            }
        }
        
        emit FeesPaid(msg.sender, totalFee, recipientCount);
    }
    
    // ============= FEE MANAGEMENT =============
    
    function addFeeRecipient(address recipient, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        
        feeRecipients.push(FeeRecipient({
            recipient: recipient,
            amount: amount,
            active: true
        }));
        
        emit FeeRecipientAdded(feeRecipients.length - 1, recipient, amount);
    }
    
    function updateFeeRecipient(
        uint256 index,
        address recipient,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(index < feeRecipients.length, "Invalid index");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        
        feeRecipients[index].recipient = recipient;
        feeRecipients[index].amount = amount;
        
        emit FeeRecipientUpdated(index, recipient, amount);
    }
    
    function setFeeRecipientActive(uint256 index, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(index < feeRecipients.length, "Invalid index");
        feeRecipients[index].active = active;
        emit FeeRecipientActiveToggled(index, active);
    }
    
    function removeFeeRecipient(uint256 index) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(index < feeRecipients.length, "Invalid index");
        
        // Swap with last element and pop
        feeRecipients[index] = feeRecipients[feeRecipients.length - 1];
        feeRecipients.pop();
        
        emit FeeRecipientRemoved(index);
    }
    
    function getFeeRecipientCount() external view returns (uint256) {
        return feeRecipients.length;
    }
    
    // ============= MULTIPLIER MANAGEMENT =============
    
    function addMultiplier(
        address nftContract,
        uint256 minBalance,
        uint256 multiplierBps,
        string calldata name
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(nftContract != address(0), "Invalid NFT contract");
        require(multiplierBps >= 10000, "Multiplier must be >= 1x");
        require(multiplierBps <= 50000, "Multiplier too high (max 5x)");
        
        multipliers.push(NFTMultiplier({
            nftContract: nftContract,
            minBalance: minBalance,
            multiplierBps: multiplierBps,
            active: true,
            name: name
        }));
        
        emit MultiplierAdded(multipliers.length - 1, nftContract, minBalance, multiplierBps, name);
    }
    
    function updateMultiplier(
        uint256 index,
        uint256 minBalance,
        uint256 multiplierBps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(index < multipliers.length, "Invalid index");
        require(multiplierBps >= 10000, "Multiplier must be >= 1x");
        require(multiplierBps <= 50000, "Multiplier too high (max 5x)");
        
        multipliers[index].minBalance = minBalance;
        multipliers[index].multiplierBps = multiplierBps;
        
        emit MultiplierUpdated(index, minBalance, multiplierBps);
    }
    
    function setMultiplierActive(uint256 index, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(index < multipliers.length, "Invalid index");
        multipliers[index].active = active;
        emit MultiplierActiveToggled(index, active);
    }
    
    function removeMultiplier(uint256 index) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(index < multipliers.length, "Invalid index");
        
        // Swap with last element and pop
        multipliers[index] = multipliers[multipliers.length - 1];
        multipliers.pop();
        
        emit MultiplierRemoved(index);
    }
    
    function getMultiplierCount() external view returns (uint256) {
        return multipliers.length;
    }
    
    // ============= EXISTING ADMIN FUNCTIONS =============
    
    function setCartridgeAllowed(address cartridge, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allowedCartridge[cartridge] = allowed;
        emit CartridgeAllowedUpdated(cartridge, allowed);
    }
    
    function setRewardTable(uint256[16] calldata table) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardPerTier = table;
        emit RewardTableUpdated(table);
    }
    
    function setRewardPerTier(uint8 tier, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tier < 16, "Invalid tier");
        rewardPerTier[tier] = amount;
        emit RewardTierUpdated(tier, amount);
    }
    
    function pauseClaims() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpauseClaims() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    function setSigner(address newSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newSigner != address(0), "Invalid signer");
        _grantRole(SIGNER_ROLE, newSigner);
    }
    
    function revokeSigner(address oldSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(SIGNER_ROLE, oldSigner);
    }
    
    function isSigner(address signer) external view returns (bool) {
        return hasRole(SIGNER_ROLE, signer);
    }
    
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
    
    function getClaimV3TypeHash() external pure returns (bytes32) {
        return CLAIM_V3_TYPEHASH;
    }
    
    function getTierFromHash(bytes32 workHash) external pure returns (uint8) {
        return _tierFromHash(workHash);
    }
    
    function withdrawExcessETH() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        require(feeRecipients.length > 0, "No fee recipients");
        
        // Send to first active recipient
        for (uint256 i = 0; i < feeRecipients.length; i++) {
            if (feeRecipients[i].active) {
                (bool success, ) = feeRecipients[i].recipient.call{value: balance}("");
                require(success, "Withdrawal failed");
                return;
            }
        }
        
        revert("No active recipients");
    }
}

