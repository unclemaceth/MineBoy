// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {ApeBitToken} from "../src/ApeBitToken.sol";
import {MiningClaimRouter} from "../src/MiningClaimRouter.sol";
import {ApeBitCartridge} from "../src/ApeBitCartridge.sol";

contract TieredRewardsTest is Test {
    ApeBitToken public token;
    MiningClaimRouter public router;
    ApeBitCartridge public cartridge;
    
    address public admin = address(0x1);
    address public signer = address(0x2);
    address public user = address(0x3);
    
    function setUp() public {
        // Setup accounts
        vm.startPrank(admin);
        
        // Deploy ApeBitToken
        token = new ApeBitToken(admin);
        
        // Prepare reward table (8-128 ABIT across 16 tiers)
        uint256[16] memory rewardTable;
        for (uint8 i = 0; i < 16; i++) {
            rewardTable[i] = (i + 1) * 8 * 10**18; // 8, 16, 24, ..., 128 ABIT
        }
        
        // Deploy MiningClaimRouter
        router = new MiningClaimRouter(
            address(token),
            signer,
            admin,
            rewardTable
        );
        
        // Deploy ApeBitCartridge
        cartridge = new ApeBitCartridge(
            admin,
            10000, // maxSupply
            0.01 ether, // mintPrice
            "https://api.minerboy.io/cartridge/metadata/"
        );
        
        // Grant MINTER_ROLE to router
        token.grantRole(token.MINTER_ROLE(), address(router));
        
        // Allow cartridge in router
        router.setCartridgeAllowed(address(cartridge), true);
        
        vm.stopPrank();
    }
    
    function testRewardTiers() public {
        // Test all 16 reward tiers
        for (uint8 i = 0; i < 16; i++) {
            uint256 expectedAmount = (i + 1) * 8 * 10**18;
            uint256 actualAmount = router.rewardPerTier(i);
            assertEq(actualAmount, expectedAmount, "Reward tier mismatch");
        }
    }
    
    function testTierFromHash() public {
        // Test tier derivation from workHash
        // Tier 0: 0x0000...
        bytes32 hash0 = bytes32(0x0000000000000000000000000000000000000000000000000000000000000000);
        uint8 tier0 = router.getTierFromHash(hash0);
        assertEq(tier0, 0, "Tier 0 derivation failed");
        
        // Tier 15: 0xf000...
        bytes32 hash15 = bytes32(0xf000000000000000000000000000000000000000000000000000000000000000);
        uint8 tier15 = router.getTierFromHash(hash15);
        assertEq(tier15, 15, "Tier 15 derivation failed");
        
        // Tier 7: 0x7000...
        bytes32 hash7 = bytes32(0x7000000000000000000000000000000000000000000000000000000000000000);
        uint8 tier7 = router.getTierFromHash(hash7);
        assertEq(tier7, 7, "Tier 7 derivation failed");
    }
    
    function testClaimV2Signature() public {
        // Mint a cartridge to user (bypassing payment for test)
        vm.startPrank(admin);
        // We'll simulate having a cartridge by using a mock approach
        vm.stopPrank();
        
        // Prepare claimV2 data
        MiningClaimRouter.ClaimV2 memory claimData = MiningClaimRouter.ClaimV2({
            wallet: user,
            cartridge: address(cartridge),
            tokenId: 1,
            rewardToken: address(token),
            workHash: bytes32(0x7000000000000000000000000000000000000000000000000000000000000000), // Tier 7
            attempts: 1000,
            nonce: keccak256("test-nonce"),
            expiry: uint64(block.timestamp + 3600)
        });
        
        // Create EIP-712 signature
        bytes32 structHash = keccak256(abi.encode(
            router.getClaimV2TypeHash(),
            claimData.wallet,
            claimData.cartridge,
            claimData.tokenId,
            claimData.rewardToken,
            claimData.workHash,
            claimData.attempts,
            claimData.nonce,
            claimData.expiry
        ));
        
        bytes32 domainSeparator = router.getDomainSeparator();
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        
        // Sign with signer private key
        uint256 signerKey = 0x2; // Simple key for testing
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, hash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Execute claimV2
        vm.startPrank(user);
        router.claimV2(claimData, signature);
        vm.stopPrank();
        
        // Check token balance (should be 64 ABIT for tier 7: 8 * 8 = 64)
        uint256 expectedBalance = 64 * 10**18;
        uint256 actualBalance = token.balanceOf(user);
        assertEq(actualBalance, expectedBalance, "Token balance mismatch");
    }
    
    function testPauseUnpause() public {
        // Test pause functionality
        vm.startPrank(admin);
        router.pauseClaims();
        assertTrue(router.paused(), "Contract should be paused");
        
        router.unpauseClaims();
        assertFalse(router.paused(), "Contract should be unpaused");
        vm.stopPrank();
    }
    
    function testAdminFunctions() public {
        vm.startPrank(admin);
        
        // Test reward table update
        uint256[16] memory newTable;
        for (uint8 i = 0; i < 16; i++) {
            newTable[i] = (i + 1) * 10 * 10**18; // 10, 20, 30, ..., 160 ABIT
        }
        router.setRewardTable(newTable);
        
        // Verify update
        assertEq(router.rewardPerTier(0), 10 * 10**18, "Tier 0 should be 10 ABIT");
        assertEq(router.rewardPerTier(15), 160 * 10**18, "Tier 15 should be 160 ABIT");
        
        // Test signer update
        address newSigner = address(0x4);
        router.setSigner(newSigner);
        assertTrue(router.isSigner(newSigner), "New signer should have role");
        
        vm.stopPrank();
    }
}
