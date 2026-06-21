import type { MatterStatus, RiskLevel, SourceRef } from "../../lib/types";
import { MATTER_STATUS_LABELS, RISK_LABELS } from "../../lib/types";
import { cls } from "../../lib/utils";

const STATUS_STYLES: Record<MatterStatus, string> = {
  intake: "bg-blue-50 text-blue-700 border-blue-200",
  extracting: "bg-indigo-50 text-indigo-700 border-indigo-200",
  review: "bg-amber-50 text-amber-700 border-amber-200",
  draft: "bg-emerald-50 text-emerald-700 border-emerald-200",
  done: "bg-slate-100 text-slate-600 border-slate-200",
};

export function StatusBadge({ status }: { status: MatterStatus }) {
  return (
    <span
      className={cls(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
      )}
    >
      {MATTER_STATUS_LABELS[status]}
    </span>
  );
}

const RISK_STYLES: Record<RiskLevel, string> = {
  low: "text-emerald-700",
  medium: "text-amber-700",
  high: "text-red-700",
};

const RISK_DOTS: Record<RiskLevel, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={cls("inline-flex items-center gap-1.5 text-xs font-medium", RISK_STYLES[level])}>
      <span className={cls("h-2 w-2 rounded-full", RISK_DOTS[level])} />
      {RISK_LABELS[level]}风险
    </span>
  );
}

/**
 * 置信度徽章：三档（高/中/低）+ 缺失。
 * 不展示百分比以避免"伪精确"——具体数值放在 tooltip 中仅供参考。
 */
export function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        缺失
      </span>
    );
  }
  const pct = Math.round(value * 100);
  const tier =
    value >= 0.85
      ? { label: "高置信", style: "border-emerald-200 bg-emerald-50 text-emerald-700" }
      : value >= 0.7
        ? { label: "中置信", style: "border-slate-200 bg-slate-50 text-slate-600" }
        : { label: "低置信", style: "border-amber-200 bg-amber-50 text-amber-700" };
  return (
    <span
      className={cls(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        tier.style,
      )}
      title={`抽取置信度约 ${pct}%（仅供排序参考，不代表法律判断；以律师核实为准）`}
    >
      {tier.label}
    </span>
  );
}

export function NeedsReviewBadge() {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      需律师复核
    </span>
  );
}

/** 来源引用锚点 chip */
export function SourceChip({ source }: { source: SourceRef }) {
  return (
    <span
      className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-500"
      title={source.quote ? `“${source.quote}”` : "来源材料"}
    >
      {source.documentId}
      {source.page ? ` p.${source.page}` : ""}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="font-medium text-slate-600">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
