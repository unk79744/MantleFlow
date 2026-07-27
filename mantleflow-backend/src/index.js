import express from "express";
import cors from "cors";
import crypto from "crypto";
import { ethers } from "ethers";
import { config } from "./config.js";
import pool, { 
  dbHealthCheck, 
  query, 
  upsertUser,
  getUserByTelegramId, 
  getSubscription, 
  upsertSubscription,
  getUserFilters, 
  upsertUserFilters,
  isPremiumWallet
} from "./supabase.js";
import { startScanner, stopScanner } from "./scanner.js";
import { startBot, bot } from "./bot.js";

const app = express();
let server;

app.use(cors());
app.use(express.json());

function validateInitData(initData, botToken) {
  if (!initData) return false;
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    const keys = Array.from(urlParams.keys()).sort();
    let dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return calculatedHash === hash;
  } catch (e) {
    return false;
  }
}

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "MantleFlow is running" });
});

app.get("/api/transactions", async (req, res) => {
  try {
    const rows = await query(`
      SELECT tx_hash, tag_type, amount_usd, timestamp, token_in, token_out, amount_in, amount_out, ai_report, from_address
      FROM whale_transactions
      ORDER BY timestamp DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    console.error("api tx err", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/user/:telegramId", async (req, res) => {
  try {
    const { telegramId } = req.params;
    const dbUser = await getUserByTelegramId(telegramId);
    
    if (!dbUser) {
      return res.json({ exists: false });
    }

    const sub = await getSubscription(dbUser.wallet_address);
    const filters = await getUserFilters(telegramId);
    const isPremium = sub?.is_active && new Date(sub.expires_at) > new Date();

    res.json({
      exists: true,
      walletAddress: dbUser.wallet_address,
      isPremium,
      filters: filters || { filter_mode: "ALL", min_volume: 0, token_list: [] }
    });
  } catch (err) {
    console.error("api user err", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/user", async (req, res) => {
  try {
    const { telegramId, walletAddress, signature, initData } = req.body;
    
    if (!telegramId || !walletAddress || !signature || !initData) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!validateInitData(initData, config.TELEGRAM_BOT_TOKEN)) {
      return res.status(403).json({ error: "Invalid Telegram initData" });
    }

    const message = `Verify wallet ownership for Telegram ID: ${telegramId}`;
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (err) {
      return res.status(400).json({ error: "Signature verification failed" });
    }

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(400).json({ error: "Signature does not match wallet address" });
    }

    await upsertUser({ telegramId, walletAddress });
    const isPremium = await isPremiumWallet(walletAddress);
    
    res.json({ success: true, isPremium });
  } catch (err) {
    console.error("api user post err", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/subscribe", async (req, res) => {
  try {
    const { telegramId, txHash, initData } = req.body;

    if (!telegramId || !txHash || !initData) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!validateInitData(initData, config.TELEGRAM_BOT_TOKEN)) {
      return res.status(403).json({ error: "Invalid Telegram initData" });
    }

    const dbUser = await getUserByTelegramId(telegramId);
    if (!dbUser) {
      return res.status(404).json({ error: "User not found. Connect wallet first." });
    }

    const provider = new ethers.JsonRpcProvider(config.MANTLE_RPC_HTTP, config.MANTLE_CHAIN_ID);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt || receipt.status !== 1) {
      return res.status(400).json({ error: "Transaction pending or failed" });
    }

    if (receipt.to.toLowerCase() !== config.SUBSCRIPTION_CONTRACT_ADDRESS.toLowerCase()) {
      return res.status(400).json({ error: "Transaction was not sent to the subscription contract" });
    }

    const eventTopic = ethers.id("SubscriptionPurchased(address,uint256)");
    const log = receipt.logs.find(l => l.topics[0] === eventTopic);
    
    if (!log) {
      return res.status(400).json({ error: "No SubscriptionPurchased event found in transaction" });
    }

    const payerAddress = "0x" + log.topics[1].slice(26);
    if (payerAddress.toLowerCase() !== dbUser.wallet_address.toLowerCase()) {
      return res.status(400).json({ error: "Payer address does not match the linked wallet" });
    }

    const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data);
    const expiresAt = new Date(Number(decodedData[0]) * 1000).toISOString();

    await upsertSubscription({
      walletAddress: dbUser.wallet_address,
      isActive: true,
      expiresAt: expiresAt,
      txHash: txHash
    });

    res.json({ success: true, expiresAt });
  } catch (err) {
    if (err.message.includes("unique constraint") || err.code === '23505') {
      return res.status(400).json({ error: "Double spend detected: this transaction hash was already used." });
    }
    console.error("api sub post err", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/user/filters", async (req, res) => {
  try {
    const { telegramId, minVolume, filterMode, tokenList, categoryFilters } = req.body;
    if (!telegramId) return res.status(400).json({ error: "Missing telegramId" });

    await upsertUserFilters({ telegramId, minVolume, filterMode, tokenList, categoryFilters });
    res.json({ success: true });
  } catch (err) {
    console.error("api filter post err", err.message);
    res.status(500).json({ error: err.message });
  }
});

server = app.listen(config.PORT, "0.0.0.0", () => {
  console.log("express listening port", config.PORT);
  
  bootstrap().catch((err) => {
    console.error("startup fatal err", err.message);
    process.exit(1);
  });
});

async function bootstrap() {
  console.log("starting services mode", config.NODE_ENV);

  console.log("checking db");
  const isDbHealthy = await dbHealthCheck();
  if (!isDbHealthy) throw new Error("Database health check failed.");
  console.log("db connected ok");

  console.log("starting bot");
  await startBot();

  console.log("starting scanner");
  await startScanner();

  console.log("backend fully up");
}

async function shutdown(signal) {
  console.log("shutting down signal", signal);
  try {
    if (server) server.close(() => console.log("express closed"));
    stopScanner();
    if (bot) { bot.stop(signal); console.log("bot stopped"); }
    if (pool) { await pool.end(); console.log("db pool closed"); }
    console.log("shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("shutdown err", err.message);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (err) => { console.error("uncaught exception", err); shutdown("uncaughtException"); });
process.on("unhandledRejection", (reason, promise) => { console.error("unhandled rejection", reason); shutdown("unhandledRejection"); });