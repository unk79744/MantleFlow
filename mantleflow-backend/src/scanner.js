import { ethers } from "ethers";
import { config, LOG_TOPICS, KNOWN_DEX_MAP, ERC20_ABI, STAKING_TOKENS } from "./config.js";
import { insertWhaleTransaction, getMatchedUserIds } from "./supabase.js";
import { generateAiCommentary } from "./ai.js";
import { bot, broadcastToUser } from "./bot.js";

const CHANNEL_TARGET_TOKENS = new Set([
  "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8",
  "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000",
  "0xcda86a272531e8640cd7f1a92c01839911b90bb0",
  "0x5be26527e817998a7206475496fde1e68957c5a6",
  "0xc96de26018a54d51c097160568752c4e3bd6c364",
  "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9",
  "0x201eba5cc46d216ce6dc03f6a759e8e766e956ae",
]);

let provider = null;
let reconnectTimer = null;
let isRunning = false;

const RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 120_000;
let reconnectAttempts = 0;

function buildProvider() {
  const ws = new ethers.WebSocketProvider(config.MANTLE_RPC_WS, {
    chainId: config.MANTLE_CHAIN_ID,
    name: "mantle",
  });

  ws.websocket.on("close", (code) => {
    console.warn("ws closed retry in", Math.round(RECONNECT_DELAY_MS / 1000), "s");
    scheduleReconnect();
  });

  ws.websocket.on("error", (err) => {
    console.error("ws err", err.message);
  });

  return ws;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(
    RECONNECT_DELAY_MS * 2 ** reconnectAttempts + Math.random() * 1000,
    MAX_RECONNECT_DELAY_MS
  );
  reconnectAttempts++;
  console.log("reconnect attempt", reconnectAttempts, "delay", Math.round(delay / 1000));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startScanner().catch((err) => {
      console.error("reconnect fail", err.message);
      scheduleReconnect();
    });
  }, delay);
}

const tokenCache = new Map();

async function getTokenMeta(address) {
  const key = address.toLowerCase();
  if (tokenCache.has(key)) return tokenCache.get(key);

  try {
    const contract = new ethers.Contract(address, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([
      contract.symbol().catch(() => "???"),
      contract.decimals().catch(() => 18),
    ]);
    const meta = { symbol, decimals: Number(decimals) };
    tokenCache.set(key, meta);
    return meta;
  } catch {
    const meta = { symbol: "???", decimals: 18 };
    tokenCache.set(key, meta);
    return meta;
  }
}

const priceCache = new Map();

const PYTH_ABI = [
  "function getPriceUnsafe(bytes32 id) view returns (tuple(int64 price, uint64 conf, int32 expo, uint publishTime))",
];

const PYTH_PRICE_IDS = new Map([
  ["0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8", "0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585"],
  ["0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000", "0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585"],
  ["0x201eba5cc46d216ce6dc03f6a759e8e766e956ae", "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b"],
  ["0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9", "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"],
  ["0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111", "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"],
  ["0xcabae6f6ea1ecab08ad02fe02ce9a44f09aebfa2", "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"],
  ["0xcda86a272531e8640cd7f1a92c01839911b90bb0", "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"],
  ["0xe6829d9a7ee3040e1276fa75293bde931859e8fa", "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"],
  ["0x5be26527e817998a7206475496fde1e68957c5a6", "0xe393449f6aff8a4b6d3e1165a7c9ebec103685f3b41e60db4277b5b6d10e7326"],
  ["0xc96de26018a54d51c097160568752c4e3bd6c364", "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"],
  ["0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34", "0x6ec879b1e9963de5ec97e9c5a70ebec103685f3b41e60db4277b5b6d10e7326"]
]);

const MOE_ROUTER_ADDRESS = "0xeaEE7EE68874218c3558b40063c42B82D3E7232a";
const WMNT_ADDRESS = "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8";

const MOE_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)"
];

