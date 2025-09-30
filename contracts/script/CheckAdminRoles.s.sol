// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/ApeBitCartridge.sol";

/**
 * @title CheckAdminRoles
 * @dev Script to check who has admin roles on the contract
 */
contract CheckAdminRoles is Script {
    function run() external {
        address cartridgeAddress = 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d; // ApeChain Cartridge Address
        ApeBitCartridge cartridge = ApeBitCartridge(cartridgeAddress);

        console.log("=== Checking Admin Roles ===");
        console.log("Cartridge Address:", cartridgeAddress);

        bytes32 adminRole = cartridge.DEFAULT_ADMIN_ROLE();
        console.log("DEFAULT_ADMIN_ROLE:", vm.toString(adminRole));

        // Check if the deployer has admin role
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        console.log("Deployer:", deployer);
        console.log("Deployer has admin role:", cartridge.hasRole(adminRole, deployer));

        // Check some common addresses that might have admin role
        address[] memory commonAdmins = new address[](3);
        commonAdmins[0] = 0x2f85A7eF3947A257211E04ccEd0EFDed94f76E98; // Deployer
        commonAdmins[1] = 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5; // Your wallet
        commonAdmins[2] = 0x909102DbF4A1bC248BC5F9eedaD589e7552Ad164; // Your other wallet
        
        for (uint i = 0; i < commonAdmins.length; i++) {
            console.log("Address:", commonAdmins[i]);
            console.log("Has admin role:", cartridge.hasRole(adminRole, commonAdmins[i]));
        }
    }
}
