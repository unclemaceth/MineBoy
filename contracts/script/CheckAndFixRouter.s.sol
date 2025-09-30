// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MiningClaimRouter.sol";

/**
 * @title CheckAndFixRouter
 * @dev Check router configuration and fix fee recipient
 */
contract CheckAndFixRouter is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        address routerAddress = 0x9C192037b3EDa88cB4B31Ab1ad2AAD43Df352E43;
        address signerAddress = 0x2f85A7eF3947A257211E04ccEd0EFDed94f76E98;
        address correctFeeRecipient = 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5;
        
        MiningClaimRouter router = MiningClaimRouter(payable(routerAddress));
        
        console.log("=== Router Configuration Check ===");
        console.log("Router address:", routerAddress);
        console.log("Deployer:", deployer);
        
        // Check roles
        bytes32 SIGNER_ROLE = keccak256("SIGNER_ROLE");
        bytes32 DEFAULT_ADMIN_ROLE = 0x00;
        
        bool hasSignerRole = router.hasRole(SIGNER_ROLE, signerAddress);
        bool hasAdminRole = router.hasRole(DEFAULT_ADMIN_ROLE, deployer);
        
        console.log("\n=== Role Check ===");
        console.log("Signer address:", signerAddress);
        console.log("Has SIGNER_ROLE:", hasSignerRole);
        console.log("Deployer has ADMIN_ROLE:", hasAdminRole);
        
        // Check current fee recipient
        address currentFeeRecipient = router.feeRecipient();
        console.log("\n=== Fee Recipient ===");
        console.log("Current fee recipient:", currentFeeRecipient);
        console.log("Correct fee recipient:", correctFeeRecipient);
        console.log("Needs update:", currentFeeRecipient != correctFeeRecipient);
        
        // Check reward token
        address rewardToken = router.rewardToken();
        console.log("\n=== Reward Token ===");
        console.log("Reward token:", rewardToken);
        
        // Check if cartridge is allowed
        address cartridge = 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d;
        bool isAllowed = router.allowedCartridge(cartridge);
        console.log("\n=== Cartridge Check ===");
        console.log("Cartridge:", cartridge);
        console.log("Is allowed:", isAllowed);
        
        // Update fee recipient if needed
        if (currentFeeRecipient != correctFeeRecipient && hasAdminRole) {
            console.log("\n=== Updating Fee Recipient ===");
            vm.startBroadcast(deployerPrivateKey);
            router.setFeeRecipient(correctFeeRecipient);
            vm.stopBroadcast();
            console.log("Fee recipient updated to:", correctFeeRecipient);
        }
        
        console.log("\n=== Check Complete ===");
    }
}
