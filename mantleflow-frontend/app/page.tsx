"use client";

import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import LiveFeedScreen from "@/components/LiveFeedScreen";
import FilterScreen from "@/components/FilterScreen";
import PremiumScreen from "@/components/PremiumScreen";
import { useAppContext } from "@/lib/AppContext";

export type ActiveTab = "feed" | "filters" | "premium";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("feed");
  const { user } = useAppContext();

  return (
    <div className="relative flex flex-col h-[100dvh] w-full max-w-[430px] mx-auto bg-[#F6F8FA] overflow-hidden border-x border-slate-200/80">
      <main className="flex-1 relative overflow-hidden z-0 bg-[#F6F8FA]">
        {activeTab === "feed" && (
          <div className="absolute inset-0">
            <LiveFeedScreen onOpenFilters={() => setActiveTab("filters")} />
          </div>
        )}
        {activeTab === "filters" && (
          <div className="absolute inset-0">
            <FilterScreen onBack={() => setActiveTab("feed")} />
          </div>
        )}
        {activeTab === "premium" && (
          <div className="absolute inset-0">
            <PremiumScreen onClose={() => setActiveTab("feed")} />
          </div>
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isPremium={user.isPremium}
      />
    </div>
  );
}