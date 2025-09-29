// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/ApeBitToken.sol";
import "../src/MiningClaimRouter.sol";
import "../src/ApeBitCartridge.sol";

contract VerifyDeployment is Script {
    function run() external {
        console.log("=== Verifying Deployment ===");
        
        // Contract addresses from deployment
        address tokenAddress = 0x5f942B20B8aA905B8F6a46Ae226E7F6bF2F44023;
        address routerAddress = 0x28D5204852D1f788157f909Ad5808f460Ddc6f02;
        address cartridgeAddress = 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d;
        
        console.log("Token Address:", tokenAddress);
        console.log("Router Address:", routerAddress);
        console.log("Cartridge Address:", cartridgeAddress);
        
        // Test token contract
        console.log("\n--- ApeBitToken ---");
        try ApeBitToken(tokenAddress).name() returns (string memory name) {
            console.log("Token Name:", name);
        } catch {
            console.log("ERROR: Token contract not found");
        }
        
        try ApeBitToken(tokenAddress).symbol() returns (string memory symbol) {
            console.log("Token Symbol:", symbol);
        } catch {
            console.log("ERROR: Token symbol not found");
        }
        
        // Test cartridge contract
        console.log("\n--- ApeBitCartridge ---");
        try ApeBitCartridge(cartridgeAddress).name() returns (string memory name) {
            console.log("Cartridge Name:", name);
        } catch {
            console.log("ERROR: Cartridge contract not found");
        }
        
        try ApeBitCartridge(cartridgeAddress).symbol() returns (string memory symbol) {
            console.log("Cartridge Symbol:", symbol);
        } catch {
            console.log("ERROR: Cartridge symbol not found");
        }
        
        try ApeBitCartridge(cartridgeAddress).maxSupply() returns (uint256 maxSupply) {
            console.log("Max Supply:", maxSupply);
        } catch {
            console.log("ERROR: Max supply not found");
        }
        
        try ApeBitCartridge(cartridgeAddress).maxPerWallet() returns (uint256 maxPerWallet) {
            console.log("Max Per Wallet:", maxPerWallet);
        } catch {
            console.log("ERROR: Max per wallet not found");
        }
        
        // Test router contract
        console.log("\n--- MiningClaimRouter ---");
        try MiningClaimRouter(routerAddress).rewardToken() returns (address rewardToken) {
            console.log("Reward Token:", rewardToken);
            console.log("Matches Token Address:", rewardToken == tokenAddress);
        } catch {
            console.log("ERROR: Router contract not found");
        }
        
        console.log("\n=== Verification Complete ===");
    }
}
