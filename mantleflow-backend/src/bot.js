import { Telegraf, Markup, session } from "telegraf";
import { ethers } from "ethers";
import { config, SUBSCRIPTION_ABI } from "./config.js";
import {
  query, 
  getUserByTelegramId,
  getSubscription,
  upsertSubscription,
  getUserFilters,
  upsertUserFilters,
  isPremiumWallet,
} from "./supabase.js";

export const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);
bot.use(session());

const httpProvider = new ethers.JsonRpcProvider(config.MANTLE_RPC_HTTP, {
  chainId: config.MANTLE_CHAIN_ID,
  name: "mantle",
});

const subscriptionContract = new ethers.Contract(
  config.SUBSCRIPTION_CONTRACT_ADDRESS,
  SUBSCRIPTION_ABI,
  httpProvider
);

function escapeMarkdown(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

async function verifyPremiumOnChain(walletAddress) {
  try {
    const [isActive, expiresAtRaw] = await Promise.all([
      subscriptionContract.isActive(walletAddress),
      subscriptionContract.expiresAt(walletAddress),
    ]);
    return {
      isActive: Boolean(isActive),
      expiresAt: new Date(Number(expiresAtRaw) * 1000),
    };
  } catch (err) {
    console.error("bot chain check err", err.message);
    return { isActive: false, expiresAt: null };
  }
}

const FILTER_MODES = {
  ALL: { label: "All tokens", value: "ALL" },
  INCLUDE_ONLY: { label: "Include only", value: "INCLUDE_ONLY" },
  EXCLUDE: { label: "Exclude tokens", value: "EXCLUDE" },
};

const MIN_VOLUME_PRESETS = [
  { label: "$10K", value: 10_000 },
  { label: "$50K", value: 50_000 },
  { label: "$100K", value: 100_000 },
  { label: "$500K", value: 500_000 },
  { label: "$1M", value: 1_000_000 },
];

bot.start(async (ctx) => {
  const user = ctx.from;
  const firstName = escapeMarkdown(user.first_name ?? "Degen");

  await ctx.replyWithMarkdownV2(
    `*Welcome to MantleFlow*, ${firstName}\\!\n\n` +
      `I monitor whale transactions on Mantle Network in real\\-time and send you instant alerts\\.\n\n` +
      `*What I track:*\n` +
      `Whale Swaps\n` +
      `Liquidity Provisions\n` +
      `Arbitrage Runs\n` +
      `Large Transfers\n` +
      `Staking Deposits\n\n` +
      `*Getting started:*\n` +
      `1\\. Connect your wallet via the mini\\-app\n` +
      `2\\. Subscribe to unlock advanced filters\n` +
      `3\\. Receive whale alerts directly here\n\n` +
      `Use /status to check your account\\.\nUse /filters to customize alerts\\.\nUse /premium to activate subscription\\.`,
    Markup.keyboard([
      ["My Filters", "Premium Status"],
      ["Recent Activity", "Help"],
    ]).resize()
  );
});

bot.command("status", async (ctx) => {
  const telegramId = String(ctx.from.id);

  try {
    const [dbUser, filters] = await Promise.all([
      getUserByTelegramId(telegramId),
      getUserFilters(telegramId),
    ]);

    if (!dbUser) {
      return ctx.replyWithMarkdownV2(
        "Account not found\\. Please connect your wallet via the mini\\-app first\\."
      );
    }

    let sub = await getSubscription(dbUser.wallet_address);
    let premiumLine = "No active subscription";

    if (sub?.is_active && new Date(sub.expires_at) > new Date()) {
      const exp = escapeMarkdown(new Date(sub.expires_at).toLocaleDateString("en-US"));
      premiumLine = `Premium active until ${exp}`;
    }

    const filterMode = filters?.filter_mode ?? "ALL";
    const tokenCount = filters?.token_list?.length ?? 0;
    const minVol = filters?.min_volume ?? 0;

    await ctx.replyWithMarkdownV2(
      `*Account Status*\n\n` +
        `Wallet: \`${escapeMarkdown(dbUser.wallet_address.slice(0, 6))}…${escapeMarkdown(dbUser.wallet_address.slice(-4))}\`\n` +
        `${premiumLine}\n\n` +
        `*Filter Settings*\n` +
        `Mode: *${escapeMarkdown(filterMode)}*\n` +
        `Min volume: *$${escapeMarkdown(minVol.toLocaleString())}*\n` +
        `Token list: *${tokenCount} token${tokenCount !== 1 ? "s" : ""}*`
    );
  } catch (err) {
    console.error("status cmd err", err.message);
    await ctx.reply("Error fetching status. Please try again.");
  }
});

async function handlePremiumCommand(ctx) {
  const telegramId = String(ctx.from.id);

  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) {
    return ctx.replyWithMarkdownV2(
      "Connect your wallet first via the mini\\-app, then check your premium status\\."
    );
  }

  const statusMsg = await ctx.reply("Checking on-chain subscription status…");

  try {
    const { isActive, expiresAt } = await verifyPremiumOnChain(dbUser.wallet_address);

    if (isActive && expiresAt) {
      await upsertSubscription({
        walletAddress: dbUser.wallet_address,
        isActive: true,
        expiresAt: expiresAt.toISOString(),
      });
    }

    if (isActive && expiresAt && expiresAt > new Date()) {
      const exp = escapeMarkdown(expiresAt.toLocaleDateString("en-US"));
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        `*Premium Active*\n\nYour subscription is valid until *${exp}*\\.\n\nYou can now use advanced filters with /filters\\.`,
        { parse_mode: "MarkdownV2" }
      );
    } else {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        `*No active subscription found*\n\nPurchase a subscription on Mantle Network via the mini\\-app, then check again to sync\\.`,
        {
          parse_mode: "MarkdownV2",
          ...Markup.inlineKeyboard([
            [Markup.button.url("Subscribe Now", "https://t.me/" + ctx.botInfo.username + "/app")],
          ]),
        }
      );
    }
  } catch (err) {
    console.error("prem check err", err.message);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      "Error checking subscription. Please try again later."
    );
  }
}

