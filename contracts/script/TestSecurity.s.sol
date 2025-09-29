// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/ApeBitCartridge.sol";

contract TestSecurity is Script {
    function run() external {
        // Use the deployed cartridge address
        address cartridgeAddress = 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d;
        ApeBitCartridge cartridge = ApeBitCartridge(cartridgeAddress);
        
        // Test with a random address (not the deployer)
        address testUser = 0x1234567890123456789012345678901234567890;
        
        console.log("=== Testing Contract Security ===");
        console.log("Cartridge Address:", cartridgeAddress);
        console.log("Test User:", testUser);
        
        // Test 1: Try to mint directly (should fail)
        console.log("\n--- Test 1: Direct Mint (Should Fail) ---");
        try cartridge.mint(testUser) {
            console.log("SECURITY BREACH: Direct mint succeeded!");
        } catch Error(string memory reason) {
            console.log("SUCCESS: Direct mint blocked:", reason);
        } catch {
            console.log("SUCCESS: Direct mint blocked (generic error)");
        }
        
        // Test 2: Check MINTER_ROLE
        console.log("\n--- Test 2: Check MINTER_ROLE ---");
        bytes32 minterRole = cartridge.MINTER_ROLE();
        console.log("MINTER_ROLE:", vm.toString(minterRole));
        
        bool hasMinterRole = cartridge.hasRole(minterRole, testUser);
        console.log("Test user has MINTER_ROLE:", hasMinterRole);
        
        // Test 3: Check current supply and limits
        console.log("\n--- Test 3: Supply and Limits ---");
        uint256 totalSupply = cartridge.totalSupply();
        uint256 maxSupply = cartridge.maxSupply();
        uint256 maxPerWallet = cartridge.maxPerWallet();
        
        console.log("Total Supply:", totalSupply);
        console.log("Max Supply:", maxSupply);
        console.log("Max Per Wallet:", maxPerWallet);
        
        // Test 4: Check if deployer can still mint
        console.log("\n--- Test 4: Deployer Mint (Should Work) ---");
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        bool deployerHasRole = cartridge.hasRole(minterRole, deployer);
        console.log("Deployer has MINTER_ROLE:", deployerHasRole);
        
        console.log("\n=== Security Test Complete ===");
    }
}
