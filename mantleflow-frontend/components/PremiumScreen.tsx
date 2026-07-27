"use client";

import { useState } from "react";
import { X, ShieldCheck, Filter, TrendingUp, CheckCircle2, Loader2, AlertCircle, Zap, Calendar } from "lucide-react";
import clsx from "clsx";
import { useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { useAppContext } from "@/lib/AppContext";
import { SUBSCRIPTION_CONTRACT_ADDRESS, SUBSCRIPTION_ABI } from "@/lib/constants";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface PremiumScreenProps { onClose: () => void; }

type PlanId = "lifetime";
type PaymentStatus = "idle" | "processing" | "success" | "error";

const PLANS = [
  { id: "lifetime" as PlanId, label: "Lifetime Access", price: "1 MNT", note: "Pay once, use forever", value: "1" },
];

const VALUE_PROPS = [
  { Icon: TrendingUp,  title: "Unlock Custom Thresholds",   desc: "Filter whales by exact USD volume sizes." },
  { Icon: Filter,      title: "Remove the Noise",           desc: "Hide small retail transactions completely." },
  { Icon: ShieldCheck, title: "Support the Project",        desc: "Keep our AI and indexer running fast." },
];

export default function PremiumScreen({ onClose }: PremiumScreenProps) {
  const { user, setUser } = useAppContext();
  const [plan, setPlan]                 = useState<PlanId>("lifetime");
  const [status, setStatus]             = useState<PaymentStatus>("idle");
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();

  if (user.isPremium) return <AlreadyPremiumState onClose={onClose} />;
  if (status === "success") return <SuccessState onClose={onClose} />;

  async function handleUpgrade() {
    setStatus("processing"); 
    setErrorMsg(null);
    try {
      const selectedPlan = PLANS.find(p => p.id === plan);
      if (!selectedPlan) throw new Error("Plan not found");

      const txHash = await writeContractAsync({
        address: SUBSCRIPTION_CONTRACT_ADDRESS as `0x${string}`,
        abi: SUBSCRIPTION_ABI,
        functionName: "subscribe",
        value: parseEther(selectedPlan.value)
      });

      const tgApp = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
      const res = await fetch(`${API_URL}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: user.telegramId,
          txHash,
          initData: tgApp?.initData || ""
        })
      });

      if (!res.ok) throw new Error("Backend verification failed");

      setUser({ ...user, isPremium: true });
      setStatus("success");
      if (tgApp?.HapticFeedback) tgApp.HapticFeedback.notificationOccurred("success");

    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message?.includes("rejected") ? "Transaction rejected by user." : "Transaction failed. Ensure you have sufficient MNT on Mantle Network.");
    }
  }

  return (
    <div className="relative flex flex-col h-full bg-[#F6F8FA]">

      <div className="absolute top-3 right-3 z-20">
        <button onClick={onClose} className="p-1.5 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-colors">
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      {status === "error" && errorMsg && (
        <div className="absolute top-0 left-0 right-0 z-30 flex items-start gap-2 bg-rose-50 border-b border-rose-200 px-4 py-3 text-[12px] text-rose-700 font-medium">
          <AlertCircle size={14} className="shrink-0 mt-0.5" strokeWidth={2.5} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center px-4 pt-8 pb-4">
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-center mx-auto mb-3">
            <Zap size={22} className="text-blue-600" strokeWidth={2.5} />
          </div>
          <h1 className="text-[20px] font-extrabold text-slate-900 tracking-tight">
            Pro Filters
          </h1>
        </div>

        <ul className="space-y-2.5 mb-6">
          {VALUE_PROPS.map(({ Icon, title, desc }) => (
            <li key={title} className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-slate-200/80 shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                <Icon size={16} className="text-blue-600" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[13px] font-extrabold text-slate-900">{title}</p>
                <p className="text-[11px] text-slate-500 font-medium">{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <fieldset>
          <legend className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
            Select Plan
          </legend>
          <div className="space-y-2">
            {PLANS.map((p) => (
              <label
                key={p.id}
                className={clsx(
                  "flex items-center justify-between rounded-2xl px-4 py-3 border-2 cursor-pointer transition-all shadow-sm",
                  plan === p.id
                    ? "border-slate-900 bg-white"
                    : "border-transparent bg-white hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={clsx(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                    plan === p.id ? "border-slate-900 bg-slate-900" : "border-slate-300 bg-white"
                  )}>
                    {plan === p.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} className="sr-only" />
                  <div>
                    <span className="text-[13px] font-extrabold text-slate-900 block">{p.label}</span>
                    {p.note && <span className="text-[11px] text-slate-400 font-medium">{p.note}</span>}
                  </div>
                </div>
                <span className="text-[14px] font-extrabold text-slate-900">{p.price}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="shrink-0 px-4 pt-2 pb-6 bg-[#F6F8FA] z-20">
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={status === "processing"}
          className={clsx(
            "w-full py-3.5 rounded-xl text-[14px] font-extrabold tracking-wide transition-all",
            status === "processing"
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-slate-900 hover:bg-slate-800 text-white shadow-md"
          )}
        >
          {status === "processing"
            ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Confirming...</span>
            : "Upgrade to Premium"
          }
        </button>
        <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
          Secured by Mantle Network
        </p>
      </div>
    </div>
  );
}

function SuccessState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 text-center bg-[#F6F8FA]">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
        <CheckCircle2 size={32} className="text-emerald-600" strokeWidth={2.5} />
      </div>
      <h1 className="text-[20px] font-extrabold text-slate-900 mb-2">Welcome to Premium</h1>
      <p className="text-[13px] text-slate-500 font-medium mb-8">Custom volume filters are now unlocked forever.</p>
      <button onClick={onClose} className="w-full py-3.5 bg-slate-900 text-white text-[14px] font-extrabold rounded-xl shadow-md transition-all">
        Start Exploring
      </button>
    </div>
  );
}

function AlreadyPremiumState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col min-h-full bg-[#F6F8FA]">
      <div className="flex justify-end px-4 pt-4">
        <button onClick={onClose} className="p-1.5 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-colors">
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-10">
        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-center mb-4">
          <ShieldCheck size={32} className="text-blue-600" strokeWidth={2.5} />
        </div>
        <h1 className="text-[20px] font-extrabold text-slate-900 mb-2">You are on Premium</h1>
        <p className="text-[13px] text-slate-500 font-medium">Custom volume filters are active.</p>
        
        <div className="mt-6 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm w-full max-w-xs flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
            <Calendar size={16} className="text-blue-600" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Subscription</p>
            <p className="text-[13px] font-extrabold text-slate-900">Lifetime Access</p>
          </div>
        </div>
      </div>
    </div>
  );
}