bot.command("premium", handlePremiumCommand);
bot.hears("Premium Status", handlePremiumCommand);

bot.hears("Recent Activity", async (ctx) => {
  try {
    const rows = await query(
      `SELECT tx_hash, tag_type, amount_usd, timestamp
       FROM whale_transactions
       ORDER BY timestamp DESC
       LIMIT 5`
    );

    if (!rows || rows.length === 0) {
      return ctx.reply("No recent whale activity found in the database.");
    }

    let msg = "*Recent Whale Activity*\n\n";
    
    for (const row of rows) {
      const usd = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(row.amount_usd);

      const time = new Date(row.timestamp).toLocaleTimeString("en-US", { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const safeTag = escapeMarkdown(row.tag_type);
      const safeUsd = escapeMarkdown(usd);
      const safeTime = escapeMarkdown(time);

      msg += `• *${safeTag}* \\| ${safeUsd} \\| ${safeTime}\n`;
      msg += `  🔗 [View Tx](https://explorer\\.mantle\\.xyz/tx/${row.tx_hash})\n\n`;
    }

    await ctx.replyWithMarkdownV2(msg, { disable_web_page_preview: true });
  } catch (err) {
    console.error("recent act err", err.message);
    await ctx.reply("Error fetching recent activity. Please try again later.");
  }
});

bot.command("filters", async (ctx) => await showFiltersMenu(ctx));
bot.hears("My Filters", async (ctx) => await showFiltersMenu(ctx));

async function showFiltersMenu(ctx) {
  const telegramId = String(ctx.from.id);

  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) {
    return ctx.reply("Connect your wallet first via the mini-app.");
  }

  const currentFilters = await getUserFilters(telegramId);
  const currentMode = currentFilters?.filter_mode ?? "ALL";
  const currentMinVol = currentFilters?.min_volume ?? 0;

  await ctx.replyWithMarkdownV2(
    `*Filter Configuration*\n\n` +
      `Current mode: *${escapeMarkdown(currentMode)}*\n` +
      `Current min volume: *$${escapeMarkdown(currentMinVol.toLocaleString())}*\n\n` +
      `Choose what to configure:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("Filter Mode", "filter_mode_menu"),
        Markup.button.callback("Min Volume", "filter_volume_menu"),
      ],
      [Markup.button.callback("Token List", "filter_tokens_menu")],
      [Markup.button.callback("Reset to Default", "filter_reset")],
    ])
  );
}

bot.action("filter_mode_menu", async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = String(ctx.from.id);

  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return ctx.answerCbQuery("Connect wallet first");

  const isPremium = await isPremiumWallet(dbUser.wallet_address);

  const buttons = Object.values(FILTER_MODES).map((mode) => {
    const needsPremium = mode.value !== "ALL";
    const label = needsPremium && !isPremium ? `${mode.label} (PRO)` : mode.label;
    return [Markup.button.callback(label, `set_mode_${mode.value}`)];
  });

  buttons.push([Markup.button.callback("« Back", "back_to_filters")]);

  await ctx.editMessageText(
    `*Select Filter Mode*\n\n` +
      `• *ALL* — receive all whale alerts\n` +
      `• *INCLUDE ONLY* — only alerts for your token list\n` +
      `• *EXCLUDE* — all except your token list\n\n` +
      `(PRO) = Premium required`,
    { parse_mode: "MarkdownV2", ...Markup.inlineKeyboard(buttons) }
  );
});

bot.action(/^set_mode_(.+)$/, async (ctx) => {
  const mode = ctx.match[1];
  const telegramId = String(ctx.from.id);

  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return ctx.answerCbQuery("Connect wallet first");

  if (mode !== "ALL") {
    const isPremium = await isPremiumWallet(dbUser.wallet_address);
    if (!isPremium) {
      await ctx.answerCbQuery("Premium required for this filter mode");
      return ctx.editMessageText(
        "*Premium Required*\n\nAdvanced filter modes \\(INCLUDE ONLY / EXCLUDE\\) require an active subscription\\.\n\nUse /premium to subscribe\\.",
        {
          parse_mode: "MarkdownV2",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("« Back", "filter_mode_menu")],
          ]),
        }
      );
    }
  }

  const currentFilters = await getUserFilters(telegramId);
  await upsertUserFilters({
    telegramId,
    minVolume: currentFilters?.min_volume ?? 0,
    filterMode: mode,
    tokenList: currentFilters?.token_list ?? [],
    categoryFilters: currentFilters?.category_filters ?? undefined
  });

  await ctx.answerCbQuery(`Mode set to ${mode}`);
  await ctx.editMessageText(
    `Filter mode updated to *${escapeMarkdown(mode)}*`,
    { parse_mode: "MarkdownV2", ...Markup.inlineKeyboard([[Markup.button.callback("« Back to Filters", "back_to_filters")]]) }
  );
});

bot.action("filter_volume_menu", async (ctx) => {
  await ctx.answerCbQuery();

  const buttons = MIN_VOLUME_PRESETS.map((preset) => [
    Markup.button.callback(preset.label, `set_vol_${preset.value}`),
  ]);
  buttons.push([Markup.button.callback("« Back", "back_to_filters")]);

  await ctx.editMessageText(
    `*Select Minimum USD Volume*\n\nOnly receive alerts above this threshold:`,
    { parse_mode: "MarkdownV2", ...Markup.inlineKeyboard(buttons) }
  );
});

bot.action(/^set_vol_(\d+)$/, async (ctx) => {
  const volume = parseInt(ctx.match[1], 10);
  const telegramId = String(ctx.from.id);

  const currentFilters = await getUserFilters(telegramId);
  await upsertUserFilters({
    telegramId,
    minVolume: volume,
    filterMode: currentFilters?.filter_mode ?? "ALL",
    tokenList: currentFilters?.token_list ?? [],
    categoryFilters: currentFilters?.category_filters ?? undefined
  });

  await ctx.answerCbQuery(`Min volume set to $${volume.toLocaleString()}`);
  await ctx.editMessageText(
    `Minimum volume set to *$${escapeMarkdown(volume.toLocaleString())}*`,
    { parse_mode: "MarkdownV2", ...Markup.inlineKeyboard([[Markup.button.callback("« Back to Filters", "back_to_filters")]]) }
  );
});

bot.action("filter_tokens_menu", async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = String(ctx.from.id);

  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const isPremium = await isPremiumWallet(dbUser.wallet_address);
  if (!isPremium) {
    return ctx.editMessageText(
      "*Premium Required*\n\nToken list management requires an active subscription\\.\n\nUse /premium to subscribe\\.",
      {
        parse_mode: "MarkdownV2",
        ...Markup.inlineKeyboard([[Markup.button.callback("« Back", "back_to_filters")]]),
      }
    );
  }

  const currentFilters = await getUserFilters(telegramId);
  const tokenList = currentFilters?.token_list ?? [];

  const listDisplay =
    tokenList.length > 0
      ? tokenList.map((a) => `• \`${escapeMarkdown(a.slice(0, 8))}…\``).join("\n")
      : "_No tokens added yet_";

  if (!ctx.session) ctx.session = {};
  ctx.session.awaitingToken = true;

  await ctx.editMessageText(
    `*Token List*\n\nCurrent tokens \\(${tokenList.length}\\):\n${listDisplay}\n\n` +
      `Reply with a token address to *add* it, or use the buttons below:`,
    {
      parse_mode: "MarkdownV2",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("Clear All Tokens", "filter_tokens_clear")],
        [Markup.button.callback("« Back", "back_to_filters")],
      ]),
    }
  );
});

