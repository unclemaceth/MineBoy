// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/ApeBitCartridge.sol";

contract CheckMinterRoles is Script {
    function run() external {
        address cartridgeAddress = 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d;
        ApeBitCartridge cartridge = ApeBitCartridge(cartridgeAddress);
        
        console.log("=== Checking MINTER_ROLE Holders ===");
        console.log("Cartridge Address:", cartridgeAddress);
        
        bytes32 minterRole = cartridge.MINTER_ROLE();
        console.log("MINTER_ROLE:", vm.toString(minterRole));
        
        // Check deployer
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        bool deployerHasRole = cartridge.hasRole(minterRole, deployer);
        console.log("Deployer has MINTER_ROLE:", deployerHasRole);
        console.log("Deployer address:", deployer);
        
        // Check router (should have MINTER_ROLE)
        address routerAddress = 0x28D5204852D1f788157f909Ad5808f460Ddc6f02;
        bool routerHasRole = cartridge.hasRole(minterRole, routerAddress);
        console.log("Router has MINTER_ROLE:", routerHasRole);
        console.log("Router address:", routerAddress);
        
        // Check admin role
        bytes32 adminRole = cartridge.DEFAULT_ADMIN_ROLE();
        bool deployerIsAdmin = cartridge.hasRole(adminRole, deployer);
        console.log("Deployer is ADMIN:", deployerIsAdmin);
        
        console.log("\n=== Summary ===");
        console.log("Deployer can mint:", deployerHasRole);
        console.log("Router can mint:", routerHasRole);
        console.log("Deployer is admin:", deployerIsAdmin);
    }
}