let httpProvider = null;
function getHttpProvider() {
  if (!httpProvider) {
    httpProvider = new ethers.JsonRpcProvider(config.MANTLE_RPC_HTTP, {
      chainId: config.MANTLE_CHAIN_ID,
      name: "mantle",
    });
  }
  return httpProvider;
}

async function getTokenPriceUsd(tokenAddress) {
  const key = tokenAddress.toLowerCase();
  const cached = priceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.priceUsd;

  try {
    const pythId = PYTH_PRICE_IDS.get(key);
    if (pythId) {
      const pyth = new ethers.Contract(config.PYTH_ADDRESS_MANTLE, PYTH_ABI, getHttpProvider());
      const raw = await pyth.getPriceUnsafe(pythId);
      const priceUsd = Number(raw.price) * 10 ** Number(raw.expo);
      priceCache.set(key, { priceUsd, expiresAt: Date.now() + config.PRICE_CACHE_TTL_MS });
      return priceUsd;
    }
  } catch (err) {
    console.warn("pyth fail", key, err.message);
  }

  try {
    if (key !== WMNT_ADDRESS) {
      const router = new ethers.Contract(MOE_ROUTER_ADDRESS, MOE_ROUTER_ABI, getHttpProvider());
      const tokenMeta = await getTokenMeta(tokenAddress);
      
      const amountIn = ethers.parseUnits("1", tokenMeta.decimals);
      const path = [tokenAddress, WMNT_ADDRESS];
      
      const amounts = await router.getAmountsOut(amountIn, path);
      if (amounts && amounts.length >= 2) {
        const wmntAmount = amounts[1];
        
        const wmntPriceUsd = await getTokenPriceUsd(WMNT_ADDRESS);
        const priceUsd = (Number(wmntAmount) / 10 ** 18) * wmntPriceUsd;
        
        priceCache.set(key, { priceUsd, expiresAt: Date.now() + config.PRICE_CACHE_TTL_MS });
        return priceUsd;
      }
    }
  } catch (err) {
    console.warn("dex price fail", key, err.message);
  }

  return 0;
}

function classifyTransactions(grouped) {
  const results = [];

  for (const [txHash, logs] of grouped) {
    const swapLogs = logs.filter((l) => l.type === "swap");
    const mintBurnLogs = logs.filter((l) => l.type === "mint" || l.type === "burn");
    const transferLogs = logs.filter((l) => l.type === "transfer");
    const stakingLogs = logs.filter((l) => l.type === "staking");

    if (swapLogs.length === 1 && mintBurnLogs.length === 0) {
      const swap = swapLogs[0];
      if (KNOWN_DEX_MAP.has(swap.poolAddress?.toLowerCase())) {
        results.push({ txHash, tag: "Whale Swap", primaryLog: swap, allLogs: logs });
        continue;
      }
    }

    if (mintBurnLogs.length > 0) {
      results.push({ txHash, tag: "Liquidity Provision", primaryLog: mintBurnLogs[0], allLogs: logs });
      continue;
    }

    if (swapLogs.length >= 2) {
      const uniquePools = new Set(swapLogs.map((l) => l.poolAddress?.toLowerCase()).filter(Boolean));
      if (uniquePools.size >= 2) {
        results.push({ txHash, tag: "Arbitrage Run", primaryLog: swapLogs[0], allLogs: logs });
        continue;
      }
    }

    if (stakingLogs.length > 0) {
      results.push({ txHash, tag: "Staking Deposit", primaryLog: stakingLogs[0], allLogs: logs });
      continue;
    }

    if (transferLogs.length > 0) {
      const relevantTransfers = transferLogs.filter((l) =>
        STAKING_TOKENS.has(l.tokenAddress?.toLowerCase())
      );
      if (relevantTransfers.length > 0) {
        results.push({ txHash, tag: "Large Transfer", primaryLog: relevantTransfers[0], allLogs: logs });
        continue;
      }
    }
  }

  return results;
}

