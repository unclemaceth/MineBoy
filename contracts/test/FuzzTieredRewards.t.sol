// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {ApeBitToken} from "../src/ApeBitToken.sol";
import {MiningClaimRouter} from "../src/MiningClaimRouter.sol";

contract FuzzTieredRewardsTest is Test {
    ApeBitToken public token;
    MiningClaimRouter public router;
    
    address public admin = address(0x1);
    address public signer = address(0x2);
    
    function setUp() public {
        vm.startPrank(admin);
        
        // Deploy ApeBitToken
        token = new ApeBitToken(admin);
        
        // Prepare reward table (8-128 ABIT across 16 tiers)
        uint256[16] memory rewardTable;
        rewardTable[0] = 8 * 10**18;   // 8 ABIT
        rewardTable[1] = 16 * 10**18;  // 16 ABIT
        rewardTable[2] = 24 * 10**18;  // 24 ABIT
        rewardTable[3] = 32 * 10**18;  // 32 ABIT
        rewardTable[4] = 40 * 10**18;  // 40 ABIT
        rewardTable[5] = 48 * 10**18;  // 48 ABIT
        rewardTable[6] = 56 * 10**18;  // 56 ABIT
        rewardTable[7] = 64 * 10**18;  // 64 ABIT
        rewardTable[8] = 72 * 10**18;  // 72 ABIT
        rewardTable[9] = 80 * 10**18;  // 80 ABIT
        rewardTable[10] = 88 * 10**18; // 88 ABIT
        rewardTable[11] = 96 * 10**18; // 96 ABIT
        rewardTable[12] = 104 * 10**18; // 104 ABIT
        rewardTable[13] = 112 * 10**18; // 112 ABIT
        rewardTable[14] = 120 * 10**18; // 120 ABIT
        rewardTable[15] = 128 * 10**18; // 128 ABIT
        
        // Deploy MiningClaimRouter
        router = new MiningClaimRouter(
            address(token),
            signer,
            admin,
            rewardTable
        );
        
        // Grant MINTER_ROLE to router
        token.grantRole(token.MINTER_ROLE(), address(router));
        
        vm.stopPrank();
    }
    
    /**
     * @dev Fuzz test: workHash → tier → amount mapping
     * Ensures that any workHash correctly maps to the expected tier and reward amount
     */
    function testFuzzWorkHashToTierMapping(bytes32 workHash) public view {
        // Extract tier from workHash (first nibble)
        uint8 expectedTier = uint8(uint256(workHash) >> 252) & 0x0f;
        
        // Get actual tier from contract
        uint8 actualTier = router.getTierFromHash(workHash);
        
        // Verify tier extraction
        assertEq(actualTier, expectedTier, "Tier extraction mismatch");
        
        // Verify tier is within valid range
        assertTrue(actualTier < 16, "Tier must be 0-15");
        
        // Get expected reward amount
        uint256 expectedAmount = router.rewardPerTier(actualTier);
        
        // Verify amount is correct for the tier
        uint256 calculatedAmount = (actualTier + 1) * 8 * 10**18;
        assertEq(expectedAmount, calculatedAmount, "Reward amount mismatch");
    }
    
    /**
     * @dev Fuzz test: signer role validation
     * Ensures only addresses with SIGNER_ROLE can sign claims
     */
    function testFuzzSignerRoleValidation(address fuzzSigner) public {
        vm.assume(fuzzSigner != address(0));
        vm.assume(fuzzSigner != signer);
        
        // Only the original signer should have SIGNER_ROLE
        assertTrue(router.isSigner(signer), "Original signer should have role");
        assertFalse(router.isSigner(fuzzSigner), "Random address should not have role");
    }
    
    /**
     * @dev Fuzz test: reward tier bounds
     * Ensures all reward tiers are within expected bounds
     */
    function testFuzzRewardTierBounds(uint8 tier) public view {
        vm.assume(tier < 16); // Only valid tiers
        
        uint256 amount = router.rewardPerTier(tier);
        
        // Verify amount is positive and within expected range
        assertTrue(amount > 0, "Reward amount must be positive");
        assertTrue(amount >= 8 * 10**18, "Minimum reward is 8 ABIT");
        assertTrue(amount <= 128 * 10**18, "Maximum reward is 128 ABIT");
        
        // Verify amount follows the pattern: (tier + 1) * 8 * 10**18
        uint256 expectedAmount = (tier + 1) * 8 * 10**18;
        assertEq(amount, expectedAmount, "Reward amount should follow tier pattern");
    }
    
    /**
     * @dev Fuzz test: tier extraction edge cases
     * Tests specific nibble values to ensure correct tier extraction
     */
    function testFuzzTierExtractionEdgeCases() public view {
        // Test all possible first nibble values (0x0-0xF)
        for (uint8 nibble = 0; nibble < 16; nibble++) {
            // Create workHash with specific first nibble
            bytes32 workHash = bytes32(uint256(nibble) << 252);
            
            uint8 tier = router.getTierFromHash(workHash);
            assertEq(tier, nibble, "Tier should match first nibble");
        }
    }
    
    /**
     * @dev Fuzz test: reward table consistency
     * Ensures reward table is consistent and monotonic
     */
    function testFuzzRewardTableConsistency() public view {
        uint256 previousAmount = 0;
        
        // Test each tier individually to avoid loop issues
        for (uint8 tier = 0; tier < 16; tier++) {
            uint256 currentAmount = router.rewardPerTier(tier);
            
            // Verify monotonic increase
            assertTrue(currentAmount > previousAmount, "Rewards should increase with tier");
            
            // Verify exact amount
            uint256 expectedAmount = (tier + 1) * 8 * 10**18;
            assertEq(currentAmount, expectedAmount, "Reward amount should match expected");
            
            previousAmount = currentAmount;
        }
    }
}