bot.action("filter_tokens_clear", async (ctx) => {
  await ctx.answerCbQuery("Token list cleared");
  const telegramId = String(ctx.from.id);
  const currentFilters = await getUserFilters(telegramId);
  await upsertUserFilters({
    telegramId,
    minVolume: currentFilters?.min_volume ?? 0,
    filterMode: currentFilters?.filter_mode ?? "ALL",
    tokenList: [],
    categoryFilters: currentFilters?.category_filters ?? undefined
  });
  await ctx.editMessageText(
    "Token list cleared\\.",
    { parse_mode: "MarkdownV2", ...Markup.inlineKeyboard([[Markup.button.callback("« Back", "back_to_filters")]]) }
  );
});

bot.on("text", async (ctx, next) => {
  if (!ctx.session?.awaitingToken) return next();

  const text = ctx.message.text.trim();
  const addressRegex = /^0x[0-9a-fA-F]{40}$/;

  if (!addressRegex.test(text)) {
    return ctx.reply("Invalid address format. Please send a valid 0x… EVM address.");
  }

  const telegramId = String(ctx.from.id);
  const currentFilters = await getUserFilters(telegramId);
  const tokenList = currentFilters?.token_list ?? [];

  if (tokenList.includes(text.toLowerCase())) {
    return ctx.reply("This address is already in your token list.");
  }

  tokenList.push(text.toLowerCase());
  await upsertUserFilters({
    telegramId,
    minVolume: currentFilters?.min_volume ?? 0,
    filterMode: currentFilters?.filter_mode ?? "ALL",
    tokenList,
    categoryFilters: currentFilters?.category_filters ?? undefined
  });

  ctx.session.awaitingToken = false;
  await ctx.reply(`Token \`${text.slice(0, 8)}…\` added to your list. Total: ${tokenList.length} token(s).`, {
    parse_mode: "Markdown",
  });
});

