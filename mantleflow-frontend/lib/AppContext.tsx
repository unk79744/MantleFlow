"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { AppUser, FilterConfiguration, FeedMetadata, CategoryFilters } from "@/lib/types";
import { MANTLE_TOKEN_LIST } from "@/lib/mockData";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const DEFAULT_USER: AppUser = {
  telegramId: "0",
  username: null,
  walletAddress: "0x0000000000000000000000000000000000000000",
  isPremium: false,
};

export const DEFAULT_CATEGORY_FILTERS: CategoryFilters = {
  whaleSwap: { enabled: true, minVolume: 50000 },
  liquidityProvision: { enabled: true, minVolume: 50000 },
  arbitrageRun: { enabled: true, minVolume: 50000 },
  largeTransfer: { enabled: true, minVolume: 100000 },
  stakingDeposit: { enabled: true, minVolume: 25000 }
};

const DEFAULT_FILTER: FilterConfiguration = {
  isActive: false,
  mode: "ALL",
  selectedTokens: [],
  categoryFilters: DEFAULT_CATEGORY_FILTERS,
};

const DEFAULT_FEED: FeedMetadata = {
  isLoading: true,
  lastUpdatedTimestamp: 0,
  activeFeedItemsCount: 0,
};

interface AppContextValue {
  user: AppUser;
  filterConfig: FilterConfiguration;
  feedMeta: FeedMetadata;
  setUser: (u: AppUser) => void;
  setFilterConfig: (f: FilterConfiguration) => void;
  setFeedMeta: (m: FeedMetadata) => void;
  applyFilters: (f: Omit<FilterConfiguration, "isActive">) => void;
  resetFilters: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser>(DEFAULT_USER);
  const [filterConfig, setFilterConfig] = useState<FilterConfiguration>(DEFAULT_FILTER);
  const [feedMeta, setFeedMeta] = useState<FeedMetadata>(DEFAULT_FEED);

  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [verifiedAddress, setVerifiedAddress] = useState<string | null>(null);

  useEffect(() => {
    const initApp = async () => {
      const tgApp = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
      let tId = "0";
      let tUsername = null;

      if (tgApp) {
        tgApp.ready();
        tgApp.expand();
        if (tgApp.initDataUnsafe?.user) {
          tId = String(tgApp.initDataUnsafe.user.id);
          tUsername = tgApp.initDataUnsafe.user.username || null;
        }
      }

      try {
        const res = await fetch(`${API_URL}/user/${tId}`);
        const data = await res.json();

        if (data.exists) {
          setUser({
            telegramId: tId,
            username: tUsername,
            walletAddress: data.walletAddress,
            isPremium: data.isPremium,
          });
          setVerifiedAddress(data.walletAddress);

          const savedTokens = MANTLE_TOKEN_LIST.filter(t => data.filters.token_list?.includes(t.address.toLowerCase()));
          const parsedCats = data.filters.category_filters || DEFAULT_CATEGORY_FILTERS;
          
          setFilterConfig({
            isActive: data.filters.filter_mode !== "ALL" || savedTokens.length > 0 || !!data.filters.category_filters,
            mode: data.filters.filter_mode || "ALL",
            categoryFilters: parsedCats,
            selectedTokens: savedTokens,
          });
        } else {
          setUser(prev => ({ ...prev, telegramId: tId, username: tUsername }));
        }
      } catch (err) {
        console.error("fetch user err", err);
      }
    };

    initApp();
  }, []);

  useEffect(() => {
    const verifyWallet = async () => {
      if (isConnected && address && address !== verifiedAddress && user.telegramId && user.telegramId !== "0") {
        try {
          const tgApp = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
          const initData = tgApp?.initData || "";

          const message = `Verify wallet ownership for Telegram ID: ${user.telegramId}`;
          const signature = await signMessageAsync({ message });

          const res = await fetch(`${API_URL}/user`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              telegramId: user.telegramId,
              walletAddress: address,
              signature,
              initData
            }),
          });

          if (res.ok) {
            const data = await res.json();
            setVerifiedAddress(address);
            setUser(prev => ({ ...prev, walletAddress: address, isPremium: data.isPremium }));
            if (tgApp?.HapticFeedback) tgApp.HapticFeedback.notificationOccurred("success");
          } else {
            console.error("wallet verify backend fail");
            if (tgApp?.HapticFeedback) tgApp.HapticFeedback.notificationOccurred("error");
          }
        } catch (err) {
          console.error("sig verify err", err);
        }
      }
    };

    verifyWallet();
  }, [isConnected, address, user.telegramId, verifiedAddress, signMessageAsync]);

  const applyFilters = useCallback(
    (f: Omit<FilterConfiguration, "isActive">) => {
      setFilterConfig({ ...f, isActive: true });
      
      fetch(`${API_URL}/user/filters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: user.telegramId,
          categoryFilters: f.categoryFilters,
          filterMode: f.mode,
          tokenList: f.selectedTokens.map(t => t.address.toLowerCase())
        })
      }).catch(err => console.error("save filters err", err));
    },
    [user.telegramId]
  );

  const resetFilters = useCallback(() => {
    setFilterConfig(DEFAULT_FILTER);
    
    fetch(`${API_URL}/user/filters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramId: user.telegramId,
        categoryFilters: DEFAULT_CATEGORY_FILTERS,
        filterMode: "ALL",
        tokenList: []
      })
    }).catch(err => console.error("reset filters err", err));
  }, [user.telegramId]);

  return (
    <AppContext.Provider value={{ user, filterConfig, feedMeta, setUser, setFilterConfig, setFeedMeta, applyFilters, resetFilters }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext missing provider");
  return ctx;
}