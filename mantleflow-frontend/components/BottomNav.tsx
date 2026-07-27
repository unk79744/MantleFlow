"use client";

import { Activity, SlidersHorizontal, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import type { ActiveTab } from "@/app/page";

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isPremium: boolean;
}

const NAV_ITEMS = [
  { id: "feed" as const, label: "Feed", Icon: Activity },
  { id: "filters" as const, label: "Filters", Icon: SlidersHorizontal },
  { id: "premium" as const, label: "Pro", Icon: ShieldCheck },
];

export default function BottomNav({ activeTab, onTabChange, isPremium }: BottomNavProps) {
  return (
    <nav className="z-50 shrink-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 pb-safe">
      <ul className="flex items-center justify-around h-[62px] px-3" role="list">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <li key={id} className="flex-1">
              <button
                onClick={() => onTabChange(id)}
                className="w-full h-full flex flex-col items-center justify-center gap-1 relative group"
              >
                <div className="relative">
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={clsx(
                      "transition-all duration-200",
                      isActive ? "text-blue-600 scale-105" : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                  {id === "premium" && isPremium && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
                  )}
                </div>
                <span className={clsx(
                  "text-[10px] font-bold uppercase tracking-wider transition-colors",
                  isActive ? "text-blue-600" : "text-slate-400"
                )}>
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}