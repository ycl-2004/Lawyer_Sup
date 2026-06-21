import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Claim, ClaimStatus } from "../../lib/types";
import { useCase } from "../../state/CaseContext";
import { RiskBadge } from "../common/Badge";

const STATUS_OPTIONS: { value: ClaimStatus; label: string }[] = [
  { value: "suggested", label: "建议（待定）" },
  { value: "confirmed", label: "律师采纳" },
  { value: "excluded", label: "暂不主张" },
];

/** 可折叠请求项卡片：默认只显示标题与状态，点击展开判断依据与缺失证据 */
export function ClaimChecklist({ claims }: { claims: Claim[] }) {
  const { setClaimStatus, removeClaim } = useCase();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const remove = (c: Claim) => {
    if (window.confirm(`确定删除请求项「${c.title}」？此操作不可撤销。`)) {
      removeClaim(c.id);
    }
  };

  return (
    <ul className="space-y-2">
      {claims.map((c) => {
        const expanded = expandedId === c.id;
        return (
          <li
            key={c.id}
            className={`rounded-xl border ${
              c.status === "excluded"
                ? "border-slate-100 bg-slate-50 opacity-70"
                : "border-slate-200 bg-white"
            }`}
          >
            <div
              onClick={() => setExpandedId(expanded ? null : c.id)}
              className="flex cursor-pointer flex-wrap items-center gap-2 px-3.5 py-3"
            >
              <span className="text-slate-300">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <p className="text-sm font-medium text-slate-800">{c.title}</p>
              <RiskBadge level={c.riskLevel} />
              {c.alternativeGroup && (
                <span className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
                  择一
                </span>
              )}
              {c.missingEvidence.length > 0 && (
                <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] text-red-600">
                  缺证据 {c.missingEvidence.length}
                </span>
              )}
              <span
                className="ml-auto flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <select
                  value={c.status}
                  onChange={(e) => setClaimStatus(c.id, e.target.value as ClaimStatus)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => remove(c)}
                  title="删除请求项"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>

            {expanded && (
              <div className="border-t border-slate-100 px-3.5 py-3">
                <div className="grid gap-3 text-xs md:grid-cols-2">
                  <div>
                    <p className="font-medium text-slate-500">事实基础</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-slate-600">
                      {c.basisFacts.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                    <p className="mt-2 font-medium text-slate-500">所需证据</p>
                    <p className="mt-1 text-slate-600">{c.requiredEvidence.join("、") || "—"}</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-500">法律依据（待核对）</p>
                    <p className="mt-1 text-slate-600">{c.legalBasis.join("；")}</p>
                    {c.missingEvidence.length > 0 && (
                      <>
                        <p className="mt-2 font-medium text-red-600">缺失证据</p>
                        <ul className="mt-1 list-inside list-disc space-y-0.5 text-red-600/80">
                          {c.missingEvidence.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
                {c.note && (
                  <p className="mt-2.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                    {c.note}
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
