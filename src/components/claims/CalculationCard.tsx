import { AlertTriangle, CalendarClock, Calculator, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { CalculationResult, LimitationCheckResult } from "../../lib/compensation";
import { formatCurrency } from "../../lib/utils";

/** 计算卡片：默认只显示结果与公式，输入/推导过程折叠收纳 */
export function CalculationCard({ result }: { result: CalculationResult }) {
  const [showDetail, setShowDetail] = useState(false);
  const refused = result.result == null;

  return (
    <div
      className={`rounded-xl border p-4 ${
        refused ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <Calculator size={14} className="text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-800">{result.title}</h3>
      </div>

      {refused ? (
        <p className="mt-2 text-sm font-medium text-red-700">
          无法计算 — 缺少输入：{result.missingInputs.join("、")}（不做推测）
        </p>
      ) : (
        <p className="mt-2 text-2xl font-semibold text-slate-900">
          {formatCurrency(result.result!)}
          <span className="ml-2 align-middle rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
            草稿 · 需律师复核
          </span>
        </p>
      )}

      <p className="mt-2 font-mono text-[11px] text-slate-500">{result.formula}</p>

      {result.warnings.length > 0 && (
        <ul className="mt-2.5 space-y-1 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-800">
          {result.warnings.map((w, i) => (
            <li key={i} className="flex gap-1.5">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setShowDetail((v) => !v)}
        className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        {showDetail ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {showDetail ? "收起输入与推导" : "查看输入与推导过程"}
      </button>

      {showDetail && (
        <div className="mt-2 space-y-3 border-t border-slate-100 pt-3">
          <div className="space-y-1 text-xs text-slate-600">
            <p className="font-medium text-slate-500">输入</p>
            {result.inputs.map((inp, i) => (
              <p key={i} className="flex flex-wrap gap-1">
                <span className="text-slate-400">{inp.label}：</span>
                <span className={inp.value == null ? "italic text-red-600" : ""}>
                  {inp.value ?? "缺失"}
                </span>
                {inp.needsReview && <span className="text-amber-600">（需复核）</span>}
                {inp.sourceNote && <span className="text-slate-400">[{inp.sourceNote}]</span>}
              </p>
            ))}
          </div>
          {result.steps.length > 0 && (
            <div className="space-y-1 text-xs text-slate-600">
              <p className="font-medium text-slate-500">推导过程</p>
              {result.steps.map((s, i) => (
                <p key={i}>· {s}</p>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-400">依据：{result.legalBasis.join("；")}</p>
        </div>
      )}
    </div>
  );
}

const LIMITATION_STYLES: Record<LimitationCheckResult["status"], string> = {
  ok: "border-slate-200 bg-white",
  approaching: "border-amber-300 bg-amber-50/50",
  expired: "border-red-300 bg-red-50/50",
  unknown: "border-amber-200 bg-white",
};

export function LimitationCard({ check }: { check: LimitationCheckResult }) {
  return (
    <div className={`rounded-xl border p-4 ${LIMITATION_STYLES[check.status]}`}>
      <div className="flex items-center gap-2">
        <CalendarClock size={14} className="text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-800">仲裁时效检查</h3>
        {check.severity === "high" && (
          <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
            高风险
          </span>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{check.message}</p>
      <p className="mt-2 text-[11px] text-slate-400">
        依据：《劳动争议调解仲裁法》第二十七条（一年时效）。中止、中断及特殊起算情形由律师判断。
      </p>
    </div>
  );
}
