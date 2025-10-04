// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/MineStrategyToken.sol";

/**
 * @title DeployMineStrategy
 * @dev Deploys MineStrategy (MNESTR) token
 * 
 * Usage:
 *   forge script script/DeployMineStrategy.s.sol --rpc-url https://rpc.apechain.com --broadcast --legacy
 */
contract DeployMineStrategy is Script {
    function run() external {
        vm.startBroadcast();
        
        // Admin will be the deployer
        address admin = msg.sender;
        
        console.log("================================================");
        console.log("Deploying MineStrategy Token (MNESTR)");
        console.log("================================================");
        console.log("Network: ApeChain Mainnet");
        console.log("Admin:", admin);
        console.log("Max Supply: 1,000,000,000 MNESTR");
        console.log("");
        
        MineStrategyToken token = new MineStrategyToken(admin);
        
        vm.stopBroadcast();
        
        console.log("================================================");
        console.log("DEPLOYMENT SUCCESSFUL");
        console.log("================================================");
        console.log("MineStrategy Token:", address(token));
        console.log("Symbol: MNESTR");
        console.log("Decimals: 18");
        console.log("Max Supply: 1,000,000,000");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Grant MINTER_ROLE to V3 Router after deploying it:");
        console.log("   cast send", address(token), "\"grantRole(bytes32,address)\" $(cast keccak \"MINTER_ROLE()\") <ROUTER_ADDRESS> --private-key <ADMIN_KEY> --rpc-url https://rpc.apechain.com");
        console.log("");
        console.log("2. Verify MINTER_ROLE:");
        console.log("   cast call", address(token), "\"hasRole(bytes32,address)(bool)\" $(cast keccak \"MINTER_ROLE()\") <ROUTER_ADDRESS> --rpc-url https://rpc.apechain.com");
        console.log("");
        console.log("================================================");
    }
}

