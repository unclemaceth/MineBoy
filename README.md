# 🎮 MineBoy - ApeBit Mining Game

A retro-styled mining game built on ApeChain Curtis testnet, featuring NFT-gated mining, real-time leaderboards, and a nostalgic Game Boy aesthetic.

## ✨ Features

### 🎯 Core Gameplay
- **NFT-Gated Mining**: Only ApeBit Cartridge holders can mine
- **Proof of Work**: SHA-256 hash mining with configurable difficulty
- **Real-time Rewards**: Instant ABIT token rewards for successful mining
- **Leaderboard**: Track top miners across different time periods

### 🎨 Retro UI/UX
- **Game Boy Aesthetic**: Authentic retro styling with embossed text
- **Typewriter Effects**: Animated terminal with boot sequences
- **Fan Animation**: Spinning metallic fan blades
- **Responsive Design**: Works on desktop and mobile

### 🔐 Wallet Integration
- **Glyph Wallet**: Seamless Web3 authentication
- **WalletConnect**: Multi-wallet support (coming soon)
- **EIP-712 Signatures**: Secure claim verification
- **Curtis Testnet**: ApeChain testnet integration

## 🏗️ Architecture

### Frontend (Next.js)
- **Framework**: Next.js 15 with App Router
- **Styling**: Custom Game Boy aesthetic
- **State Management**: Zustand stores
- **Wallet Integration**: Wagmi + Glyph SDK

### Backend (Node.js/TypeScript)
- **API Server**: Fastify with TypeScript
- **Database**: SQLite (dev) / Postgres (prod)
- **Real-time**: WebSocket mining sessions
- **Security**: EIP-712 signatures, replay protection

### Smart Contracts
- **ApeBit Token**: ERC-20 rewards token
- **ApeBit Cartridges**: ERC-721 NFT collection
- **Mining Contract**: EIP-712 claim verification

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Git
- ApeBit Cartridge NFT (for mining)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/unclemaceth/MineBoy.git
   cd MineBoy
   ```

2. **Install dependencies**
   ```bash
   # Frontend
   cd apps/minerboy-web
   npm install --legacy-peer-deps
   
   # Backend
   cd ../../packages/backend
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Backend environment
   cp packages/backend/.env.example packages/backend/.env
   # Edit .env with your RPC URL and other settings
   ```

4. **Start development servers**
   ```bash
   # Backend (Terminal 1)
   cd packages/backend
   npm run dev
   
   # Frontend (Terminal 2)
   cd apps/minerboy-web
   npm run dev
   ```

5. **Access the game**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8787

## 🎮 How to Play

1. **Connect Wallet**: Use Glyph wallet to authenticate
2. **Load Cartridge**: Insert your ApeBit Cartridge NFT
3. **Start Mining**: Press 'A' to begin proof-of-work mining
4. **Claim Rewards**: Submit successful hashes for ABIT tokens
5. **Compete**: Climb the leaderboard rankings

## 📊 API Endpoints

### Mining
- `POST /v2/session/open` - Start mining session
- `POST /v2/session/heartbeat` - Keep session alive
- `POST /v2/claim` - Submit mining claim
- `POST /v2/claim/tx` - Report transaction hash

### Leaderboard
- `GET /v2/leaderboard?period=all&limit=25` - Get top miners

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```bash
# RPC Configuration
RPC_URL=https://apechain-curtis.g.alchemy.com/your-api-key

# Database
DATABASE_URL=sqlite:./minerboy.db

# Receipt Polling
RECEIPT_POLL_INTERVAL_MS=3600000
RECEIPT_POLL_BATCH_LIMIT=500
RUN_RECEIPT_POLLER=true
```

## 🚀 Deployment

### Vercel (Frontend)
1. Connect GitHub repository to Vercel
2. Set build command: `cd apps/minerboy-web && npm run build`
3. Set output directory: `apps/minerboy-web/.next`
4. Deploy!

### Render (Backend)
1. Create new Web Service on Render
2. Connect GitHub repository
3. Set build command: `cd packages/backend && npm install`
4. Set start command: `cd packages/backend && npm start`
5. Add environment variables
6. Deploy!

## 🛡️ Security

- **EIP-712 Signatures**: Cryptographic claim verification
- **Replay Protection**: Unique nonces prevent double-spending
- **Session Management**: Secure WebSocket connections
- **Input Validation**: Comprehensive sanitization

## 📈 Roadmap

- [ ] WalletConnect integration
- [ ] Mobile app optimization
- [ ] Additional cartridge types
- [ ] Tournament system
- [ ] Social features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- **Game**: [Play MineBoy](https://mineboy.vercel.app)
- **GitHub**: [Repository](https://github.com/unclemaceth/MineBoy)
- **ApeChain**: [Curtis Testnet](https://curtis.apechain.io)

---

**Built with ❤️ for the ApeChain community**
