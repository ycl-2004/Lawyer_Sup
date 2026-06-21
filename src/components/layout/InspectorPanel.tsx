import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileQuestion,
  ShieldCheck,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { LEGAL_SOURCE_CAVEAT, SOURCE_RULE } from "../../config/compliance";
import { LEGAL_SOURCES } from "../../data/legalSources";
import { FINDING_TYPE_LABELS } from "../../lib/types";
import { useCase } from "../../state/CaseContext";
import { RiskBadge } from "../common/Badge";

/** 可折叠面板卡片：默认收起，减少右栏信息密度 */
function PanelCard({
  icon: Icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: typeof BookOpen;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left text-xs font-semibold text-slate-700"
      >
        <Icon size={13} className="text-blue-600" />
        {title}
        <span className="ml-auto text-slate-300">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

/** AI Inspector：持续提示来源、低置信度、缺失项与复核发现 */
export function InspectorPanel() {
  const { facts, findings, missingMaterials, hasData } = useCase();
  const needsReview = facts.filter((f) => f.needsReview);
  const unresolved = findings.filter((f) => !f.resolved);

  return (
    <aside className="w-full space-y-3 xl:w-72">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs leading-relaxed text-blue-800">
        <p className="flex items-center gap-1.5 font-semibold">
          <ShieldCheck size={13} /> AI Inspector
        </p>
        <p className="mt-1.5">{SOURCE_RULE}</p>
      </div>

      {!hasData ? (
        <PanelCard icon={FileQuestion} title="暂无分析结果" defaultOpen>
          <p className="text-xs text-slate-500">
            该案件尚未运行解析与抽取。点击工作台右上角「运行 Agent 工作流」开始（演示）。
          </p>
        </PanelCard>
      ) : (
        <>
          <PanelCard icon={AlertTriangle} title={`待复核字段（${needsReview.length}）`} defaultOpen>
            <ul className="space-y-2">
              {needsReview.map((f) => (
                <li key={f.id} className="text-xs">
                  <p className="font-medium text-slate-700">
                    {f.label}
                    {f.value == null && (
                      <span className="ml-1.5 rounded bg-red-50 px-1 text-[11px] text-red-600">
                        缺失
                      </span>
                    )}
                  </p>
                  {f.missingNote && (
                    <p className="mt-0.5 leading-relaxed text-slate-500">{f.missingNote}</p>
                  )}
                </li>
              ))}
            </ul>
          </PanelCard>

          <PanelCard icon={FileQuestion} title={`缺失材料（${missingMaterials.length}）`}>
            <ul className="list-inside space-y-1.5 text-xs text-slate-600">
              {missingMaterials.slice(0, 5).map((m, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-slate-300">○</span>
                  {m}
                </li>
              ))}
              {missingMaterials.length > 5 && (
                <li className="text-slate-400">
                  …等 {missingMaterials.length} 项（见“证据与缺失”）
                </li>
              )}
            </ul>
          </PanelCard>

          <PanelCard icon={AlertTriangle} title={`复核发现（未处理 ${unresolved.length}）`}>
            <ul className="space-y-2.5">
              {unresolved.slice(0, 3).map((f) => (
                <li key={f.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <RiskBadge level={f.severity} />
                    <span className="text-slate-400">{FINDING_TYPE_LABELS[f.findingType]}</span>
                  </div>
                  <p className="mt-1 leading-relaxed text-slate-600">{f.message}</p>
                </li>
              ))}
              {unresolved.length === 0 && (
                <li className="text-xs text-emerald-700">全部复核发现已处理。</li>
              )}
            </ul>
          </PanelCard>

          <PanelCard icon={BookOpen} title={`法律依据来源（${LEGAL_SOURCES.length}）`}>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {LEGAL_SOURCES.slice(0, 4).map((s) => (
                <li key={s.id}>
                  <span className="font-medium text-slate-700">
                    {s.article ?? s.title}
                  </span>
                  <span className="text-slate-400"> · {s.relevance.slice(0, 18)}…</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400">
              {LEGAL_SOURCE_CAVEAT}
            </p>
          </PanelCard>
        </>
      )}
    </aside>
  );
}
