// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";

interface IAccessControl {
    function grantRole(bytes32 role, address account) external;
    function hasRole(bytes32 role, address account) external view returns (bool);
}

/**
 * @title GrantMinterRole
 * @dev Grant MINTER_ROLE to the new router on ApeBitToken
 */
contract GrantMinterRole is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        address tokenAddress = 0x5f942B20B8aA905B8F6a46Ae226E7F6bF2F44023;
        address routerAddress = 0x9C192037b3EDa88cB4B31Ab1ad2AAD43Df352E43;
        
        IAccessControl token = IAccessControl(tokenAddress);
        bytes32 MINTER_ROLE = keccak256("MINTER_ROLE");
        
        console.log("=== Granting MINTER_ROLE ===");
        console.log("Token:", tokenAddress);
        console.log("Router:", routerAddress);
        console.log("Deployer:", deployer);
        
        // Check current status
        bool hasMinterRole = token.hasRole(MINTER_ROLE, routerAddress);
        console.log("\nRouter has MINTER_ROLE before:", hasMinterRole);
        
        if (!hasMinterRole) {
            console.log("\nGranting MINTER_ROLE to router...");
            vm.startBroadcast(deployerPrivateKey);
            token.grantRole(MINTER_ROLE, routerAddress);
            vm.stopBroadcast();
            
            // Verify
            hasMinterRole = token.hasRole(MINTER_ROLE, routerAddress);
            console.log("Router has MINTER_ROLE after:", hasMinterRole);
            console.log("\n=== MINTER_ROLE Granted Successfully! ===");
        } else {
            console.log("\n=== Router already has MINTER_ROLE ===");
        }
    }
}
