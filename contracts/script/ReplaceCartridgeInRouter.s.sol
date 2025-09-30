// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MiningClaimRouter.sol";

contract ReplaceCartridgeInRouterScript is Script {
    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address routerAddress = vm.envAddress("ROUTER_ADDRESS");
        address newCartridgeAddress = vm.envAddress("NEW_CARTRIDGE_ADDRESS");
        address oldCartridgeAddress = vm.envAddress("OLD_CARTRIDGE_ADDRESS");
        
        console.log("Router Address:", routerAddress);
        console.log("Old Cartridge:", oldCartridgeAddress);
        console.log("New Cartridge:", newCartridgeAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Connect to the existing router
        MiningClaimRouter router = MiningClaimRouter(routerAddress);
        
        // Remove old cartridge from allowlist
        console.log("Removing old cartridge from allowlist...");
        router.setCartridgeAllowed(oldCartridgeAddress, false);
        
        // Add new cartridge to allowlist
        console.log("Adding new cartridge to allowlist...");
        router.setCartridgeAllowed(newCartridgeAddress, true);
        
        vm.stopBroadcast();
        
        console.log("Cartridge replacement completed!");
        console.log("Old cartridge allowed:", router.allowedCartridge(oldCartridgeAddress));
        console.log("New cartridge allowed:", router.allowedCartridge(newCartridgeAddress));
    }
}