bot.action("filter_reset", async (ctx) => {
  await ctx.answerCbQuery("Filters reset");
  const telegramId = String(ctx.from.id);
  await upsertUserFilters({
    telegramId,
    minVolume: 0,
    filterMode: "ALL",
    tokenList: [],
    categoryFilters: null
  });
  await ctx.editMessageText(
    "*Filters reset to default*\n\nYou will now receive all whale alerts\\.",
    { parse_mode: "MarkdownV2" }
  );
});

bot.action("back_to_filters", async (ctx) => {
  await ctx.answerCbQuery();
  const telegramId = String(ctx.from.id);
  const currentFilters = await getUserFilters(telegramId);
  const currentMode = currentFilters?.filter_mode ?? "ALL";
  const currentMinVol = currentFilters?.min_volume ?? 0;

  await ctx.editMessageText(
    `*Filter Configuration*\n\n` +
      `Current mode: *${escapeMarkdown(currentMode)}*\n` +
      `Current min volume: *$${escapeMarkdown(currentMinVol.toLocaleString())}*\n\n` +
      `Choose what to configure:`,
    {
      parse_mode: "MarkdownV2",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("Filter Mode", "filter_mode_menu"),
          Markup.button.callback("Min Volume", "filter_volume_menu"),
        ],
        [Markup.button.callback("Token List", "filter_tokens_menu")],
        [Markup.button.callback("Reset to Default", "filter_reset")],
      ]),
    }
  );
});

bot.hears("Help", async (ctx) => {
  await ctx.replyWithMarkdownV2(
    `*MantleFlow Help*\n\n` +
      `/start \\— Welcome message\n` +
      `/status \\— View account and filter status\n` +
      `/premium \\— Verify and activate premium subscription\n` +
      `/filters \\— Configure whale alert filters\n\n` +
      `*Premium Features:*\n` +
      `• Include\\/Exclude token lists\n` +
      `• Advanced filter modes\n\n` +
      `*Free Features:*\n` +
      `• All whale alerts \\(no token filter\\)\n` +
      `• Minimum volume threshold\n\n` +
      `Support: @MantleFlowSupport`
  );
});

bot.catch((err, ctx) => {
  console.error("bot update err", err.message);
  ctx.reply("An error occurred. Please try again.").catch(() => {});
});

let broadcastQueue = [];
let broadcastProcessing = false;

async function processBroadcastQueue() {
  if (broadcastProcessing) return;
  broadcastProcessing = true;

  while (broadcastQueue.length > 0) {
    const { telegramId, message, resolve } = broadcastQueue.shift();
    try {
      await bot.telegram.sendMessage(telegramId, message, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    } catch (err) {
      if (err.code === 403 || err.code === 400) {
        console.warn("send fail", telegramId, err.description);
      } else {
        console.error("bcast err", telegramId, err.message);
      }
    }
    resolve();
    await new Promise((r) => setTimeout(r, Math.ceil(1000 / config.TG_BROADCAST_RATE_PER_SEC)));
  }

  broadcastProcessing = false;
}

export async function broadcastToUser(telegramId, message) {
  return new Promise((resolve) => {
    broadcastQueue.push({ telegramId, message, resolve });
    processBroadcastQueue().catch(console.error);
  });
}

export async function startBot() {
  await bot.launch({
    dropPendingUpdates: true,
  });
  console.log("tg bot started");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}