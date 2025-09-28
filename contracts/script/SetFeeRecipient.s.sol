// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";

interface IMiningClaimRouter {
    function feeRecipient() external view returns (address);
    function setFeeRecipient(address newRecipient) external;
    function MINE_FEE() external view returns (uint256);
}

contract SetFeeRecipientScript is Script {
    // Deployed MiningClaimRouter address on Curtis
    address constant ROUTER_ADDRESS = 0x5883d7a4A1b503ced7c799Baf3d677A23093E564;
    
    // New fee recipient address
    address constant NEW_FEE_RECIPIENT = 0x46Cd74Aac482cf6CE9eaAa0418AEB2Ae71E2FAc5;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        IMiningClaimRouter router = IMiningClaimRouter(ROUTER_ADDRESS);
        
        // Check current fee recipient
        address currentRecipient = router.feeRecipient();
        console.log("Current fee recipient:", currentRecipient);
        
        // Check mine fee
        uint256 mineFee = router.MINE_FEE();
        console.log("Mine fee:", mineFee);
        
        // Set new fee recipient
        console.log("Setting fee recipient to:", NEW_FEE_RECIPIENT);
        router.setFeeRecipient(NEW_FEE_RECIPIENT);
        
        // Verify the change
        address updatedRecipient = router.feeRecipient();
        console.log("New fee recipient:", updatedRecipient);
        
        vm.stopBroadcast();
    }
}
