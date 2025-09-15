// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/ApeBitToken.sol";
import "../src/MiningClaimRouter.sol";
import "../src/ApeBitCartridge.sol";

/**
 * @title Deploy
 * @dev Deployment script for MinerBoy v2 contracts
 */
contract Deploy is Script {
    // Deployment configuration
    address constant ADMIN = 0x909102DbF4A1bC248BC5F9eedaD589e7552Ad164; // Your wallet address
    address constant BACKEND_SIGNER = 0x909102DbF4A1bC248BC5F9eedaD589e7552Ad164; // Backend signer
    
    // Cartridge configuration
    uint256 constant CARTRIDGE_MAX_SUPPLY = 10000;
    uint256 constant CARTRIDGE_MINT_PRICE = 0.01 ether; // 0.01 APE
    string constant CARTRIDGE_BASE_URI = "https://api.minerboy.io/cartridge/metadata/";
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying MinerBoy v2 contracts...");
        console.log("Admin address:", ADMIN);
        console.log("Backend signer:", BACKEND_SIGNER);
        
        // 1. Deploy ApeBitToken
        console.log("\n1. Deploying ApeBitToken...");
        ApeBitToken token = new ApeBitToken(ADMIN);
        console.log("ApeBitToken deployed at:", address(token));
        
        // 2. Deploy MiningClaimRouter
        console.log("\n2. Deploying MiningClaimRouter...");
        MiningClaimRouter router = new MiningClaimRouter(
            address(token),
            BACKEND_SIGNER,
            ADMIN
        );
        console.log("MiningClaimRouter deployed at:", address(router));
        
        // 3. Grant MINTER_ROLE to router
        console.log("\n3. Granting MINTER_ROLE to router...");
        token.grantRole(token.MINTER_ROLE(), address(router));
        console.log("MINTER_ROLE granted to router");
        
        // 4. Deploy ApeBitCartridge
        console.log("\n4. Deploying ApeBitCartridge...");
        ApeBitCartridge cartridge = new ApeBitCartridge(
            ADMIN,
            CARTRIDGE_MAX_SUPPLY,
            CARTRIDGE_MINT_PRICE,
            CARTRIDGE_BASE_URI
        );
        console.log("ApeBitCartridge deployed at:", address(cartridge));
        
        // 5. Allow cartridge in router
        console.log("\n5. Allowing cartridge in router...");
        router.setCartridgeAllowed(address(cartridge), true);
        console.log("Cartridge allowed in router");
        
        // 6. Mint a test cartridge to admin
        console.log("\n6. Minting test cartridge to admin...");
        cartridge.adminMint(ADMIN, 1);
        console.log("Test cartridge minted to admin");
        
        vm.stopBroadcast();
        
        // Print deployment summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Curtis Testnet (Chain ID: 33111)");
        console.log("ApeBitToken:", address(token));
        console.log("MiningClaimRouter:", address(router));
        console.log("ApeBitCartridge:", address(cartridge));
        console.log("Admin:", ADMIN);
        console.log("Backend Signer:", BACKEND_SIGNER);
        
        console.log("\n=== ENVIRONMENT VARIABLES ===");
        console.log("REWARD_TOKEN_ADDRESS=", address(token));
        console.log("ROUTER_ADDRESS=", address(router));
        console.log("CARTRIDGE_ADDRESS=", address(cartridge));
        console.log("ADMIN_ADDRESS=", ADMIN);
        console.log("BACKEND_SIGNER=", BACKEND_SIGNER);
        
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Update backend .env with the addresses above");
        console.log("2. Update frontend wagmi config with contract addresses");
        console.log("3. Test mining flow end-to-end");
        console.log("4. Set up metadata server for cartridge URIs");
    }
}
