"use client";

import { useEffect, useState, useMemo } from "react";
import { SlidersHorizontal, Wifi, Search } from "lucide-react";
import clsx from "clsx";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { motion, AnimatePresence } from "framer-motion";
import TransactionCard from "@/components/TransactionCard";
import SkeletonCard from "@/components/SkeletonCard";
import { useAppContext } from "@/lib/AppContext";
import { MANTLE_TOKEN_LIST } from "@/lib/mockData";
import type { TransactionItem } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const MAX_FEED_ITEMS = 30;

interface LiveFeedScreenProps {
  onOpenFilters: () => void;
}

const CATEGORY_TABS = [
  { id: "ALL", label: "All activity" },
  { id: "Whale Swap", label: "Swaps" },
  { id: "Staking Deposit", label: "Staking" },
  { id: "Arbitrage Run", label: "Arbitrage" },
  { id: "Liquidity Provision", label: "Liquidity" },
  { id: "Large Transfer", label: "Transfers" },
];

export default function LiveFeedScreen({ onOpenFilters }: LiveFeedScreenProps) {
  const { filterConfig, setFeedMeta } = useAppContext();
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("ALL");

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`${API_URL}/transactions`);
      if (!res.ok) throw new Error("fetch fail");
      const data = await res.json();

      if (!Array.isArray(data)) {
        setTransactions([]);
        setIsLoading(false);
        setFeedMeta({ isLoading: false, lastUpdatedTimestamp: Date.now(), activeFeedItemsCount: 0 });
        return;
      }

      const mapped: TransactionItem[] = data.map((row: any) => {
        const fromDef = MANTLE_TOKEN_LIST.find(t => t.address.toLowerCase() === row.token_in?.toLowerCase()) || { symbol: "UNK", decimals: 18 };
        const toDef = MANTLE_TOKEN_LIST.find(t => t.address.toLowerCase() === row.token_out?.toLowerCase()) || { symbol: "UNK", decimals: 18 };
        
        const formatAmt = (raw: string, dec: number) => {
          if (!raw) return "0";
          const val = Number(raw) / (10 ** dec);
          return val > 1000 ? (val / 1000).toFixed(1) + "k" : val.toFixed(2);
        };

        return {
          id: row.tx_hash,
          txHash: row.tx_hash,
          explorerUrl: `https://explorer.mantle.xyz/tx/${row.tx_hash}`,
          tag: row.tag_type,
          timestamp: row.timestamp,
          usdVolume: Number(row.amount_usd),
          fromToken: { symbol: fromDef.symbol, amount: formatAmt(row.amount_in, fromDef.decimals) },
          toToken: { symbol: toDef.symbol, amount: formatAmt(row.amount_out, toDef.decimals) },
          aiCommentary: row.ai_report || "AI market commentary processing...",
          walletAddress: row.from_address,
          dexName: row.dex_name
        };
      });

      setTransactions(mapped);
      setIsLoading(false);
      setFeedMeta({ isLoading: false, lastUpdatedTimestamp: Date.now(), activeFeedItemsCount: mapped.length });
    } catch {
      setTransactions([]);
      setIsLoading(false);
      setFeedMeta({ isLoading: false, lastUpdatedTimestamp: Date.now(), activeFeedItemsCount: 0 });
    }
  };

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 8000);
    return () => clearInterval(interval);
  }, []);

  const filteredTxs = useMemo(() => {
    let filtered = transactions;

    if (selectedTab !== "ALL") {
      filtered = filtered.filter(tx => tx.tag === selectedTab);
    }
    
    if (filterConfig.isActive) {
      filtered = filtered.filter((tx) => {
        let catKey: keyof typeof filterConfig.categoryFilters = "whaleSwap";
        if (tx.tag === "Liquidity Provision") catKey = "liquidityProvision";
        else if (tx.tag === "Arbitrage Run") catKey = "arbitrageRun";
        else if (tx.tag === "Large Transfer") catKey = "largeTransfer";
        else if (tx.tag === "Staking Deposit") catKey = "stakingDeposit";

        const catConfig = filterConfig.categoryFilters[catKey];
        if (!catConfig.enabled) return false;
        if (tx.usdVolume < catConfig.minVolume) return false;

        if (filterConfig.mode === "ALL") return true;
        
        const txSymbols = [tx.fromToken.symbol, tx.toToken.symbol];
        const sel = filterConfig.selectedTokens.map((t) => t.symbol);
        if (sel.length === 0) return true;
        
        return filterConfig.mode === "INCLUDE_ONLY"
          ? txSymbols.some((s) => sel.includes(s))
          : !txSymbols.some((s) => sel.includes(s));
      });
    }

    return filtered.slice(0, MAX_FEED_ITEMS);
  }, [transactions, filterConfig, selectedTab]);

  return (
    <div className="relative flex flex-col h-full bg-[#F6F8FA]">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shrink-0">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" />
            <span className="font-extrabold text-[16px] text-slate-900 tracking-tight">
              MantleFlow
            </span>
          </div>

          <div className="flex items-center gap-2">
            <RainbowConnectBadge />
            <button 
              onClick={onOpenFilters} 
              className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              aria-label="Filter configuration"
            >
              <SlidersHorizontal size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-4 overflow-x-auto no-scrollbar py-2 border-t border-slate-100">
          {CATEGORY_TABS.map((tab) => {
            const isActive = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-[12px] font-extrabold whitespace-nowrap transition-all",
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 pb-24">
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : filteredTxs.length === 0 ? (
            <EmptyFeedState />
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredTxs.map((tx) => (
                <motion.div
                  key={tx.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  <TransactionCard tx={tx} />
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {!isLoading && filteredTxs.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 py-4 text-slate-400">
              <Wifi size={12} strokeWidth={2.5} />
              <span className="text-[10px] font-extrabold uppercase tracking-widest">Live On-Chain Feed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RainbowConnectBadge() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div {...(!ready && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' } })}>
            {(() => {
              if (!connected) {
                return (
                  <button onClick={openConnectModal} type="button" className="text-[12px] font-extrabold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-all">
                    Connect
                  </button>
                );
              }
              if (chain.unsupported) {
                return (
                  <button onClick={openChainModal} type="button" className="text-[12px] font-extrabold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl transition-all">
                    Wrong Network
                  </button>
                );
              }
              return (
                <button onClick={openAccountModal} type="button" className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80 hover:bg-slate-200 transition-colors">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-extrabold text-slate-900 font-mono">
                    {account.displayName}
                  </span>
                </button>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

function EmptyFeedState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-center mb-4 text-slate-400">
        <Search size={20} strokeWidth={2.5} />
      </div>
      <h2 className="text-[16px] font-extrabold text-slate-900 mb-1">No matching activity</h2>
      <p className="text-[12px] text-slate-500 font-medium">Try adjusting your filters or category selection.</p>
    </div>
  );
}