import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { config } from "./config.js";

const models = config.GEMINI_API_KEYS.map(key => {
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({
    model: config.GEMINI_MODEL,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
    generationConfig: {
      maxOutputTokens: 80,
      temperature: 0.9,
      topP: 0.95,
    },
  });
});

let currentModelIndex = 0;

const SYSTEM_PROMPT = `You are MantleFlow AI, a sharp on-chain analyst for Mantle Network.
Your ONLY job: write EXACTLY ONE sentence of degen-style market commentary in English.
Rules (non-negotiable):
- Exactly 1 sentence, max 20 words.
- Must reference the transaction tag, token symbols, and USD amount.
- Tone: confident, punchy, street-smart crypto analyst. No fluff, no disclaimers.
- Do NOT start with "I", "The", or "A whale".
- End with a period. Do NOT use emojis.
- Do NOT include newlines, markdown, or quotation marks.
Examples:
  "Massive 2.1M mETH->USDY swap on Agni just printed — liquidity is rotating hard."
  "450K staking deposit into Mantle signals serious conviction from this address."
  "Classic arb run across Merchant Moe and Agni — spread is tightening fast."
`;

const FALLBACK_COMMENTS = {
  "Whale Swap": [
    "Huge swap detected on Mantle — someone is repositioning serious capital.",
    "Big block swap just cleared — market makers are watching this one closely.",
    "Monster swap on Mantle DEX — this wallet doesn't mess around.",
  ],
  "Liquidity Provision": [
    "Deep liquidity being seeded — this LP knows where the volume flows.",
    "Major liquidity event on Mantle — someone is farming at scale.",
    "LP deposit signals long-term conviction in this trading pair.",
  ],
  "Arbitrage Run": [
    "Classic arb across Mantle DEXes — spread hunters never sleep.",
    "Multi-hop arbitrage triggered — efficiency maximalists at work.",
    "Arb bot just extracted alpha across Mantle pools.",
  ],
  "Large Transfer": [
    "Nine-figure transfer on Mantle — cold storage or OTC deal?",
    "Large wallet migration detected — follow the smart money.",
    "Significant on-chain movement — this address is making moves.",
  ],
  "Staking Deposit": [
    "Staking deposit locked — long-term conviction on full display.",
    "Yield farmer going heavy on Mantle staking — accumulation mode activated.",
    "Big staking position opened — someone is not selling anytime soon.",
  ],
};

function getFallback(tag) {
  const bank = FALLBACK_COMMENTS[tag] ?? FALLBACK_COMMENTS["Large Transfer"];
  return bank[Math.floor(Math.random() * bank.length)];
}

class RateLimiter {
  constructor(requestsPerMinute = 60) {
    this.queue = [];
    this.interval = (60_000 / requestsPerMinute);
    this._schedule();
  }

  _schedule() {
    setInterval(() => {
      if (this.queue.length > 0) {
        const { resolve, fn } = this.queue.shift();
        fn().then(resolve).catch(resolve);
      }
    }, this.interval);
  }

  async enqueue(fn) {
    return new Promise((resolve) => {
      this.queue.push({ resolve, fn });
    });
  }
}

const rateLimiter = new RateLimiter(55 * models.length);

async function withKeyRotationAndRetry(fnToGenerate, maxAttempts = models.length * 2) {
  let lastErr;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const model = models[currentModelIndex];
    currentModelIndex = (currentModelIndex + 1) % models.length;

    try {
      return await fnToGenerate(model);
    } catch (err) {
      lastErr = err;
      const isRateLimit = err?.message?.includes("429") || err?.message?.toLowerCase().includes("quota") || err?.status === 429;
      
      if (isRateLimit) {
        console.warn("ai key 429 retry", attempt);
        continue;
      } else {
        const delay = 1_000 * attempt;
        console.warn("ai attempt fail", err.message);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

export async function generateAiCommentary(params) {
  const { tag, tokenInSymbol, tokenOutSymbol, amountUsd, dexName, poolAddress } = params;

  const usdFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amountUsd);

  const userPrompt = [
    `Transaction tag: ${tag}`,
    `Token in: ${tokenInSymbol}`,
    tokenOutSymbol ? `Token out: ${tokenOutSymbol}` : null,
    `USD value: ${usdFormatted}`,
    dexName ? `DEX: ${dexName}` : null,
    poolAddress ? `Pool: ${poolAddress.slice(0, 10)}…` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  try {
    const commentary = await rateLimiter.enqueue(() =>
      withKeyRotationAndRetry(async (model) => {
        const result = await model.generateContent([
          { text: SYSTEM_PROMPT },
          { text: userPrompt },
        ]);
        const text = result.response.text()?.trim();
        if (!text || text.length < 10) throw new Error("Empty or too-short Gemini response");
        return text.replace(/^["']|["']$/g, "");
      })
    );
    return commentary;
  } catch (err) {
    console.error("ai retry out fallback used", err.message);
    return getFallback(tag);
  }
}