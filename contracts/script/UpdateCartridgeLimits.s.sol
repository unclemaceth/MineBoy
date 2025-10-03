// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ApeBitCartridge.sol";

/**
 * @title UpdateCartridgeLimits
 * @dev Update maxSupply to 750 and maxPerWallet to 2
 */
contract UpdateCartridgeLimits is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address cartridgeAddress = vm.envAddress("CARTRIDGE_ADDRESS");
        
        vm.startBroadcast(deployerPrivateKey);
        
        ApeBitCartridge cartridge = ApeBitCartridge(cartridgeAddress);
        
        console.log("Updating ApeBitCartridge limits...");
        console.log("Contract:", cartridgeAddress);
        console.log("Current maxSupply:", cartridge.maxSupply());
        console.log("Current maxPerWallet:", cartridge.maxPerWallet());
        
        // Update max supply to 1250
        cartridge.setMaxSupply(1250);
        console.log("Updated maxSupply to: 1250");
        
        // Update max per wallet to 2
        cartridge.setMaxPerWallet(2);
        console.log("Updated maxPerWallet to: 2");
        
        vm.stopBroadcast();
        
        console.log("\n=== Update Complete ===");
        console.log("New maxSupply:", cartridge.maxSupply());
        console.log("New maxPerWallet:", cartridge.maxPerWallet());
    }
}

