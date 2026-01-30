'use client';

type ModuleAssistantBarProps = {
  title: string;
  score: number;
  completionNote: string;
  tips: string[];
  dataFlowNote: string;
};

export function ModuleAssistantBar({
  title,
  score,
  completionNote,
  tips,
  dataFlowNote,
}: ModuleAssistantBarProps) {
  const normalizedScore = Math.min(10, Math.max(1, Math.round(score)));
  const scoreColor =
    normalizedScore >= 8 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : normalizedScore >= 5 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';

  return (
    <div className="border-t border-slate-200 bg-white px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            ModCon Assistant • {title}
          </p>
          <p className="text-[12px] text-slate-600">{completionNote}</p>
        </div>
        <div className={`text-[11px] px-3 py-1 rounded-full border ${scoreColor}`}>
          Quality {normalizedScore}/10
        </div>
      </div>
      {tips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tips.slice(0, 4).map((tip) => (
            <span
              key={tip}
              className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600"
            >
              {tip}
            </span>
          ))}
        </div>
      )}
      <p className="mt-3 text-[10px] text-slate-500">{dataFlowNote}</p>
    </div>
  );
}
