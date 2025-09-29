// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ApeBitCartridge.sol";

/**
 * @title UpdateCartridgeURIs
 * @dev Script to update ApeBitCartridge contract with IPFS URIs
 */
contract UpdateCartridgeURIs is Script {
    // Contract address (update this with the actual deployed address)
    address constant CARTRIDGE_ADDRESS = 0xE2cD7a8182DdC40F620f570c21f315E37dA2f21C;
    
    // IPFS URIs (update these with your actual IPFS hashes)
    string constant BASE_URI = "ipfs://bafybeifkrfrbqvmwgffgwugrd2mznhnhkkeynmxrdt3c3gwalpwbxvq3zi/"; // PNG images
    string constant ANIMATION_URI = "ipfs://bafybeialpduggxyd6gdh47pfhkmb5v74f2k4sznwkqbpgdkxcfwgb6c7ti"; // Animated MP4
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Updating ApeBitCartridge URIs...");
        console.log("Contract address:", CARTRIDGE_ADDRESS);
        
        // Get the deployed contract
        ApeBitCartridge cartridge = ApeBitCartridge(CARTRIDGE_ADDRESS);
        
        // Update base URI for images
        console.log("\n1. Setting base URI for images...");
        console.log("Base URI:", BASE_URI);
        cartridge.setBaseURI(BASE_URI);
        console.log("Base URI updated");
        
        // Update animation URI
        console.log("\n2. Setting animation URI...");
        console.log("Animation URI:", ANIMATION_URI);
        cartridge.setAnimationURI(ANIMATION_URI);
        console.log("Animation URI updated");
        
        vm.stopBroadcast();
        
        console.log("\n=== UPDATE COMPLETE ===");
        console.log("Base URI set to:", BASE_URI);
        console.log("Animation URI set to:", ANIMATION_URI);
        console.log("\nTest a token URI by calling:");
        console.log("cartridge.tokenURI(1)");
    }
}
