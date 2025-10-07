// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PaidMessagesRouter} from "../src/PaidMessagesRouter.sol";

contract DeployPaidMessagesRouter is Script {
    function run() external {
        // ApeChain mainnet configuration
        address admin = 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5; // Team wallet is also admin
        uint256 minPrice = 1 ether; // 1 APE minimum
        
        // Fee recipients (matching MiningClaimRouterV3 exactly)
        address payable merchantWallet = payable(0xFB53Da794d3d4d831255e7AB40F4649791331e75); // Gold Cap (NGT)
        address payable flywheelWallet = payable(0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4); // NPC trading bot
        address payable teamWallet = payable(0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5); // Team
        address payable lpWallet = payable(0xB8bb2C7fDE8FfB6fe2B71d401E5DD2612Fc6A043); // LP management
        
        // Fee splits (basis points, 10000 = 100%)
        // Same percentages as V3 router: 25% merchant, 50% flywheel, 15% team, 10% LP
        uint256 merchantBps = 2500;  // 0.25 APE (25%)
        uint256 flywheelBps = 5000;  // 0.50 APE (50%)
        uint256 teamBps = 1500;      // 0.15 APE (15%)
        uint256 lpBps = 1000;        // 0.10 APE (10%)

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        PaidMessagesRouter router = new PaidMessagesRouter(
            admin,
            minPrice,
            merchantWallet,
            flywheelWallet,
            teamWallet,
            lpWallet,
            merchantBps,
            flywheelBps,
            teamBps,
            lpBps
        );

        console2.log("PaidMessagesRouter deployed to:", address(router));
        console2.log("Admin:", admin);
        console2.log("Min Price:", minPrice);
        console2.log("");
        console2.log("Fee Recipients:");
        console2.log("  Merchant:", merchantWallet);
        console2.log("    Amount: 0.25 APE (2500 bps)");
        console2.log("  Flywheel:", flywheelWallet);
        console2.log("    Amount: 0.50 APE (5000 bps)");
        console2.log("  Team:", teamWallet);
        console2.log("    Amount: 0.15 APE (1500 bps)");
        console2.log("  LP:", lpWallet);
        console2.log("    Amount: 0.10 APE (1000 bps)");

        vm.stopBroadcast();

        // Verification info
        console2.log("");
        console2.log("To verify, use the constructor args:");
        console2.log("admin:", admin);
        console2.log("minPrice:", minPrice);
        console2.log("merchantWallet:", merchantWallet);
        console2.log("flywheelWallet:", flywheelWallet);
        console2.log("teamWallet:", teamWallet);
        console2.log("lpWallet:", lpWallet);
        console2.log("merchantBps:", merchantBps);
        console2.log("flywheelBps:", flywheelBps);
        console2.log("teamBps:", teamBps);
        console2.log("lpBps:", lpBps);
    }
}
