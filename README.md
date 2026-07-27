

# MantleFlow

> Real-time whale transaction tracking, AI-driven market commentary, and interactive Telegram Mini App ecosystem built for Mantle Network.

[![Next.js Version](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![Node Version](https://img.shields.io/badge/Node.js-%3E%3D20.0-green.svg)](https://nodejs.org/)
[![Mantle Network](https://img.shields.io/badge/Blockchain-Mantle_Network-000000.svg)](https://www.mantle.xyz/)
[![Gemini AI](https://img.shields.io/badge/AI-Gemini_Flash-blue.svg)](https://deepmind.google/technologies/gemini/)
[![License](https://img.shields.io/badge/license-MIT-purple.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-active-brightgreen.svg)]()

---

## About The Project

Large-scale capital movements — such as whale swaps, liquidity provisions, multi-hop arbitrage runs, and massive staking deposits — strongly dictate momentum on EVM Layer-2 ecosystems. On Mantle Network, tracking these high-value transactions manually across multiple DEXes (Agni, Merchant Moe) and liquid staking protocols is difficult without dedicated real-time indexing infrastructure.

**MantleFlow** solves this problem by combining a high-performance EVM block log scanner, multi-source price resolution (Pyth Network Oracles with on-chain DEX router fallbacks), and LLM-powered degen commentary generation via Google Gemini. The engine monitors incoming blocks in real time, classifies transactions using deterministic log decoding, resolves exact USD values, and fans out formatted notifications.

Complementing the backend is an interactive, mobile-optimized Telegram Mini App built with Next.js 14, RainbowKit, and Wagmi. Users can connect their Web3 wallets, configure granular alert filters per token or volume threshold, and verify on-chain smart contract subscriptions to unlock premium capabilities.

---

## Key Features

- 🌊 **Real-Time On-Chain Scanner**: Asynchronous WebSocket block listener filtering Mantle block logs through a 9-step detection pipeline with automated reconnection backoff.
- 🤖 **AI Degen Commentary Engine**: Multi-key rotation wrapper over Google Gemini Flash to generate single-sentence, street-smart analytical commentary for every whale transaction.
- 💰 **Dual-Layer Price Oracle**: Instant USD valuation using Pyth Network Oracles with on-chain Merchant Moe DEX router fallback for tokens without native price feeds.
- 📱 **Telegram Mini App & Bot**: Sleek glassmorphism UI for web3 wallet connection, live activity feed viewing, and interactive inline filter configuration.
- 🔐 **Cryptographic Verification**: Web3 wallet ownership verification (`EIP-191` message signatures) and double-spend-proof on-chain receipt validation for subscriptions.
- 📢 **Fan-Out Broadcast Engine**: Rate-limited queue broadcasting alerts to individual Telegram subscribers based on custom filter criteria and public Telegram channels.

---

## Screenshots

<p align="center">
  <img src="./assets/demo1.png" width="280" alt="Live Feed" />
  <img src="./assets/demo2.png" width="280" alt="Filter Configuration" />
  <img src="./assets/demo3.png" width="280" alt="Premium Screen" />
</p>

---

## Architecture & Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                  Mantle Network WebSocket                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Block Logs)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Tag Classification                        │
│    (Whale Swap, LP, Arbitrage, Transfer, Staking)           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Price & Value Resolution                     │
│         (Pyth Oracle / Merchant Moe DEX Router)             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Gemini AI Commentary                       │
│              (Multi-Key Rotation Engine)                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase / PostgreSQL DB                    │
└──────────────────────┬──────────────────────┬───────────────┘
                       │                      │
                       ▼                      ▼
┌──────────────────────────────┐    ┌──────────────────────────┐
│  Telegram Broadcast Engine   │    │  Express REST API Server │
│   (Users & Public Channel)   │    │   (Telegram Mini App)    │
└──────────────────────────────┘    └──────────────────────────┘
```

---

## Setup & Local Installation Guide

### Prerequisites

- Node.js (v20.0.0 or higher)
- PostgreSQL / Supabase Database instance
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- Google Gemini API Key(s)

---

### Backend Setup (`mantleflow-backend`)

1. **Navigate to backend directory**
   ```bash
   cd mantleflow-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in `mantleflow-backend/`:
   ```env
   PORT=5000
   JWT_SECRET=your_jwt_secret_key
   SUBSCRIPTION_CONTRACT_ADDRESS=0xA89325be3f211A355DDeE3f5Ddb8325ceE8baBea
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   GEMINI_API_KEYS=your_gemini_key_1,your_gemini_key_2
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   DATABASE_URL=postgresql://postgres:password@localhost:5432/mantleflow
   MANTLE_RPC_WS=wss://rpc.mantle.xyz
   MANTLE_RPC_HTTP=https://rpc.mantle.xyz
   MANTLE_CHAIN_ID=5000
   ```

4. **Start the backend server**
   ```bash
   npm run start
   ```

---

### Frontend Setup (`mantleflow-frontend`)

1. **Navigate to frontend directory**
   ```bash
   cd mantleflow-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env.local` file in `mantleflow-frontend/`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   NEXT_PUBLIC_SUBSCRIPTION_CONTRACT=0xA89325be3f211A355DDeE3f5Ddb8325ceE8baBea
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

---

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Framer Motion, Wagmi, RainbowKit, Viem
- **Backend**: Node.js (ESM), Express.js, Telegraf, Ethers.js v6, pg (PostgreSQL)
- **AI & Oracles**: Google Gemini 3.5 Flash API, Pyth Network Oracles
- **Network**: Mantle Mainnet / Sepolia Testnet

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

Запросите следующую порцию сообщений, и я пришлю чистый код без единого комментария (с реалистичными демо-заглушками для карточек на фронтенде), разделенный по файлам.
