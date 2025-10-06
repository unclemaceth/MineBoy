# 🤖 NPC Flywheel Trading Bot

Automated bot that buys cheap NPCs, relists them at +20%, and burns 99% of profits into MNESTR.

---

## 🎯 What It Does

1. **Monitors** the Flywheel wallet (gets 0.005 APE per claim)
2. **Buys** cheapest NPC listings when balance is sufficient
3. **Relists** immediately at +20% markup
4. **Watches** for sales
5. **Settles** when sold:
   - Swaps 99% of APE balance → MNESTR
   - Burns ALL MNESTR received
   - Keeps ~1% APE for gas

This creates **deflationary pressure** on MNESTR supply! 🔥

---

## 📋 Quick Setup

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `FLYWHEEL_PRIVATE_KEY` - **REQUIRED** - The private key for the Flywheel wallet

All other values are pre-configured for ApeChain production.

### 2. Provide Listings

The bot needs a listing source. Edit `src/market/manualListings.ts`:

```typescript
export async function getNextListing(): Promise<ManualListing | null> {
  // Example: Return a listing to buy
  return {
    to: "0x224ecB4Eae96d31372D1090c3B0233C8310dBbaB",
    data: "0x...", // calldata from marketplace
    valueWei: "10000000000000000", // 0.01 APE in wei
    tokenId: "123",
    priceNative: "0.01"
  };
}
```

Options for getting listings:
- **Manual JSON file** (simplest for testing)
- **OpenSea API** (call their orders endpoint)
- **Magic Eden API** (call their listings endpoint)
- **Your own API** (custom aggregator)

### 3. Run Locally

```bash
npm run dev
```

You'll see:
```
[Init] Flywheel address: 0x08AD...B0C4
[Init] Daily spend cap: 250 APE
[Init] Markup: +20%
[Init] Burn rate: 99%
```

### 4. Test a Buy

Once you have a listing source configured:
1. Bot will check if it can afford the listing
2. Buy the NPC
3. Verify ownership
4. Relist at +20%
5. Wait for sale (~30 min timeout)
6. Swap 99% APE → MNESTR → Burn

---

## 🚀 Deploy to Render

### Create New Service

1. Go to Render dashboard
2. Create **Background Worker** (not Web Service)
3. Connect your Git repo
4. Configure:
   - **Root Directory:** `packages/flywheel-bot`
   - **Build Command:** `npm install`
   - **Start Command:** `npm run dev`
   - **Node Version:** 18 or higher

### Add Environment Variables

In Render service settings, add all variables from `.env.example`:

```bash
RPC_URL=https://rpc.apechain.com/http
CHAIN_ID=33139
MNESTR=0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276
NPC_COLLECTION=0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA
FLYWHEEL_WALLET=0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4
MARKET_ROUTER=0x224ecB4Eae96d31372D1090c3B0233C8310dBbaB
DEX_ROUTER=0x18E621B64d7808c3C47bccbbD7485d23F257D26f
WAPE=0x48b62137EdfA95a428D35C09E44256a739F6B557
MARKUP_BPS=2000
BUY_BUFFER_BPS=100
DAILY_SPEND_CAP_APE=250
```

**Add Secret Variable:**
- `FLYWHEEL_PRIVATE_KEY` - Use Render's secret file or encrypted environment variable

### Deploy

Click "Deploy" and monitor logs for:
- `[Buy:OK]` - Successfully bought an NPC
- `[List:OK]` - Successfully listed it
- `[Watch:SOLD]` - It sold!
- `[Settle:OK]` - Burned MNESTR 🔥

---

## 🔧 Configuration

### Policy Settings

Edit `.env` to adjust:

```bash
MARKUP_BPS=2000            # 2000 = +20%, 3000 = +30%, etc.
BUY_BUFFER_BPS=100         # 100 = 1% buffer for gas
DAILY_SPEND_CAP_APE=250    # Max APE to spend per day
```

### Burn Rate

Currently hardcoded to **99%** in `src/dex/camelot.ts`:
```typescript
const burnWei = (bal * 99n) / 100n;  // 99% burn, 1% kept for gas
```

To adjust, change the `99n` to your preferred percentage.

---

## 📊 Monitoring

Watch the logs for:

