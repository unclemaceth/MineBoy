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
    address constant ADMIN = 0x2f85A7eF3947A257211E04ccEd0EFDed94f76E98; // Deployer wallet address
    address constant BACKEND_SIGNER = 0x2f85A7eF3947A257211E04ccEd0EFDed94f76E98; // Backend signer (same as deployer for now)
    
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
        
        // 2. Prepare reward table (linear 8..128 APEBIT with 18 decimals)
        console.log("\n2. Preparing reward table...");
        uint256[16] memory rewardTable;
        rewardTable[0] = 8 * 10**18;   // 8 APEBIT
        rewardTable[1] = 16 * 10**18;  // 16 APEBIT
        rewardTable[2] = 24 * 10**18;  // 24 APEBIT
        rewardTable[3] = 32 * 10**18;  // 32 APEBIT
        rewardTable[4] = 40 * 10**18;  // 40 APEBIT
        rewardTable[5] = 48 * 10**18;  // 48 APEBIT
        rewardTable[6] = 56 * 10**18;  // 56 APEBIT
        rewardTable[7] = 64 * 10**18;  // 64 APEBIT
        rewardTable[8] = 72 * 10**18;  // 72 APEBIT
        rewardTable[9] = 80 * 10**18;  // 80 APEBIT
        rewardTable[10] = 88 * 10**18; // 88 APEBIT
        rewardTable[11] = 96 * 10**18; // 96 APEBIT
        rewardTable[12] = 104 * 10**18; // 104 APEBIT
        rewardTable[13] = 112 * 10**18; // 112 APEBIT
        rewardTable[14] = 120 * 10**18; // 120 APEBIT
        rewardTable[15] = 128 * 10**18; // 128 APEBIT
        console.log("Reward table prepared: 8-128 APEBIT across 16 tiers");
        
        // 3. Deploy MiningClaimRouter
        console.log("\n3. Deploying MiningClaimRouter...");
        MiningClaimRouter router = new MiningClaimRouter(
            address(token),
            BACKEND_SIGNER,
            ADMIN,
            rewardTable
        );
        console.log("MiningClaimRouter deployed at:", address(router));
        
        // 4. Grant MINTER_ROLE to router
        console.log("\n4. Granting MINTER_ROLE to router...");
        token.grantRole(token.MINTER_ROLE(), address(router));
        console.log("MINTER_ROLE granted to router");
        
        // 5. Deploy ApeBitCartridge
        console.log("\n5. Deploying ApeBitCartridge...");
        ApeBitCartridge cartridge = new ApeBitCartridge(
            ADMIN,
            CARTRIDGE_MAX_SUPPLY,
            CARTRIDGE_MINT_PRICE,
            CARTRIDGE_BASE_URI
        );
        console.log("ApeBitCartridge deployed at:", address(cartridge));
        
        // 6. Allow cartridge in router
        console.log("\n6. Allowing cartridge in router...");
        router.setCartridgeAllowed(address(cartridge), true);
        console.log("Cartridge allowed in router");
        
        // 7. Mint a test cartridge to admin
        console.log("\n7. Minting test cartridge to admin...");
        cartridge.adminMint(ADMIN, 1);
        console.log("Test cartridge minted to admin");
        
        vm.stopBroadcast();
        
        // Print deployment summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: ApeChain Mainnet (Chain ID: 33139)");
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
