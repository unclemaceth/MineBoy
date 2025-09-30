// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MiningClaimRouter.sol";

contract AddCartridgeToRouter is Script {
    function run() external {
        // Get the router address from environment variable
        address routerAddress = vm.envAddress("ROUTER_ADDRESS");
        
        // Get the new cartridge address
        address cartridgeAddress = 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d;
        
        console.log("Router address:", routerAddress);
        console.log("Cartridge address:", cartridgeAddress);
        
        // Get the private key for the admin
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Create router instance
        MiningClaimRouter router = MiningClaimRouter(routerAddress);
        
        // Add the cartridge to the allowlist
        router.setCartridgeAllowed(cartridgeAddress, true);
        
        console.log("Cartridge added to router allowlist");
        
        // Verify it was added
        bool isAllowed = router.allowedCartridge(cartridgeAddress);
        console.log("Cartridge is now allowed:", isAllowed);
        
        vm.stopBroadcast();
    }
}