function decodeLog(rawLog) {
  const topic0 = rawLog.topics[0]?.toLowerCase();

  if (topic0 === LOG_TOPICS.SWAP_V2 || topic0 === LOG_TOPICS.SWAP_V3) {
    return {
      type: "swap",
      txHash: rawLog.transactionHash,
      blockNumber: Number(rawLog.blockNumber),
      poolAddress: rawLog.address,
      fromAddress: rawLog.topics[1] ? "0x" + rawLog.topics[1].slice(26) : null,
      toAddress: rawLog.topics[rawLog.topics.length - 1]
        ? "0x" + rawLog.topics[rawLog.topics.length - 1].slice(26)
        : null,
      rawData: rawLog.data,
      dexName: KNOWN_DEX_MAP.get(rawLog.address?.toLowerCase()) ?? null,
    };
  }

  if ([LOG_TOPICS.MINT_V2, LOG_TOPICS.MINT_V3].includes(topic0)) {
    return {
      type: "mint",
      txHash: rawLog.transactionHash,
      blockNumber: Number(rawLog.blockNumber),
      poolAddress: rawLog.address,
      fromAddress: rawLog.topics[1] ? "0x" + rawLog.topics[1].slice(26) : null,
      rawData: rawLog.data,
    };
  }

  if ([LOG_TOPICS.BURN_V2, LOG_TOPICS.BURN_V3].includes(topic0)) {
    return {
      type: "burn",
      txHash: rawLog.transactionHash,
      blockNumber: Number(rawLog.blockNumber),
      poolAddress: rawLog.address,
      fromAddress: rawLog.topics[1] ? "0x" + rawLog.topics[1].slice(26) : null,
      rawData: rawLog.data,
    };
  }

  if (topic0 === LOG_TOPICS.TRANSFER) {
    return {
      type: "transfer",
      txHash: rawLog.transactionHash,
      blockNumber: Number(rawLog.blockNumber),
      tokenAddress: rawLog.address,
      fromAddress: rawLog.topics[1] ? "0x" + rawLog.topics[1].slice(26) : null,
      toAddress: rawLog.topics[2] ? "0x" + rawLog.topics[2].slice(26) : null,
      rawAmount: rawLog.data,
    };
  }

  if (topic0 === LOG_TOPICS.STAKING_DEPOSIT) {
    return {
      type: "staking",
      txHash: rawLog.transactionHash,
      blockNumber: Number(rawLog.blockNumber),
      contractAddress: rawLog.address,
      fromAddress: rawLog.topics[1] ? "0x" + rawLog.topics[1].slice(26) : null,
      rawData: rawLog.data,
    };
  }

  return null;
}

async function fetchBlockLogs(blockNumber) {
  const blockHex = ethers.toQuantity(blockNumber);

  const allTopics = [
    LOG_TOPICS.SWAP_V2, LOG_TOPICS.SWAP_V3,
    LOG_TOPICS.MINT_V2, LOG_TOPICS.MINT_V3,
    LOG_TOPICS.BURN_V2, LOG_TOPICS.BURN_V3,
    LOG_TOPICS.TRANSFER,
    LOG_TOPICS.STAKING_DEPOSIT,
  ];

  try {
    const logs = await provider.send("eth_getLogs", [
      {
        fromBlock: blockHex,
        toBlock: blockHex,
        topics: [allTopics],
      },
    ]);
    return Array.isArray(logs) ? logs : [];
  } catch (err) {
    console.error("getlogs fail block", blockNumber, err.message);
    return [];
  }
}

