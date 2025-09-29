# IPFS Setup for ApeBit Cartridges

## Quick Setup Guide

### 1. Prepare Your Assets

**Static Image:**
- Format: PNG (recommended) or JPG
- Size: 512x512px or 1024x1024px (standard NFT size)
- Name: `cartridge.png` (or `1.png`, `2.png`, etc. for individual images)

**Animated Image:**
- Format: GIF, MP4, or WebM
- Size: Same as static image
- Name: `cartridge-animated.gif` (or similar)

### 2. Upload to IPFS

**Option A: Pinata (Recommended)**
1. Go to [pinata.cloud](https://pinata.cloud)
2. Sign up for free account
3. Upload your static image → copy the IPFS hash
4. Upload your animated image → copy the IPFS hash

**Option B: NFT.Storage**
1. Go to [nft.storage](https://nft.storage)
2. Sign up for free account
3. Upload both files → copy the IPFS hashes

### 3. Update the Script

Edit `contracts/script/UpdateCartridgeURIs.s.sol`:

```solidity
// Replace these with your actual IPFS hashes
string constant BASE_URI = "ipfs://QmYourActualImageHashHere/";
string constant ANIMATION_URI = "ipfs://QmYourActualAnimationHashHere";
```

### 4. Deploy the Updates

```bash
cd contracts
forge script script/UpdateCartridgeURIs.s.sol --rpc-url https://rpc.apechain.com/http --broadcast --verify
```

### 5. Test the Metadata

After deployment, test a token URI:
```bash
cast call 0xE2cD7a8182DdC40F620f570c21f315E37dA2f21C "tokenURI(uint256)" 1
```

This should return base64-encoded JSON with both `image` and `animation_url` fields.

## Example Metadata Structure

The contract will generate metadata like this:

```json
{
  "name": "ApeBit Cartridge #1",
  "description": "A mining cartridge for the MineBoy game. Each cartridge unlocks the ability to mine ApeBit tokens on ApeChain.",
  "image": "ipfs://QmYourImageHash/1.png",
  "animation_url": "ipfs://QmYourAnimationHash",
  "attributes": [
    {"trait_type": "Type", "value": "Mining Cartridge"},
    {"trait_type": "Game", "value": "MineBoy"},
    {"trait_type": "Network", "value": "ApeChain"}
  ]
}
```

## Frontend Integration

The frontend can now:
1. Call `tokenURI()` to get the metadata
2. Decode the base64 JSON
3. Display the `animation_url` for all cartridges
4. No need to fetch from Alchemy for images!
