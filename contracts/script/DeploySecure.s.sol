// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ApeBitToken.sol";
import "../src/MiningClaimRouter.sol";
import "../src/ApeBitCartridge.sol";

/**
 * @title DeploySecure
 * @dev Deploy all contracts with security features enabled
 */
contract DeploySecure is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying contracts with security features...");
        console.log("Deployer:", deployer);
        console.log("Network: ApeChain Mainnet (Chain ID: 33139)");
        
        // Deploy ApeBitToken
        console.log("\n=== Deploying ApeBitToken ===");
        ApeBitToken token = new ApeBitToken(deployer);
        console.log("ApeBitToken deployed at:", address(token));
        
        // Deploy MiningClaimRouter
        console.log("\n=== Deploying MiningClaimRouter ===");
        uint256[16] memory initialRewardTable = [
            uint256(100 ether), uint256(90 ether), uint256(80 ether), uint256(70 ether), 
            uint256(60 ether), uint256(50 ether), uint256(40 ether), uint256(30 ether),
            uint256(20 ether), uint256(15 ether), uint256(10 ether), uint256(8 ether), 
            uint256(6 ether), uint256(4 ether), uint256(2 ether), uint256(1 ether)
        ];
        MiningClaimRouter router = new MiningClaimRouter(address(token), deployer, deployer, initialRewardTable);
        console.log("MiningClaimRouter deployed at:", address(router));
        
        // Deploy ApeBitCartridge with security features
        console.log("\n=== Deploying ApeBitCartridge ===");
        uint256 maxSupply = 250; // Limited supply
        uint256 mintPrice = 0; // Free minting
        uint256 maxPerWallet = 1; // 1 cartridge per wallet
        string memory baseURI = "ipfs://bafybeifkrfrbqvmwgffgwugrd2mznhnhkkeynmxrdt3c3gwalpwbxvq3zi/";
        
        ApeBitCartridge cartridge = new ApeBitCartridge(
            deployer, // admin
            maxSupply,
            mintPrice,
            maxPerWallet,
            deployer, // royalty recipient (admin)
            500, // 5% royalty (500 basis points)
            baseURI
        );
        console.log("ApeBitCartridge deployed at:", address(cartridge));
        
        // Set animation URI
        string memory animationURI = "ipfs://bafybeialpduggxyd6gdh47pfhkmb5v74f2k4sznwkqbpgdkxcfwgb6c7ti";
        cartridge.setAnimationURI(animationURI);
        console.log("Animation URI set to:", animationURI);
        
        // Grant MINTER_ROLE to router for cartridge minting
        cartridge.grantRole(cartridge.MINTER_ROLE(), address(router));
        console.log("Granted MINTER_ROLE to router");
        
        // Grant MINTER_ROLE to deployer for admin minting
        cartridge.grantRole(cartridge.MINTER_ROLE(), deployer);
        console.log("Granted MINTER_ROLE to deployer");
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Summary ===");
        console.log("Network: ApeChain Mainnet (Chain ID: 33139)");
        console.log("ApeBitToken:", address(token));
        console.log("MiningClaimRouter:", address(router));
        console.log("ApeBitCartridge:", address(cartridge));
        console.log("Max Supply:", maxSupply);
        console.log("Mint Price:", mintPrice, "APE (FREE)");
        console.log("Max Per Wallet:", maxPerWallet);
        console.log("Royalty Recipient:", deployer);
        console.log("Royalty BPS:", 500, "(5%)");
        console.log("Base URI:", baseURI);
        console.log("Animation URI:", animationURI);
        console.log("\nSecurity Features:");
        console.log("- Only MINTER_ROLE can mint cartridges");
        console.log("- Per-wallet limit enforced");
        console.log("- Max supply limit enforced");
        console.log("- Admin can update all limits");
    }
}
