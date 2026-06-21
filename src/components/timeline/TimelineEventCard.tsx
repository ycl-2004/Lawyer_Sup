import { Flag, Trash2 } from "lucide-react";
import type { TimelineEvent } from "../../lib/types";
import { formatDate } from "../../lib/utils";
import { useCase } from "../../state/CaseContext";
import { ConfidenceBadge, NeedsReviewBadge, SourceChip } from "../common/Badge";

export function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const { toggleEventDisputed, removeEvent } = useCase();

  return (
    <li className="relative">
      <span
        className={`absolute -left-[26px] top-1.5 h-3 w-3 rounded-full border-2 border-white ${
          event.disputed ? "bg-red-500" : "bg-blue-500"
        }`}
      />
      <div
        className={`rounded-xl border bg-white p-3.5 ${
          event.disputed ? "border-red-200" : "border-slate-200"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-500">{formatDate(event.date)}</span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
            {event.eventType}
          </span>
          <ConfidenceBadge value={event.confidence} />
          {event.disputed && (
            <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
              存在争议
            </span>
          )}
          {event.needsReview && <NeedsReviewBadge />}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => toggleEventDisputed(event.id)}
              title="标记/取消争议事实"
              className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
            >
              <Flag size={13} />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`确定删除事件「${event.title}」？此操作不可撤销。`)) {
                  removeEvent(event.id);
                }
              }}
              title="删除事件"
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-sm font-medium text-slate-800">{event.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{event.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {event.sources.length > 0 ? (
            event.sources.map((s, i) => <SourceChip key={i} source={s} />)
          ) : (
            <span className="text-[11px] italic text-red-500">
              无材料来源 — 不得写入正式草稿
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
