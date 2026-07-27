export default function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm" aria-hidden="true">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 rounded bg-slate-100 animate-pulse" />
          <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
        </div>
        <div className="h-4 w-4 rounded bg-slate-100 animate-pulse" />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-full bg-slate-100 animate-pulse" />
        <div className="h-3 w-28 rounded bg-slate-100 animate-pulse" />
      </div>

      <div className="h-6 w-32 rounded bg-slate-100 animate-pulse mb-3" />

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="h-14 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-14 rounded-xl bg-slate-100 animate-pulse" />
      </div>

      <div className="h-1.5 w-full rounded-full bg-slate-100 animate-pulse mb-3" />
      <div className="h-16 w-full rounded-xl bg-slate-100 animate-pulse mb-3" />

      <div className="flex justify-between pt-1.5 border-t border-slate-100">
        <div className="h-3 w-20 rounded bg-slate-100 animate-pulse" />
        <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}