// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MiningClaimRouter.sol";

/**
 * @title TestClaim
 * @dev Test a claim to see which require statement fails
 */
contract TestClaim is Script {
    function run() external view {
        address routerAddress = 0x9C192037b3EDa88cB4B31Ab1ad2AAD43Df352E43;
        MiningClaimRouter router = MiningClaimRouter(payable(routerAddress));
        
        // Test data from the logs
        address wallet = 0x909102DbF4A1bC248BC5F9eedaD589e7552Ad164;
        address cartridge = 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d;
        uint256 tokenId = 1;
        address rewardToken = 0x5f942B20B8aA905B8F6a46Ae226E7F6bF2F44023;
        bytes32 workHash = 0x626493e02d6b0aa8d700f7676da20e516068a96fd81042e6ce48003d3b200000;
        uint64 attempts = 4005457;
        bytes32 nonce = 0xdb1851650dd0e70380935a2ed5f43bd5e88fc434cda2f58e3ae9dbc831cb56c5;
        uint64 expiry = 1759275934;
        
        console.log("=== Testing Claim Validation ===");
        console.log("Router:", routerAddress);
        console.log("Wallet:", wallet);
        
        // Check 1: Expiry
        console.log("\n[1] Checking expiry...");
        console.log("Block timestamp:", block.timestamp);
        console.log("Claim expiry:", expiry);
        console.log("Is expired:", block.timestamp > expiry);
        
        // Check 2: Cartridge allowed
        console.log("\n[2] Checking cartridge allowed...");
        bool isAllowed = router.allowedCartridge(cartridge);
        console.log("Cartridge:", cartridge);
        console.log("Is allowed:", isAllowed);
        
        // Check 3: Reward token
        console.log("\n[3] Checking reward token...");
        address routerRewardToken = router.rewardToken();
        console.log("Expected reward token:", routerRewardToken);
        console.log("Claim reward token:", rewardToken);
        console.log("Matches:", rewardToken == routerRewardToken);
        
        // Check 4: Nonce used
        console.log("\n[4] Checking nonce...");
        bool isNonceUsed = router.nonceUsed(nonce);
        console.log("Nonce:", vm.toString(nonce));
        console.log("Already used:", isNonceUsed);
        
        // Check 5: Cartridge ownership
        console.log("\n[5] Checking cartridge ownership...");
        try IERC721(cartridge).ownerOf(tokenId) returns (address owner) {
            console.log("Cartridge owner:", owner);
            console.log("Claim wallet:", wallet);
            console.log("Matches:", owner == wallet);
        } catch {
            console.log("ERROR: Could not get cartridge owner");
        }
        
        // Check 6: Signer role
        console.log("\n[6] Checking signer role...");
        address signerAddress = 0x2f85A7eF3947A257211E04ccEd0EFDed94f76E98;
        bytes32 SIGNER_ROLE = keccak256("SIGNER_ROLE");
        bool hasSignerRole = router.hasRole(SIGNER_ROLE, signerAddress);
        console.log("Signer:", signerAddress);
        console.log("Has SIGNER_ROLE:", hasSignerRole);
        
        // Check 7: Tier and reward
        console.log("\n[7] Checking tier and reward...");
        uint8 tier = router.getTierFromHash(workHash);
        uint256 rewardAmount = router.rewardPerTier(tier);
        console.log("Tier:", tier);
        console.log("Reward amount:", rewardAmount);
        console.log("Is tier disabled:", rewardAmount == 0);
        
        console.log("\n=== Test Complete ===");
    }
}
