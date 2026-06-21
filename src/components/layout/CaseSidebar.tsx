import {
  Calculator,
  ClipboardCheck,
  FileText,
  Files,
  LayoutDashboard,
  ListTree,
  Scale,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useCase } from "../../state/CaseContext";
import { cls } from "../../lib/utils";

export type SectionKey =
  | "overview"
  | "materials"
  | "timeline"
  | "claims"
  | "evidence"
  | "drafts"
  | "review";

export const SECTIONS: { key: SectionKey; label: string; icon: typeof Files }[] = [
  { key: "overview", label: "案件概览", icon: LayoutDashboard },
  { key: "materials", label: "材料管理", icon: Files },
  { key: "timeline", label: "事实时间线", icon: ListTree },
  { key: "claims", label: "请求项与计算", icon: Calculator },
  { key: "evidence", label: "证据与缺失", icon: Scale },
  { key: "drafts", label: "文书草稿", icon: FileText },
  { key: "review", label: "复核与确认", icon: ClipboardCheck },
];

export function CaseSidebar({ matterId }: { matterId: string }) {
  const { documents, timeline, claims, findings, missingMaterials } = useCase();
  const unresolved = findings.filter((f) => !f.resolved).length;

  const counts: Partial<Record<SectionKey, number>> = {
    materials: documents.length,
    timeline: timeline.length,
    claims: claims.filter((c) => c.status !== "excluded").length,
    evidence: missingMaterials.length,
    review: unresolved,
  };

  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-visible">
      {SECTIONS.map((s, i) => (
        <NavLink
          key={s.key}
          to={`/matters/${matterId}/${s.key}`}
          className={({ isActive }) =>
            cls(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
              isActive
                ? "bg-blue-600 font-medium text-white"
                : "text-slate-600 hover:bg-slate-200/60",
            )
          }
        >
          <span className="hidden w-4 text-xs opacity-60 lg:inline">{i + 1}</span>
          <s.icon size={15} className="shrink-0" />
          <span className="whitespace-nowrap">{s.label}</span>
          {counts[s.key] != null && counts[s.key]! > 0 && (
            <span
              className={cls(
                "ml-auto rounded-full px-1.5 text-[11px]",
                s.key === "review"
                  ? "bg-red-100 font-medium text-red-700"
                  : "bg-slate-200 text-slate-600",
              )}
            >
              {counts[s.key]}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
