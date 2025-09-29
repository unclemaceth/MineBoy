# 🧪 MineBoy Testing Guide

## **Contract Security Tests** ✅

### **1. Direct Contract Minting Test**
- **Status**: ✅ PASSED
- **Result**: Direct minting blocked (only MINTER_ROLE can mint)
- **Test User**: No MINTER_ROLE
- **Deployer**: Has MINTER_ROLE

### **2. Supply Limits Test**
- **Max Supply**: 250 cartridges
- **Max Per Wallet**: 1 cartridge
- **Current Supply**: 0 (fresh deployment)

---

## **Frontend Testing Checklist**

### **Test 1: New User (No Cartridges)**
1. **Connect wallet** to ApeChain (Chain ID: 33139)
2. **Open mint modal** - should show:
   - ✅ "Mint" button enabled
   - ✅ "0 of 250 minted" counter
   - ✅ "250 remaining" 
   - ✅ Mining-focused explanation
3. **Click Mint** - should:
   - ✅ Show "Minting..." then "Confirming..."
   - ✅ Show success message "🎉 Cartridge Minted Successfully! 🎉"
   - ✅ Update counter to "1 of 250 minted"

### **Test 2: Existing User (Owns Cartridge)**
1. **After minting** from Test 1, try to mint again
2. **Mint button** should show:
   - ✅ "Already Owned!" text
   - ✅ Button disabled (greyed out)
   - ✅ Warning message: "⚠️ You already own 1 cartridge!"
   - ✅ Helpful text: "Use the SELECT CARTRIDGE button to mine with your existing cartridge."

### **Test 3: Cartridge Selection**
1. **Click "SELECT CARTRIDGE"** button
2. **Modal should show**:
   - ✅ Animated cartridge video
   - ✅ "Cartridge #1" (or your token ID)
   - ✅ Click to select and start mining

### **Test 4: Mining Flow**
1. **Select cartridge** from Test 3
2. **Should start mining session**:
   - ✅ Terminal shows "ApeBit Cartridge Loaded"
   - ✅ "Enabling Mining Protocol..."
   - ✅ "Press A to Mine..."
3. **Press A** to start mining
4. **Should see**:
   - ✅ Hash attempts in terminal
   - ✅ Hash rate display
   - ✅ Mining progress

### **Test 5: Claiming Rewards**
1. **After finding a hash** (or wait for auto-claim)
2. **Should see**:
   - ✅ "Hash found!" message
   - ✅ Claim transaction
   - ✅ Reward tokens received

---

## **Backend Testing**

### **Test 1: Environment Variables**
Check that backend is using new contract addresses:
- **ROUTER_ADDRESS**: `0x28D5204852D1f788157f909Ad5808f460Ddc6f02`
- **REWARD_TOKEN_ADDRESS**: `0x5f942B20B8aA905B8F6a46Ae226E7F6bF2F44023`
- **CARTRIDGE_ADDRESS**: `0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d`
- **CHAIN_ID**: `33139`

### **Test 2: API Endpoints**
1. **Start mining session**: Should work with new cartridge
2. **Claim rewards**: Should work with new token
3. **Leaderboard**: Should show mining progress

---

## **Edge Cases to Test**

### **Test 1: Sold Out Scenario**
- When 250 cartridges are minted
- Button should show "Sold Out!" and be disabled

### **Test 2: Wrong Network**
- Connect to wrong network (e.g., Ethereum)
- Should show "Please switch to ApeChain or Curtis to mint"

### **Test 3: Wallet Disconnection**
- Disconnect wallet during mint
- Should handle gracefully

---

## **Manual Contract Testing**

### **Test 1: Try Direct Minting**
```bash
# This should fail (run from contracts directory)
forge script script/TestSecurity.s.sol --rpc-url https://rpc.apechain.com/http
```

### **Test 2: Check Contract State**
```bash
# Check total supply
cast call 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d "totalSupply()" --rpc-url https://rpc.apechain.com/http

# Check max supply
cast call 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d "maxSupply()" --rpc-url https://rpc.apechain.com/http

# Check max per wallet
cast call 0xCA2D7B429248A38b276c8293506f3bE8E1FC2C2d "maxPerWallet()" --rpc-url https://rpc.apechain.com/http
```

---

## **Expected Results Summary**

✅ **Security**: Only authorized addresses can mint  
✅ **Limits**: 1 per wallet, 250 max supply  
✅ **UI**: Clear feedback for all states  
✅ **Mining**: Full mining flow works  
✅ **Claims**: Rewards can be claimed  
✅ **Cartridges**: Selection and ownership work  

---

## **Troubleshooting**

### **If Mint Button Disabled**
- Check wallet connection
- Check network (must be ApeChain)
- Check if wallet already owns cartridge

### **If Mining Doesn't Start**
- Check cartridge selection
- Check backend connection
- Check wallet has APE for gas

### **If Claims Fail**
- Check APE balance for 0.001 fee
- Check network connection
- Check contract addresses are correct
