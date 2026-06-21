import { Plus } from "lucide-react";
import { useState } from "react";
import type { TimelineEvent, TimelineEventType } from "../../lib/types";
import { TIMELINE_EVENT_TYPES } from "../../lib/types";
import { useCase } from "../../state/CaseContext";
import { EmptyState } from "../common/Badge";
import { TimelineEventCard } from "../timeline/TimelineEventCard";

export function TimelineSection() {
  const { timeline, addEvent, hasData, workflowAvailable } = useCase();
  const [filter, setFilter] = useState<TimelineEventType | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", type: "其他" as TimelineEventType, title: "" });

  if (!hasData) {
    return (
      <EmptyState
        title="暂无时间线"
        hint={
          workflowAvailable
            ? "点击右上角「运行 Agent 工作流」生成可编辑时间线（演示）"
            : "运行事实抽取后将自动生成可编辑时间线"
        }
      />
    );
  }

  const visible = timeline.filter((e) => filter === "all" || e.eventType === filter);

  const submit = () => {
    if (!form.date || !form.title) return;
    const evt: TimelineEvent = {
      id: `t_manual_${Date.now()}`,
      date: form.date,
      eventType: form.type,
      title: form.title,
      description: "人工添加事件（无材料来源，需补充证据支持）",
      sources: [],
      confidence: 1,
      disputed: false,
      needsReview: true,
    };
    addEvent(evt);
    setForm({ date: "", type: "其他", title: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as TimelineEventType | "all")}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
        >
          <option value="all">全部事件类型</option>
          {TIMELINE_EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">
          共 {timeline.length} 个事件 · 标记“存在争议”的事件需重点复核
        </span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700"
        >
          <Plus size={13} /> 添加事件
        </button>
      </div>

      {showForm && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
          <label className="text-xs text-slate-600">
            日期
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
            />
          </label>
          <label className="text-xs text-slate-600">
            类型
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as TimelineEventType })}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
            >
              {TIMELINE_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 text-xs text-slate-600">
            事件标题
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="如：公司发出调岗通知"
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
            />
          </label>
          <button
            onClick={submit}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            添加（标记为需复核）
          </button>
        </div>
      )}

      <ol className="relative space-y-3 border-l border-slate-200 pl-5">
        {visible.map((e) => (
          <TimelineEventCard key={e.id} event={e} />
        ))}
        {visible.length === 0 && (
          <p className="text-xs text-slate-400">当前筛选无事件。</p>
        )}
      </ol>
    </div>
  );
}
