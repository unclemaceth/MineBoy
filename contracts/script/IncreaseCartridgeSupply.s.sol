// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ApeBitCartridge.sol";

/**
 * @title IncreaseCartridgeSupply
 * @dev Increase cartridge max supply to 1250
 */
contract IncreaseCartridgeSupply is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Increasing cartridge supply to 1250...");
        
        // Deployed cartridge address
        address cartridgeAddress = 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d;
        ApeBitCartridge cartridge = ApeBitCartridge(cartridgeAddress);
        
        console.log("Cartridge address:", cartridgeAddress);
        console.log("Current max supply:", cartridge.maxSupply());
        console.log("Current total supply:", cartridge.totalSupply());
        
        // Set new max supply
        uint256 newMaxSupply = 1250;
        cartridge.setMaxSupply(newMaxSupply);
        
        console.log("\nMax supply updated to:", newMaxSupply);
        
        // Verify the update
        console.log("Verified new max supply:", cartridge.maxSupply());
        
        vm.stopBroadcast();
        
        console.log("\n=== Supply Update Complete ===");
    }
}

