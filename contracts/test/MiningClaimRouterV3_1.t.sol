// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import {ECDSA} from "openzeppelin-contracts/utils/cryptography/ECDSA.sol";
import "../src/MiningClaimRouterV3_1.sol";

// --- Minimal Mocks ---
interface IApeBitMintable { 
    function mint(address to, uint256 amount) external; 
    function grantRole(bytes32 role, address account) external;
}

contract MockMint is IApeBitMintable { 
    mapping(address=>uint256) public balanceOf;
    function mint(address to, uint256 amt) external { 
        balanceOf[to] += amt; 
    }
    function grantRole(bytes32, address) external {}
}

contract MockERC721 {
    mapping(uint256=>address) public ownerOf;
    function mint(address to, uint256 id) external { ownerOf[id] = to; }
    function transferFrom(address from, address to, uint256 id) external { 
        require(ownerOf[id] == from, "!own"); 
        ownerOf[id] = to; 
    }
    function balanceOf(address) external pure returns(uint256) { return 1; }
}

contract RouterV31_E2E is Test {
    using ECDSA for bytes32;

    // Test actors
    address vault   = vm.addr(0xA11CE);
    address hot     = vm.addr(0xB0B0);
    address notHot  = vm.addr(0xC0C0);
    address admin   = vm.addr(0xD00D);
    address treasury= vm.addr(0xFEED);
    address signer; 
    uint256 signerPk;

    // System under test
    MockERC721 cart;
    MockMint token;
    MiningClaimRouterV3_1 router;

    // EIP-712 constants
    bytes32 constant CLAIM_V3_TYPEHASH = keccak256(
        "ClaimV3(address cartridge,uint256 tokenId,address wallet,address caller,bytes32 nonce,uint256 tier,uint256 tries,uint256 elapsedMs,bytes32 hash,uint256 expiry)"
    );

    function setUp() public {
        // Setup signer
        signerPk = 0x12345;
        signer = vm.addr(signerPk);

        // Deploy mocks
        cart = new MockERC721();
        token = new MockMint();

        // Setup reward table
        uint256[16] memory rewardTable;
        rewardTable[0] = 0 ether;
        rewardTable[1] = 2 ether;
        rewardTable[2] = 4 ether;
        rewardTable[3] = 6 ether;
        rewardTable[4] = 8 ether;
        rewardTable[5] = 10 ether;
        rewardTable[6] = 15 ether;
        rewardTable[7] = 20 ether;
        rewardTable[8] = 30 ether;
        rewardTable[9] = 40 ether;
        rewardTable[10] = 60 ether;
        rewardTable[11] = 80 ether;
        rewardTable[12] = 100 ether;
        rewardTable[13] = 150 ether;
        rewardTable[14] = 250 ether;
        rewardTable[15] = 500 ether;

        // Deploy router
        vm.prank(admin);
        router = new MiningClaimRouterV3_1(
            address(token),    // rewardToken
            treasury,          // treasuryWallet
            signer,            // initialSigner
            admin,             // admin
            rewardTable
        );

        // Grant MINTER_ROLE to router
        token.grantRole(keccak256("MINTER_ROLE"), address(router));

        // Setup cartridge
        vm.prank(admin);
        router.setCartridgeAllowed(address(cart), true);

        // Mint NFT to vault
        cart.mint(vault, 133);

        // Fund hot wallet for fees
        vm.deal(hot, 1 ether);
    }

    function _signClaim(MiningClaimRouterV3_1.ClaimV3 memory c) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(
            CLAIM_V3_TYPEHASH,
            c.cartridge,
            c.tokenId,
            c.wallet,
            c.caller,
            c.nonce,
            c.tier,
            c.tries,
            c.elapsedMs,
            c.hash,
            c.expiry
        ));
        
        bytes32 domainSeparator = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("MiningClaimRouter"),
            keccak256("3.1"),
            block.chainid,
            address(router)
        ));
        
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, digest);
        return abi.encodePacked(r, s, v);
    }

    function testHappyPath_DelegatedClaim_MintsToHot() public {
        // Build claim for delegated scenario
        MiningClaimRouterV3_1.ClaimV3 memory cl;
        cl.cartridge = address(cart);
        cl.tokenId = 133;
        cl.wallet = vault;  // Vault owns NFT
        cl.caller = hot;    // Hot wallet gets rewards
        cl.nonce = bytes32(uint256(1));
        cl.tier = 12;
        cl.tries = 123;
        cl.elapsedMs = 45000;
        cl.hash = bytes32(uint256(0x111));
        cl.expiry = block.timestamp + 600;

        bytes memory sig = _signClaim(cl);

        uint256 balBefore = token.balanceOf(hot);
        
        // Claim as hot wallet (caller)
        vm.prank(hot);
        router.claimV3{value: 0.01 ether}(cl, sig);

        // Verify rewards minted to hot wallet
        uint256 balAfter = token.balanceOf(hot);
        assertGt(balAfter, balBefore, "Hot wallet should receive rewards");
        
        // Verify treasury got 10%
        assertGt(token.balanceOf(treasury), 0, "Treasury should receive 10%");
    }

    function testRevert_WrongCaller() public {
        MiningClaimRouterV3_1.ClaimV3 memory cl;
        cl.cartridge = address(cart);
        cl.tokenId = 133;
        cl.wallet = vault;
        cl.caller = hot;    // Signature says hot
        cl.nonce = bytes32(uint256(2));
        cl.tier = 12;
        cl.tries = 123;
        cl.elapsedMs = 45000;
        cl.hash = bytes32(uint256(0x222));
        cl.expiry = block.timestamp + 600;

        bytes memory sig = _signClaim(cl);

        // Try to claim with wrong caller
        vm.deal(notHot, 1 ether);
        vm.prank(notHot);
        vm.expectRevert("Invalid caller");
        router.claimV3{value: 0.01 ether}(cl, sig);
    }

    function testRevert_VaultDoesNotOwnNFT() public {
        // Transfer NFT away from vault
        vm.prank(vault);
        cart.transferFrom(vault, address(0xBEEF), 133);

        MiningClaimRouterV3_1.ClaimV3 memory cl;
        cl.cartridge = address(cart);
        cl.tokenId = 133;
        cl.wallet = vault;  // Vault no longer owns
        cl.caller = hot;
        cl.nonce = bytes32(uint256(3));
        cl.tier = 12;
        cl.tries = 123;
        cl.elapsedMs = 45000;
        cl.hash = bytes32(uint256(0x333));
        cl.expiry = block.timestamp + 600;

        bytes memory sig = _signClaim(cl);

        vm.prank(hot);
        vm.expectRevert("Not cartridge owner");
        router.claimV3{value: 0.01 ether}(cl, sig);
    }

    function testRevert_ExpiredClaim() public {
        MiningClaimRouterV3_1.ClaimV3 memory cl;
        cl.cartridge = address(cart);
        cl.tokenId = 133;
        cl.wallet = vault;
        cl.caller = hot;
        cl.nonce = bytes32(uint256(4));
        cl.tier = 12;
        cl.tries = 123;
        cl.elapsedMs = 45000;
        cl.hash = bytes32(uint256(0x444));
        cl.expiry = block.timestamp - 1; // Already expired

        bytes memory sig = _signClaim(cl);

        vm.prank(hot);
        vm.expectRevert("Claim expired");
        router.claimV3{value: 0.01 ether}(cl, sig);
    }

    function testRevert_NonceReuse() public {
        MiningClaimRouterV3_1.ClaimV3 memory cl;
        cl.cartridge = address(cart);
        cl.tokenId = 133;
        cl.wallet = vault;
        cl.caller = hot;
        cl.nonce = bytes32(uint256(5));
        cl.tier = 12;
        cl.tries = 123;
        cl.elapsedMs = 45000;
        cl.hash = bytes32(uint256(0x555));
        cl.expiry = block.timestamp + 600;

        bytes memory sig = _signClaim(cl);

        // First claim succeeds
        vm.prank(hot);
        router.claimV3{value: 0.01 ether}(cl, sig);

        // Second claim with same nonce fails
        vm.deal(hot, 1 ether);
        vm.prank(hot);
        vm.expectRevert("Nonce already used");
        router.claimV3{value: 0.01 ether}(cl, sig);
    }
}

