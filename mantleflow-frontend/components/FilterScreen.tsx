"use client";

import { useState, useEffect, useRef, type KeyboardEvent, type Dispatch, type SetStateAction } from "react";
import { ChevronLeft, Search, X, Lock, AlertCircle, Check } from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext, DEFAULT_CATEGORY_FILTERS } from "@/lib/AppContext";
import { MANTLE_TOKEN_LIST } from "@/lib/mockData";
import type { FilterMode, TokenItem, CategoryFilters } from "@/lib/types";

interface FilterScreenProps { onBack: () => void; }

const CATEGORIES: { id: keyof CategoryFilters; label: string; defaultVol: number }[] = [
  { id: "whaleSwap", label: "Whale Swaps", defaultVol: 50000 },
  { id: "liquidityProvision", label: "Liquidity Provision", defaultVol: 50000 },
  { id: "arbitrageRun", label: "Arbitrage Runs", defaultVol: 50000 },
  { id: "largeTransfer", label: "Large Transfers", defaultVol: 100000 },
  { id: "stakingDeposit", label: "Staking Deposits", defaultVol: 25000 },
];

export default function FilterScreen({ onBack }: FilterScreenProps) {
  const { user, filterConfig, applyFilters, resetFilters } = useAppContext();

  const [selectedTokens, setSelectedTokens] = useState<TokenItem[]>(filterConfig.selectedTokens);
  const [mode, setMode] = useState<FilterMode>(filterConfig.mode);
  const [cats, setCats] = useState<CategoryFilters>(filterConfig.categoryFilters);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = MANTLE_TOKEN_LIST.filter(
    (t) => t.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const includeOnlyWithNoTokens = mode === "INCLUDE_ONLY" && selectedTokens.length === 0;
  const canApply = (mode === "ALL" || !includeOnlyWithNoTokens);

  function handleAddToken(token: TokenItem) {
    setSelectedTokens((p) => [...p, token]);
  }

  function handleRemoveToken(address: string) {
    setSelectedTokens((p) => p.filter((t) => t.address !== address));
  }

  function handleApply() {
    if (!canApply) return;
    
    const finalCats = { ...cats };
    if (!user.isPremium) {
      CATEGORIES.forEach(c => {
        finalCats[c.id].minVolume = c.defaultVol;
      });
    }

    applyFilters({ mode, selectedTokens, categoryFilters: finalCats });
    onBack();
  }

  function handleReset() {
    setSelectedTokens([]); 
    setMode("ALL"); 
    setCats(DEFAULT_CATEGORY_FILTERS);
    resetFilters();
  }

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  return (
    <div className="relative flex flex-col h-full bg-[#F6F8FA]">
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200/80 sticky top-0 bg-white/95 backdrop-blur-xl z-20">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 -ml-1 text-slate-800 hover:text-blue-600 transition-colors" aria-label="Back">
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="font-extrabold text-[16px] text-slate-900 tracking-tight">Filters</h1>
        </div>
        <button onClick={handleReset} className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 hover:opacity-70 transition-opacity">
          Reset
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-32 space-y-6">
        
        <section>
          <SectionLabel step="01" text="Filter Mode" />
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex gap-2">
              <ModeButton active={mode === "INCLUDE_ONLY"} onClick={() => setMode("INCLUDE_ONLY")} label="Track Only" />
              <ModeButton active={mode === "EXCLUDE"}      onClick={() => setMode("EXCLUDE")}      label="Exclude" />
            </div>
            <ModeButton active={mode === "ALL"} onClick={() => setMode("ALL")} label="All Tokens" />
          </div>
          {includeOnlyWithNoTokens && (
            <InlineWarning text="Add at least one token below to enable Track Only mode." />
          )}
        </section>

        <section className={clsx("transition-all duration-200", mode === "ALL" ? "opacity-40 pointer-events-none grayscale" : "opacity-100")}>
          <SectionLabel step="02" text="Select Tokens" />
          <div ref={wrapperRef} className="relative mt-2">
            <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400" strokeWidth={2.5} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              placeholder="Search MNT, USDC..."
              className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-[13px] font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition-all shadow-sm"
            />

            {showSuggestions && filteredSuggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 mt-2 z-30 bg-white border border-slate-200 rounded-2xl shadow-xl p-1 max-h-[184px] overflow-y-auto no-scrollbar" role="listbox">
                {filteredSuggestions.map((token) => {
                  const isSelected = selectedTokens.some(s => s.address === token.address);
                  return (
                    <li key={token.address} className="mb-0.5 last:mb-0">
                      <button
                        type="button"
                        onClick={() => isSelected ? handleRemoveToken(token.address) : handleAddToken(token)}
                        className={clsx(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-left",
                          isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-extrabold text-slate-900">{token.symbol}</span>
                          <span className="text-[11px] font-medium text-slate-400 font-mono">{token.address.slice(0, 8)}…</span>
                        </div>
                        {isSelected && <Check size={16} className="text-blue-600" strokeWidth={3} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={clsx("flex flex-wrap gap-2", selectedTokens.length > 0 && "mt-3")}>
            <AnimatePresence>
              {selectedTokens.map((token) => (
                <motion.span
                  layout
                  key={token.address}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="inline-flex items-center bg-white border border-slate-200 shadow-sm text-slate-900 text-[12px] font-extrabold py-1.5 pl-3 pr-1.5 rounded-xl"
                >
                  {token.symbol}
                  <button
                    type="button"
                    onClick={() => handleRemoveToken(token.address)}
                    className="ml-1 p-0.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </section>

        <section>
          <SectionLabel step="03" text="Categories & Thresholds" />
          <div className="space-y-2.5 mt-2">
            {CATEGORIES.map((c) => (
              <CategoryItem
                key={c.id}
                category={c}
                conf={cats[c.id]}
                user={user}
                setCats={setCats}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-5 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 z-20">
        <button
          type="button"
          onClick={handleApply}
          disabled={!canApply}
          className={clsx(
            "w-full py-3.5 rounded-xl text-[14px] font-extrabold tracking-wide transition-all",
            canApply
              ? "bg-slate-900 hover:bg-slate-800 text-white shadow-md"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          )}
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}

function CategoryItem({
  category,
  conf,
  user,
  setCats,
}: {
  category: typeof CATEGORIES[0];
  conf: any;
  user: any;
  setCats: Dispatch<SetStateAction<CategoryFilters>>;
}) {
  const itemRef = useRef<HTMLDivElement>(null);

  const handleToggle = (val: boolean) => {
    setCats((p) => ({ ...p, [category.id]: { ...p[category.id], enabled: val } }));
    if (val) {
      setTimeout(() => {
        itemRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  };

  return (
    <div ref={itemRef} className="p-3.5 border border-slate-200/80 rounded-2xl bg-white shadow-sm transition-all">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-extrabold text-slate-900">{category.label}</span>
        <Switch checked={conf.enabled} onChange={handleToggle} />
      </div>

      <AnimatePresence initial={false}>
        {conf.enabled && (
          <motion.div
            key={`dropdown-${category.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400 text-[13px] font-extrabold">$</span>
                <input
                  type="number"
                  value={user.isPremium ? conf.minVolume || "" : category.defaultVol}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : 0;
                    setCats((p) => ({ ...p, [category.id]: { ...p[category.id], minVolume: val } }));
                  }}
                  disabled={!user.isPremium}
                  placeholder={String(category.defaultVol)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-7 pr-8 text-[13px] font-extrabold text-slate-900 focus:outline-none focus:border-blue-600 transition-all disabled:opacity-60"
                />
                {!user.isPremium && (
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <Lock size={12} className="text-slate-400" />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        checked ? "bg-blue-600" : "bg-slate-200"
      )}
    >
      <span
        className={clsx(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

function SectionLabel({ step, text }: { step: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-extrabold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md">{step}</span>
      <span className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">{text}</span>
    </div>
  );
}

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex-1 py-2.5 text-[12px] font-extrabold rounded-xl transition-all duration-150 border",
        active
          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
          : "bg-white text-slate-500 border-slate-200 hover:text-slate-900 hover:bg-slate-50"
      )}
    >
      {label}
    </button>
  );
}

function InlineWarning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 mt-2 rounded-xl px-3 py-2 text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/60">
      <AlertCircle size={14} className="shrink-0 mt-0.5" strokeWidth={2.5} />
      <span>{text}</span>
    </div>
  );
}