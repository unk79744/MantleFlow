import "dotenv/config";

function require_env(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`missing env ${name}`);
  }
  return value.trim();
}

function optional_env(name, fallback) {
  return process.env[name]?.trim() || fallback;
}

function require_env_array(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`missing env ${name}`);
  }
  const arr = value.split(",").map(k => k.trim()).filter(Boolean);
  if (arr.length === 0) {
    throw new Error(`env ${name} needs valid key`);
  }
  return arr;
}

export const config = {
  NODE_ENV: optional_env("NODE_ENV", "production"),
  PORT: parseInt(optional_env("PORT", "5000"), 10),

  TELEGRAM_BOT_TOKEN: require_env("TELEGRAM_BOT_TOKEN"),
  TG_CHANNEL_ID: optional_env("TG_CHANNEL_ID", ""),

  MANTLE_RPC_WS: optional_env("MANTLE_RPC_WS", "wss://rpc.mantle.xyz"),
  MANTLE_RPC_HTTP: optional_env("MANTLE_RPC_HTTP", "https://rpc.mantle.xyz"),
  MANTLE_CHAIN_ID: parseInt(optional_env("MANTLE_CHAIN_ID", "5000"), 10),

  SUPABASE_URL: require_env("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: require_env("SUPABASE_SERVICE_ROLE_KEY"),
  DATABASE_URL: require_env("DATABASE_URL"),

  JWT_SECRET: require_env("JWT_SECRET"),
  JWT_EXPIRES_IN: optional_env("JWT_EXPIRES_IN", "30d"),

  GEMINI_API_KEYS: require_env_array("GEMINI_API_KEYS"),
  GEMINI_MODEL: optional_env("GEMINI_MODEL", "gemini-3.5-flash"),

  MIN_USD_VOLUME_WHALE_SWAP: parseInt(optional_env("MIN_USD_VOLUME_WHALE_SWAP", "50000"), 10),
  MIN_USD_VOLUME_TRANSFER: parseInt(optional_env("MIN_USD_VOLUME_TRANSFER", "100000"), 10),
  MIN_USD_VOLUME_STAKING: parseInt(optional_env("MIN_USD_VOLUME_STAKING", "25000"), 10),
  MIN_USD_VOLUME_CHANNEL: parseInt(optional_env("MIN_USD_VOLUME_CHANNEL", "50000"), 10),
  PRICE_CACHE_TTL_MS: parseInt(optional_env("PRICE_CACHE_TTL_MS", "30000"), 10),

  TG_BROADCAST_RATE_PER_SEC: parseInt(optional_env("TG_BROADCAST_RATE_PER_SEC", "30"), 10),
  TG_BROADCAST_BATCH_SIZE: parseInt(optional_env("TG_BROADCAST_BATCH_SIZE", "100"), 10),

  SUBSCRIPTION_CONTRACT_ADDRESS: require_env("SUBSCRIPTION_CONTRACT_ADDRESS"),

  MERCHANT_MOE_FACTORY: optional_env("MERCHANT_MOE_FACTORY", ""),
  AGNI_FACTORY: optional_env("AGNI_FACTORY", ""),

  PYTH_ADDRESS_MANTLE: optional_env("PYTH_ADDRESS_MANTLE", "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729"),
};

export const KNOWN_DEX_MAP = new Map([
  ...(config.MERCHANT_MOE_FACTORY
    ? [[config.MERCHANT_MOE_FACTORY.toLowerCase(), "Merchant Moe"]]
    : []),
  ...(config.AGNI_FACTORY
    ? [[config.AGNI_FACTORY.toLowerCase(), "Agni"]]
    : []),
]);

export const SUBSCRIPTION_ABI = [
  "event SubscriptionPurchased(address indexed wallet, uint256 expiresAt)",
  "function isActive(address wallet) view returns (bool)",
  "function expiresAt(address wallet) view returns (uint256)",
];

export const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export const LOG_TOPICS = {
  SWAP_V2: "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
  SWAP_V3: "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
  MINT_V2: "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f",
  BURN_V2: "0xdccd412f0b1252819cb1fd330b93224ca42612892bb3f4f789976e6d81936496",
  MINT_V3: "0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde",
  BURN_V3: "0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c",
  TRANSFER: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  STAKING_DEPOSIT: "0x9c9e5a4e8a84c07a7bdb8babd3bb0c3b6ee91a0f8a5e87d97d4d8b6a5e5bb0c",
};

export const STAKING_TOKENS = new Set([
  "0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8",
  "0xcda86a272531e8640cd7f1a92c01839911b90bb0",
]);

console.log("cfg ready port", config.PORT, "chain", config.MANTLE_CHAIN_ID, "keys", config.GEMINI_API_KEYS.length);