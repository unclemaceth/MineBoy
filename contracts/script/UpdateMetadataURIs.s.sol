// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/ApeBitCartridge.sol";

/**
 * @title UpdateMetadataURIs
 * @dev Script to update the base URI and animation URI to use HTTP gateway URLs
 * @notice This makes the NFT images visible on marketplaces like Magic Eden
 */
contract UpdateMetadataURIs is Script {
    function run() external {
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        address cartridgeAddress = 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d; // ApeChain Cartridge Address
        ApeBitCartridge cartridge = ApeBitCartridge(cartridgeAddress);

        console.log("=== Updating Metadata URIs ===");
        console.log("Cartridge Address:", cartridgeAddress);
        console.log("Deployer:", deployer);

        // Start broadcasting transactions
        vm.startBroadcast();

        // Update base URI to use HTTP gateway for images
        string memory newBaseURI = "https://ipfs.io/ipfs/bafybeifkrfrbqvmwgffgwugrd2mznhnhkkeynmxrdt3c3gwalpwbxvq3zi/";
        console.log("Setting base URI to:", newBaseURI);
        cartridge.setBaseURI(newBaseURI);

        // Update animation URI to use HTTP gateway
        string memory newAnimationURI = "https://ipfs.io/ipfs/bafybeialpduggxyd6gdh47pfhkmb5v74f2k4sznwkqbpgdkxcfwgb6c7ti";
        console.log("Setting animation URI to:", newAnimationURI);
        cartridge.setAnimationURI(newAnimationURI);

        vm.stopBroadcast();

        console.log("=== Metadata URIs Updated Successfully ===");
        console.log("Base URI set to:", newBaseURI);
        console.log("Animation URI set to:", newAnimationURI);
    }
}
