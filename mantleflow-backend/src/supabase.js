import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: config.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("db pool err", err.message);
});

export async function query(text, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function upsertUser({ telegramId, username, walletAddress }) {
  const rows = await query(
    `INSERT INTO users (telegram_id, username, wallet_address)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id)
     DO UPDATE SET
       username       = EXCLUDED.username,
       wallet_address = EXCLUDED.wallet_address
     RETURNING telegram_id, username, wallet_address, created_at`,
    [String(telegramId), username ?? null, walletAddress]
  );
  return rows[0] ?? null;
}

export async function getUserByTelegramId(telegramId) {
  const rows = await query(
    `SELECT telegram_id, username, wallet_address, created_at
     FROM users WHERE telegram_id = $1`,
    [String(telegramId)]
  );
  return rows[0] ?? null;
}

export async function getUserByWallet(walletAddress) {
  const rows = await query(
    `SELECT telegram_id, username, wallet_address, created_at
     FROM users WHERE wallet_address = LOWER($1)`,
    [walletAddress.toLowerCase()]
  );
  return rows[0] ?? null;
}

export async function getSubscription(walletAddress) {
  const rows = await query(
    `SELECT id, wallet_address, is_active, expires_at, updated_at
     FROM subscriptions WHERE wallet_address = LOWER($1)`,
    [walletAddress.toLowerCase()]
  );
  return rows[0] ?? null;
}

export async function upsertSubscription({ walletAddress, isActive, expiresAt, txHash }) {
  const rows = await query(
    `INSERT INTO subscriptions (wallet_address, is_active, expires_at, tx_hash)
     VALUES (LOWER($1), $2, $3, $4)
     ON CONFLICT (wallet_address)
     DO UPDATE SET
       is_active  = EXCLUDED.is_active,
       expires_at = EXCLUDED.expires_at,
       tx_hash    = EXCLUDED.tx_hash,
       updated_at = now()
     RETURNING wallet_address, is_active, expires_at, updated_at`,
    [walletAddress.toLowerCase(), isActive, expiresAt, txHash || null]
  );
  return rows[0] ?? null;
}

export async function isPremiumWallet(walletAddress) {
  const rows = await query(
    `SELECT 1 FROM subscriptions
     WHERE wallet_address = LOWER($1)
       AND is_active = true
       AND expires_at > now()
     LIMIT 1`,
    [walletAddress.toLowerCase()]
  );
  return rows.length > 0;
}

export async function insertWhaleTransaction(tx) {
  const {
    txHash,
    blockNumber,
    tagType,
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    amountUsd,
    fromAddress,
    toAddress,
    dexName,
    poolAddress,
    aiReport,
    timestamp,
  } = tx;

  try {
    const rows = await query(
      `INSERT INTO whale_transactions
         (tx_hash, block_number, tag_type, token_in, token_out,
          amount_in, amount_out, amount_usd, from_address, to_address,
          dex_name, pool_address, ai_report, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (tx_hash) DO NOTHING
       RETURNING id`,
      [
        txHash, blockNumber, tagType, tokenIn, tokenOut ?? null,
        amountIn.toString(), amountOut ? amountOut.toString() : null,
        amountUsd.toString(), fromAddress.toLowerCase(),
        toAddress ? toAddress.toLowerCase() : null,
        dexName ?? null, poolAddress ? poolAddress.toLowerCase() : null,
        aiReport ?? null, timestamp,
      ]
    );
    return rows[0] ?? null; 
  } catch (err) {
    console.error("db insert tx err", err.message);
    throw err;
  }
}

export async function getUserFilters(telegramId) {
  const rows = await query(
    `SELECT id, telegram_id, min_volume, filter_mode, token_list, category_filters, updated_at
     FROM user_filters WHERE telegram_id = $1`,
    [String(telegramId)]
  );
  return rows[0] ?? null;
}

export async function upsertUserFilters({ telegramId, minVolume, filterMode, tokenList, categoryFilters }) {
  const rows = await query(
    `INSERT INTO user_filters (telegram_id, min_volume, filter_mode, token_list, category_filters)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (telegram_id)
     DO UPDATE SET
       min_volume  = EXCLUDED.min_volume,
       filter_mode = EXCLUDED.filter_mode,
       token_list  = EXCLUDED.token_list,
       category_filters = COALESCE(EXCLUDED.category_filters, user_filters.category_filters),
       updated_at  = now()
     RETURNING updated_at`,
    [String(telegramId), minVolume ?? 0, filterMode, tokenList, categoryFilters ? JSON.stringify(categoryFilters) : null]
  );
  return rows[0] ?? null;
}

export async function getMatchedUserIds({ amountUsd, tokenInAddress, tokenOutAddress, tagKey, offset = 0, limit = 100 }) {
  const rows = await query(
    `SELECT uf.telegram_id
     FROM user_filters uf
     WHERE (uf.category_filters -> $6 ->> 'enabled')::boolean = true
       AND (uf.category_filters -> $6 ->> 'minVolume')::numeric <= $1
       AND (
         uf.filter_mode = 'ALL'
         OR (
           uf.filter_mode = 'INCLUDE_ONLY'
           AND (
             $2 = ANY(uf.token_list)
             OR ($3::text IS NOT NULL AND $3 = ANY(uf.token_list))
           )
         )
         OR (
           uf.filter_mode = 'EXCLUDE'
           AND NOT (
             $2 = ANY(uf.token_list)
             OR ($3::text IS NOT NULL AND $3 = ANY(uf.token_list))
           )
         )
       )
     ORDER BY uf.telegram_id
     LIMIT $4 OFFSET $5`,
    [amountUsd, tokenInAddress.toLowerCase(), tokenOutAddress ? tokenOutAddress.toLowerCase() : null, limit, offset, tagKey]
  );
  return rows.map((r) => r.telegram_id);
}

export async function dbHealthCheck() {
  const rows = await query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
}

export default pool;