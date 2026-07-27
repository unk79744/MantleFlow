"use client";

import { ExternalLink, Sparkles, Clock, ShieldCheck } from "lucide-react";
import type { TransactionItem } from "@/lib/types";

interface TransactionCardProps {
  tx: TransactionItem;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatTimeWithAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";

  const diffHrs = Math.floor(diffMins / 60);
  const remMins = diffMins % 60;

  if (diffHrs > 0) {
    return `${diffHrs}h ${remMins}m ago`;
  }

  return `${diffMins}m ago`;
}

export default function TransactionCard({ tx }: TransactionCardProps) {
  return (
    <article className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition-all duration-200 w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider">
            OPEN
          </span>
          <span className="text-[12px] font-extrabold text-slate-400">
            #{tx.tag.replace(/\s+/g, "")}
          </span>
        </div>

        <a
          href={tx.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
          aria-label="View transaction"
        >
          <ExternalLink size={16} strokeWidth={2} />
        </a>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
          <ShieldCheck size={12} className="text-white" strokeWidth={2.5} />
        </span>
        <span className="text-[12px] font-extrabold text-slate-800 font-mono">
          {tx.walletAddress.slice(0, 6)}…{tx.walletAddress.slice(-4)}
        </span>
        {tx.dexName && (
          <span className="text-[11px] font-bold text-slate-400">
            via {tx.dexName}
          </span>
        )}
      </div>

      <div className="mb-3">
        <div className="text-[20px] font-extrabold text-slate-900 tracking-tight leading-none mb-2.5">
          {formatUsd(tx.usdVolume)}
        </div>
        
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-center">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">From</span>
            <span className="text-[13px] font-extrabold text-slate-900">{tx.fromToken.symbol}</span>
            <span className="text-[11px] font-medium text-slate-500 block">{tx.fromToken.amount}</span>
          </div>
          
          <div className="bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-center">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">To</span>
            <span className="text-[13px] font-extrabold text-slate-900">{tx.toToken.symbol}</span>
            <span className="text-[11px] font-medium text-slate-500 block">{tx.toToken.amount}</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles size={13} className="text-blue-600" strokeWidth={2.5} />
          <span className="text-[10px] font-extrabold text-slate-900 uppercase tracking-wider">AI Insight</span>
        </div>
        <p className="text-[12px] text-slate-600 leading-snug font-medium">{tx.aiCommentary}</p>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-1.5 border-t border-slate-100">
        <span>Pool: {formatUsd(tx.usdVolume)}</span>
        <div className="flex items-center gap-1 text-slate-500 font-bold">
          <Clock size={12} strokeWidth={2.5} />
          <span>{formatTimeWithAgo(tx.timestamp)}</span>
        </div>
      </div>
    </article>
  );
}