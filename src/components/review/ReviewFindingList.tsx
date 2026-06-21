import { CheckCircle2, Undo2 } from "lucide-react";
import type { ReviewFinding } from "../../lib/types";
import { FINDING_TYPE_LABELS } from "../../lib/types";
import { useCase } from "../../state/CaseContext";
import { RiskBadge } from "../common/Badge";
import { cls } from "../../lib/utils";

export function ReviewFindingList({ findings }: { findings: ReviewFinding[] }) {
  const { toggleFindingResolved } = useCase();

  if (findings.length === 0) {
    return <p className="text-xs text-slate-400">当前筛选无复核发现。</p>;
  }

  return (
    <ul className="space-y-3">
      {findings.map((f) => (
        <li
          key={f.id}
          className={cls(
            "rounded-xl border p-3.5",
            f.resolved
              ? "border-emerald-200 bg-emerald-50/40"
              : f.severity === "high"
                ? "border-red-200 bg-white"
                : "border-slate-200 bg-white",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge level={f.severity} />
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
              {FINDING_TYPE_LABELS[f.findingType]}
            </span>
            <span className="font-mono text-[11px] text-slate-400">{f.location}</span>
            <button
              onClick={() => toggleFindingResolved(f.id)}
              className={cls(
                "ml-auto inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium",
                f.resolved
                  ? "border-slate-200 text-slate-500 hover:bg-slate-50"
                  : "border-emerald-300 text-emerald-700 hover:bg-emerald-50",
              )}
            >
              {f.resolved ? (
                <>
                  <Undo2 size={12} /> 撤销处理
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} /> 标记已处理
                </>
              )}
            </button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{f.message}</p>
          <p className="mt-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs leading-relaxed text-blue-800">
            建议：{f.suggestion}
          </p>
        </li>
      ))}
    </ul>
  );
}
