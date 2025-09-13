// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ApeBitClaim - Minimal on-chain verifier for ApeBit claims on Curtis testnet
/// @notice This contract verifies 92-byte preimages and enforces suffix-based difficulty
/// @dev Preimage layout (92 bytes, big-endian integers):
///      0..3   : "ABIT"
///      4..11  : chainId       (uint64, big-endian)
///      12..31 : contract      (20 bytes)
///      32..51 : miner         (20 bytes)
///      52..83 : prevHash      (32 bytes)
///      84..91 : attempts      (uint64, big-endian)
contract ApeBitClaim {
    // "ABIT" magic header in the first 4 bytes of the preimage
    bytes4 constant MAGIC = 0x41424954;

    // Replay protection by sha256(preimage)
    mapping(bytes32 => bool) public claimed;

    // Suffix configuration (immutable, set at deployment)
    uint256 public immutable suffixValue;  // e.g., 0xAB17 or 0xA9EB17
    uint256 public immutable suffixMask;   // e.g., 0xFFFF or 0xFFFFFF

    // Current chain anchor (starts at zero, advances with each claim)
    bytes32 public lastHash;

    event Claimed(address indexed miner, bytes32 hash, bytes preimage, uint64 attempts);

    /// @param _suffixValue The hex value that hash must end with (e.g., 0xAB17)
    /// @param _suffixMask The mask to apply for suffix checking (e.g., 0xFFFF for 16 bits)
    constructor(uint256 _suffixValue, uint256 _suffixMask) {
        // Sanity check: mask must be contiguous ones from LSB
        require(_suffixMask == 0xFFFF || _suffixMask == 0xFFFFFF, "Invalid mask");
        require((_suffixValue & _suffixMask) == _suffixValue, "Value exceeds mask");
        
        suffixValue = _suffixValue;
        suffixMask = _suffixMask;
    }

    /// @notice Claim with the raw 92-byte preimage
    /// @param preimage The 92-byte preimage containing all mining parameters
    function claim(bytes calldata preimage) external {
        require(preimage.length == 92, "Invalid preimage length");

        // Verify magic header "ABIT"
        bytes4 magic;
        assembly {
            // Load first 4 bytes from calldata
            magic := shr(224, calldataload(preimage.offset))
        }
        require(magic == MAGIC, "Invalid magic header");

        // Extract miner address from bytes [32..51] (20 bytes)
        address minedMiner;
        assembly {
            // Load 32 bytes starting at offset 32, then shift right to get address
            minedMiner := shr(96, calldataload(add(preimage.offset, 32)))
        }
        require(minedMiner == msg.sender, "Miner mismatch");

        // Extract contract address from bytes [12..31] (20 bytes)
        address preimageContract;
        assembly {
            preimageContract := shr(96, calldataload(add(preimage.offset, 12)))
        }
        require(preimageContract == address(this), "Contract mismatch");

        // Extract chainId from bytes [4..11] (8 bytes, big-endian)
        uint64 preimageChainId;
        assembly {
            let data := calldataload(add(preimage.offset, 4))
            preimageChainId := shr(192, data)
        }
        require(preimageChainId == block.chainid, "ChainId mismatch");

        // Extract prevHash from bytes [52..83] (32 bytes)
        bytes32 prevHash;
        assembly {
            prevHash := calldataload(add(preimage.offset, 52))
        }
        require(prevHash == lastHash, "Previous hash mismatch");

        // Extract attempts from bytes [84..91] (8 bytes, big-endian)
        uint64 attempts;
        assembly {
            // Load 32 bytes starting at offset 84, then extract the 8-byte big-endian value
            let data := calldataload(add(preimage.offset, 84))
            attempts := shr(192, data) // Shift right 24 bytes (192 bits) to get the first 8 bytes
        }

        // Recompute hash and verify it hasn't been claimed
        bytes32 h = sha256(preimage);
        require(!claimed[h], "Already claimed");

        // Verify suffix (last hex digits must match)
        require((uint256(h) & suffixMask) == suffixValue, "Invalid suffix");

        // Mark as claimed and advance chain anchor
        claimed[h] = true;
        lastHash = h;

        emit Claimed(minedMiner, h, preimage, attempts);
    }

    /// @notice Get the current difficulty configuration
    /// @return value The suffix value (e.g., 0xAB17)
    /// @return mask The suffix mask (e.g., 0xFFFF)
    function getDifficulty() external view returns (uint256 value, uint256 mask) {
        return (suffixValue, suffixMask);
    }
}