```
[Buy] Attempting to buy tokenId=123 for 0.01 APE
[Buy:OK] tx=0x...
[Verify:OK] We now own tokenId=123
[List:OK] Listed tokenId=123 at 0.012 APE
[Watch] Monitoring tokenId=123 for sale...
[Watch:SOLD] tokenId=123 has been sold!
[Settle] Processing sale proceeds...
[Swap] Swapping 9900000000000000 wei APE (99%) for MNESTR...
[Swap:OK] tx=0x...
[Settle] Burning 123456789... wei of MNESTR...
[Settle:OK] Burned 123456789... wei MNESTR! 🔥
```

---

## 🛠️ Advanced: Connect to Marketplace APIs

### Option 1: OpenSea API

In `src/market/manualListings.ts`:

```typescript
import axios from 'axios';

export async function getNextListing(): Promise<ManualListing | null> {
  const { data } = await axios.get(
    'https://api.opensea.io/v2/orders/chain/apechain/listings',
    {
      params: {
        asset_contract_address: '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA',
        limit: 1,
        order_by: 'eth_price',
        order_direction: 'asc'
      },
      headers: {
        'X-API-KEY': process.env.OPENSEA_API_KEY
      }
    }
  );
  
  // Parse OpenSea response and return listing
  // (requires mapping their format to our ManualListing type)
}
```

### Option 2: Magic Eden API

Similar approach, different endpoint and format.

### Option 3: Reservoir Aggregator

Best option - aggregates all marketplaces:

```bash
npm install axios
```

```typescript
export async function getNextListing(): Promise<ManualListing | null> {
  const { data } = await axios.get(
    'https://api.reservoir.tools/orders/asks/v5',
    {
      params: {
        contracts: '0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA',
        limit: 1,
        sortBy: 'price'
      },
      headers: {
        'x-api-key': process.env.RESERVOIR_API_KEY
      }
    }
  );
  
  // Map Reservoir response to ManualListing
}
```

---

## 📁 Project Structure

```
packages/flywheel-bot/
├── src/
│   ├── index.ts              # Main bot loop
│   ├── config.ts             # Configuration
│   ├── provider.ts           # Blockchain connection
│   ├── wallets.ts            # Flywheel wallet
│   ├── abis/
│   │   ├── erc20.ts         # Token interface
│   │   ├── erc721.ts        # NFT interface
│   │   └── univ2Router.ts   # DEX interface
│   ├── market/
│   │   ├── manualListings.ts # Listing source
│   │   ├── buy.ts           # Buy logic
│   │   ├── list.ts          # Relist logic
│   │   └── sale.ts          # Sale detection
│   ├── dex/
│   │   └── camelot.ts       # Swap logic
│   └── settle/
│       └── settle.ts         # Burn logic
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## ✅ Pre-Configured Addresses

All ApeChain mainnet addresses are pre-configured:

- **MNESTR Token:** `0xAe0DfbB1a2b22080F947D1C0234c415FabEEc276`
- **NPC Collection:** `0xFA1c20E0d4277b1E0b289DfFadb5Bd92Fb8486aA`
- **Flywheel Wallet:** `0x08AD425BA1D1fC4d69d88B56f7C6879B2E85b0C4`
- **Market Router:** `0x224ecB4Eae96d31372D1090c3B0233C8310dBbaB`
- **Camelot DEX:** `0x18E621B64d7808c3C47bccbbD7485d23F257D26f`
- **WAPE:** `0x48b62137EdfA95a428D35C09E44256a739F6B557`

---

## 🔐 Security

- Never commit `.env` file
- Use Render secrets for `FLYWHEEL_PRIVATE_KEY`
- Monitor daily spend cap
- Start with small test amounts

---

## 🐛 Troubleshooting

### Bot not buying anything
- Check `getNextListing()` returns valid listing
- Verify Flywheel wallet has enough APE
- Check daily spend cap hasn't been hit

### Transaction failed
- Ensure listing is still valid (not already sold)
- Check gas buffer is sufficient
- Verify market router address is correct

### Swap failed
- Check WAPE and DEX_ROUTER addresses
- Ensure liquidity exists for WAPE→MNESTR pair
- Try increasing gas limit

---

## 📝 TODO

- [ ] Add Seaport integration for relisting (currently logs only)
- [ ] Connect to OpenSea/Magic Eden API for live listings
- [ ] Add slippage protection to swaps
- [ ] Add webhook notifications for buys/burns
- [ ] Create simple dashboard for monitoring
- [ ] Add multi-route swap support (WAPE→USDC→MNESTR)

---

## 🎉 Success!

When you see this in the logs, it's working:

```
[Settle:OK] Burned 123456789... wei MNESTR! 🔥
```

Each burn permanently removes MNESTR from circulation, increasing scarcity! 🚀
