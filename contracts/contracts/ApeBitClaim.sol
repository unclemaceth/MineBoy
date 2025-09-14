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

    /// @notice Parse preimage into components using memory copy for safety
    function _parse(bytes calldata preimage)
        internal
        pure
        returns (
            bytes4 magic,
            uint64 chainId,
            address contractAddr,
            address miner,
            bytes32 prevHash,
            uint64 attempts
        )
    {
        require(preimage.length == 92, "bad preimage len");

        // Copy the 92 bytes into memory so mload works at exact byte offsets
        bytes memory tmp = new bytes(92);
        assembly {
            // tmp points at length; data starts at add(tmp, 32)
            calldatacopy(add(tmp, 32), preimage.offset, 92)

            magic        := mload(add(tmp, 32))         // top 4 bytes taken when cast to bytes4
            chainId      := shr(192, mload(add(tmp, 36))) // 8 bytes at offset 4
            contractAddr := shr(96,  mload(add(tmp, 44))) // 20 bytes at offset 12
            miner        := shr(96,  mload(add(tmp, 64))) // 20 bytes at offset 32
            prevHash     := mload(add(tmp, 84))           // 32 bytes at offset 52
            attempts     := shr(192, mload(add(tmp, 116)))// 8 bytes at offset 84
        }

        // Solidity casts: keep only the intended widths
        magic        = bytes4(magic);
        chainId      = uint64(chainId);
        contractAddr = address(uint160(uint256(uint160(contractAddr))));
        miner        = address(uint160(uint256(uint160(miner))));
        // prevHash already bytes32
        attempts     = uint64(attempts);

        // Sanity check
        require(magic == MAGIC, "Invalid magic header");
    }

    /// @notice Claim with the raw 92-byte preimage
    /// @param preimage The 92-byte preimage containing all mining parameters
    function claim(bytes calldata preimage) external {
        (bytes4 magic, uint64 chainId, address contractAddr, address miner, bytes32 prevHash, uint64 attempts) = _parse(preimage);

        require(miner == msg.sender, "Miner mismatch");
        require(contractAddr == address(this), "Contract mismatch");
        require(chainId == block.chainid, "ChainId mismatch");
        require(prevHash == lastHash, "Previous hash mismatch");

        // Recompute hash and verify it hasn't been claimed
        bytes32 h = sha256(preimage);
        require(!claimed[h], "Already claimed");

        // Verify suffix (last hex digits must match)
        require((uint256(h) & suffixMask) == suffixValue, "Invalid suffix");

        // Mark as claimed and advance chain anchor
        claimed[h] = true;
        lastHash = h;

        emit Claimed(miner, h, preimage, attempts);
    }

    /// @notice Get the current difficulty configuration
    /// @return value The suffix value (e.g., 0xAB17)
    /// @return mask The suffix mask (e.g., 0xFFFF)
    function getDifficulty() external view returns (uint256 value, uint256 mask) {
        return (suffixValue, suffixMask);
    }

    /// @notice Debug function to peek at preimage parsing
    /// @param preimage The 92-byte preimage to parse
    /// @return magic The magic header bytes
    /// @return chainId The extracted chain ID
    /// @return contractAddr The extracted contract address
    /// @return miner The extracted miner address
    /// @return prevHash The extracted previous hash
    /// @return attempts The extracted attempts count
    function peek(bytes calldata preimage) external pure returns (
        bytes4 magic,
        uint64 chainId,
        address contractAddr,
        address miner,
        bytes32 prevHash,
        uint64 attempts
    ) {
        // Use the same parser as claim() for consistency
        return _parse(preimage);
    }
}
