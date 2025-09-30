// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MiningClaimRouter.sol";

/**
 * @title DeployRouterOnly
 * @dev Deploy only the MiningClaimRouter with existing token addresses
 */
contract DeployRouterOnly is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying MiningClaimRouter with existing token addresses...");
        console.log("Deployer:", deployer);
        console.log("Network: ApeChain Mainnet (Chain ID: 33139)");
        
        // Use existing deployed addresses
        address existingToken = 0x5f942B20B8aA905B8F6a46Ae226E7F6bF2F44023; // ApeBitToken
        address feeRecipient = 0x2f85A7eF3947A257211E04ccEd0EFDed94f76E98; // Fee recipient
        
        console.log("Using existing ApeBitToken:", existingToken);
        console.log("Using fee recipient:", feeRecipient);
        
        // Deploy MiningClaimRouter with existing token
        console.log("\n=== Deploying MiningClaimRouter ===");
        uint256[16] memory initialRewardTable = [
            uint256(100 ether), uint256(90 ether), uint256(80 ether), uint256(70 ether), 
            uint256(60 ether), uint256(50 ether), uint256(40 ether), uint256(30 ether),
            uint256(20 ether), uint256(15 ether), uint256(10 ether), uint256(8 ether), 
            uint256(6 ether), uint256(4 ether), uint256(2 ether), uint256(1 ether)
        ];
        
        MiningClaimRouter router = new MiningClaimRouter(
            existingToken,  // rewardToken
            feeRecipient,   // feeRecipient  
            feeRecipient,   // admin
            initialRewardTable
        );
        
        console.log("MiningClaimRouter deployed at:", address(router));
        console.log("Reward token set to:", existingToken);
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Complete ===");
        console.log("New Router Address:", address(router));
        console.log("Update backend ROUTER_ADDRESS to:", address(router));
    }
}
