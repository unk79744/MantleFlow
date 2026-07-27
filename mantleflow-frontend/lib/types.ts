export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
  };
  ready(): void;
  expand(): void;
  close(): void;
  MainButton: {
    setText(text: string): void;
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
  };
  HapticFeedback: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export interface TokenItem {
  address: string;
  symbol: string;
  decimals: number;
}

export type FilterMode = "INCLUDE_ONLY" | "EXCLUDE" | "ALL";

export interface CategoryFilter {
  enabled: boolean;
  minVolume: number;
}

export interface CategoryFilters {
  whaleSwap: CategoryFilter;
  liquidityProvision: CategoryFilter;
  arbitrageRun: CategoryFilter;
  largeTransfer: CategoryFilter;
  stakingDeposit: CategoryFilter;
}

export interface FilterConfiguration {
  isActive: boolean;
  mode: FilterMode;
  selectedTokens: TokenItem[];
  categoryFilters: CategoryFilters;
}

export interface FeedMetadata {
  isLoading: boolean;
  lastUpdatedTimestamp: number;
  activeFeedItemsCount: number;
}

export interface AppUser {
  telegramId: string;
  username?: string | null;
  walletAddress: string;
  isPremium: boolean;
}

export type TransactionTag =
  | "Whale Swap"
  | "Liquidity Provision"
  | "Arbitrage Run"
  | "Large Transfer"
  | "Staking Deposit";

export interface TransactionItem {
  id: string;
  txHash: string;
  explorerUrl: string;
  tag: TransactionTag;
  timestamp: string;
  usdVolume: number;
  fromToken: { symbol: string; amount: string };
  toToken: { symbol: string; amount: string };
  aiCommentary: string;
  walletAddress: string;
  dexName?: string;
  ratio?: number;
}