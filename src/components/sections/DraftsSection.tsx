import { useState } from "react";
import { DRAFT_BANNER } from "../../config/compliance";
import { useCase } from "../../state/CaseContext";
import { EmptyState } from "../common/Badge";
import { DraftEditor } from "../drafts/DraftEditor";
import { cls } from "../../lib/utils";

export function DraftsSection() {
  const { drafts, hasData, workflowAvailable } = useCase();
  const [activeId, setActiveId] = useState(drafts[0]?.id ?? "");

  if (!hasData || drafts.length === 0) {
    return (
      <EmptyState
        title="暂无文书草稿"
        hint={
          workflowAvailable && !hasData
            ? "点击右上角「运行 Agent 工作流」生成文书草稿（演示）"
            : "完成请求项与计算确认后生成草稿"
        }
      />
    );
  }

  const active = drafts.find((d) => d.id === activeId) ?? drafts[0];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
        ⚠️ {DRAFT_BANNER}
      </div>

      <div className="flex gap-1.5">
        {drafts.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveId(d.id)}
            className={cls(
              "rounded-lg px-3 py-1.5 text-xs font-medium",
              d.id === active.id
                ? "bg-blue-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300",
            )}
          >
            {d.title}
          </button>
        ))}
      </div>

      <DraftEditor draft={active} />
    </div>
  );
}