async function resolveTransactionValue(classified) {
  const { tag, primaryLog } = classified;

  let tokenInAddress = null;
  let tokenOutAddress = null;
  let amountIn = 0n;
  let amountOut = null;

  try {
    if (tag === "Whale Swap" || tag === "Arbitrage Run") {
      tokenInAddress = primaryLog.poolAddress;
      const data = primaryLog.rawData;
      if (data && data.length >= 66) {
        amountIn = BigInt(data.slice(0, 66));
        amountOut = BigInt("0x" + data.slice(66, 130));
      }
    } else if (tag === "Large Transfer" || tag === "Staking Deposit") {
      tokenInAddress = primaryLog.tokenAddress ?? primaryLog.contractAddress;
      if (primaryLog.rawAmount) {
        amountIn = BigInt(primaryLog.rawAmount);
      }
    } else if (tag === "Liquidity Provision") {
      tokenInAddress = primaryLog.poolAddress;
    }
  } catch {
  }

  const tokenInMeta = tokenInAddress ? await getTokenMeta(tokenInAddress) : { symbol: "???", decimals: 18 };
  const tokenOutMeta = tokenOutAddress ? await getTokenMeta(tokenOutAddress) : null;

  let amountUsd = 0;
  if (tokenInAddress) {
    const priceUsd = await getTokenPriceUsd(tokenInAddress);
    const humanAmount = Number(amountIn) / 10 ** tokenInMeta.decimals;
    amountUsd = humanAmount * priceUsd;
  }

  return {
    tokenInAddress: tokenInAddress ?? "0x0000000000000000000000000000000000000000",
    tokenOutAddress: tokenOutAddress ?? null,
    tokenInSymbol: tokenInMeta.symbol,
    tokenOutSymbol: tokenOutMeta?.symbol ?? null,
    amountIn,
    amountOut,
    amountUsd,
  };
}

async function fanOutAndBroadcast(transaction, composedMessage) {
  let offset = 0;
  const { amountUsd, tokenInAddress, tokenOutAddress, tagType } = transaction;

  const TAG_TO_KEY = {
    "Whale Swap": "whaleSwap",
    "Liquidity Provision": "liquidityProvision",
    "Arbitrage Run": "arbitrageRun",
    "Large Transfer": "largeTransfer",
    "Staking Deposit": "stakingDeposit"
  };
  const tagKey = TAG_TO_KEY[tagType] || "largeTransfer";

  while (true) {
    const telegramIds = await getMatchedUserIds({
      amountUsd,
      tokenInAddress,
      tokenOutAddress,
      tagKey,
      offset,
      limit: config.TG_BROADCAST_BATCH_SIZE,
    });

    if (telegramIds.length === 0) break;

    for (const telegramId of telegramIds) {
      await broadcastToUser(telegramId, composedMessage);
      await new Promise((r) => setTimeout(r, Math.ceil(1000 / config.TG_BROADCAST_RATE_PER_SEC)));
    }

    offset += telegramIds.length;
    if (telegramIds.length < config.TG_BROADCAST_BATCH_SIZE) break;
  }
}

function buildMessage(tx, aiCommentary) {
  const TAG_PREFIX = {
    "Whale Swap": "[SWAP]",
    "Liquidity Provision": "[LP]",
    "Arbitrage Run": "[ARB]",
    "Large Transfer": "[XFER]",
    "Staking Deposit": "[STAKE]",
  };

  const prefix = TAG_PREFIX[tx.tagType] ?? "[ALERT]";
  const usd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(tx.amountUsd);

  const tokenLine = tx.tokenOutAddress
    ? `${tx.tokenInSymbol} -> ${tx.tokenOutSymbol}`
    : tx.tokenInSymbol;

  return (
    `*${prefix} ${tx.tagType}*\n` +
    `USD: ${usd} | ${tokenLine}\n` +
    `[Explorer](https://explorer.mantle.xyz/tx/${tx.txHash})\n\n` +
    `_${aiCommentary}_`
  );
}

