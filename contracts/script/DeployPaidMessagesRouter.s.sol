// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PaidMessagesRouter} from "../src/PaidMessagesRouter.sol";

contract DeployPaidMessagesRouter is Script {
    function run() external {
        // ApeChain mainnet configuration
        address admin = 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5; // Team wallet is also admin
        uint256 price = 1 ether; // 1 APE
        
        // Fee recipients (same as MiningClaimRouterV3)
        address payable teamWallet = payable(0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5);
        address payable flywheelWallet = payable(0x0B4A0B2F8C59F8E3F8F3F8F3F8F3F8F3F8F3F8F3); // TODO: Set real flywheel wallet
        address payable lpWallet = payable(0x0C5A0C2F8C59F8E3F8F3F8F3F8F3F8F3F8F3F8F3); // TODO: Set real LP wallet
        
        // Fee splits (basis points, 10000 = 100%)
        // Example: 50% team, 30% flywheel, 20% LP
        uint256 teamBps = 5000;
        uint256 flywheelBps = 3000;
        uint256 lpBps = 2000;

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        PaidMessagesRouter router = new PaidMessagesRouter(
            admin,
            price,
            teamWallet,
            flywheelWallet,
            lpWallet,
            teamBps,
            flywheelBps,
            lpBps
        );

        console2.log("PaidMessagesRouter deployed to:", address(router));
        console2.log("Admin:", admin);
        console2.log("Price:", price);
        console2.log("Team Wallet:", teamWallet, "(", teamBps, "bps )");
        console2.log("Flywheel Wallet:", flywheelWallet, "(", flywheelBps, "bps )");
        console2.log("LP Wallet:", lpWallet, "(", lpBps, "bps )");

        vm.stopBroadcast();

        // Verification command
        console2.log("\nTo verify on ApeScan:");
        console2.log("forge verify-contract --chain-id 33139 \\");
        console2.log("  --watch \\");
        console2.log("  --etherscan-api-key YOUR_APESCAN_KEY \\");
        console2.log("  --verifier-url https://apescan.io/api \\");
        console2.log("  --constructor-args $(cast abi-encode 'constructor(address,uint256,address,address,address,uint256,uint256,uint256)' %s %s %s %s %s %s %s %s) \\", 
            admin, price, teamWallet, flywheelWallet, lpWallet, teamBps, flywheelBps, lpBps);
        console2.log("  %s \\", address(router));
        console2.log("  src/PaidMessagesRouter.sol:PaidMessagesRouter");
    }
}