async function processTransaction(classified, blockNumber, blockTimestamp) {
  const { txHash, tag, primaryLog } = classified;

  const resolved = await resolveTransactionValue(classified);

  const threshold =
    tag === "Whale Swap" || tag === "Arbitrage Run"
      ? config.MIN_USD_VOLUME_WHALE_SWAP
      : tag === "Staking Deposit"
      ? config.MIN_USD_VOLUME_STAKING
      : config.MIN_USD_VOLUME_TRANSFER;

  if (resolved.amountUsd < threshold) {
    return;
  }

  const dexName = primaryLog.dexName ?? null;
  const poolAddress = primaryLog.poolAddress ?? null;

  const [aiReport, dbRow] = await Promise.all([
    generateAiCommentary({
      tag,
      tokenInSymbol: resolved.tokenInSymbol,
      tokenOutSymbol: resolved.tokenOutSymbol,
      amountUsd: resolved.amountUsd,
      dexName,
      poolAddress,
    }),
    insertWhaleTransaction({
      txHash,
      blockNumber,
      tagType: tag,
      tokenIn: resolved.tokenInAddress,
      tokenOut: resolved.tokenOutAddress,
      amountIn: resolved.amountIn,
      amountOut: resolved.amountOut,
      amountUsd: resolved.amountUsd,
      fromAddress: primaryLog.fromAddress ?? "0x0000000000000000000000000000000000000000",
      toAddress: primaryLog.toAddress ?? null,
      dexName,
      poolAddress,
      aiReport: null,
      timestamp: new Date(blockTimestamp * 1000).toISOString(),
    }).catch((err) => {
      console.error("db insert tx fail", txHash, err.message);
      return null;
    }),
  ]);

  if (!dbRow) return;

  const fullTx = {
    txHash,
    tagType: tag,
    tokenInSymbol: resolved.tokenInSymbol,
    tokenOutSymbol: resolved.tokenOutSymbol,
    tokenInAddress: resolved.tokenInAddress,
    tokenOutAddress: resolved.tokenOutAddress,
    amountUsd: resolved.amountUsd,
  };

  const message = buildMessage(fullTx, aiReport);

  await fanOutAndBroadcast(
    {
      amountUsd: resolved.amountUsd,
      tokenInAddress: resolved.tokenInAddress,
      tokenOutAddress: resolved.tokenOutAddress,
      tagType: tag,
    },
    message
  );

  if (config.TG_CHANNEL_ID && resolved.amountUsd >= config.MIN_USD_VOLUME_CHANNEL) {
    const involvesTargetToken = CHANNEL_TARGET_TOKENS.has(resolved.tokenInAddress?.toLowerCase()) || 
                                (resolved.tokenOutAddress && CHANNEL_TARGET_TOKENS.has(resolved.tokenOutAddress?.toLowerCase()));
    
    if (involvesTargetToken) {
        bot.telegram.sendMessage(config.TG_CHANNEL_ID, message, {
          parse_mode: "Markdown",
          disable_web_page_preview: true
        }).catch(err => console.error("chan bcast fail", err.message));
    }
  }

  console.log("processed tx", tag, txHash.slice(0, 10), Math.round(resolved.amountUsd));
}

async function processBlock(blockNumber) {
  console.log("block", blockNumber);

  const rawLogs = await fetchBlockLogs(blockNumber);
  if (rawLogs.length === 0) return;

  const grouped = new Map();
  for (const rawLog of rawLogs) {
    const decoded = decodeLog(rawLog);
    if (!decoded) continue;
    const key = rawLog.transactionHash;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(decoded);
  }

  const classified = classifyTransactions(grouped);
  if (classified.length === 0) return;

  let blockTimestamp = Math.floor(Date.now() / 1000);
  try {
    const block = await provider.getBlock(blockNumber);
    if (block) blockTimestamp = block.timestamp;
  } catch {
  }

  await Promise.allSettled(
    classified.map((tx) =>
      processTransaction(tx, blockNumber, blockTimestamp).catch((err) => {
        console.error("tx proc err", tx.txHash, err.message);
      })
    )
  );
}

export async function startScanner() {
  if (isRunning) {
    console.log("scanner already running");
    return;
  }

  console.log("connecting ws", config.MANTLE_RPC_WS);
  provider = buildProvider();

  provider.on("block", async (blockNumber) => {
    try {
      await processBlock(blockNumber);
      reconnectAttempts = 0;
    } catch (err) {
      console.error("block proc err", blockNumber, err.message);
    }
  });

  isRunning = true;
  console.log("scanner up mantle chain");
}

export function stopScanner() {
  if (provider) {
    provider.destroy();
    provider = null;
  }
  isRunning = false;
  console.log("scanner stopped");
}