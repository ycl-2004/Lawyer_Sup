import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";
import { PRIVACY_NOTE } from "../../config/compliance";
import { useCase } from "../../state/CaseContext";
import { ConfidenceBadge, EmptyState, NeedsReviewBadge, SourceChip } from "../common/Badge";

export function OverviewSection() {
  const { matter, parties, facts, hasData, workflowAvailable } = useCase();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!hasData) {
    return (
      <EmptyState
        title="该案件尚未运行材料解析与事实抽取"
        hint={
          workflowAvailable
            ? "点击右上角「运行 Agent 工作流」生成分析结果（演示）"
            : "上传材料并运行工作流后在此查看案件概览"
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">案件摘要</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{matter.summary}</p>
        <p className="mt-2 text-xs text-amber-700">
          摘要由系统根据已上传材料生成，为草稿性概括，需律师核对。
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">当事人信息</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {parties.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <p className="text-xs text-slate-400">{p.role}</p>
              <p className="mt-0.5 font-medium text-slate-800">{p.name}</p>
              {p.idNumberRedacted && (
                <p className="mt-1 text-xs text-slate-500">{p.idNumberRedacted}</p>
              )}
              {p.contactRedacted && (
                <p className="text-xs text-slate-500">{p.contactRedacted}</p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-xs text-slate-400">{PRIVACY_NOTE}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">
          关键事实字段{" "}
          <span className="font-normal text-slate-400">
            （点击行查看来源原文与判断依据；缺失字段不做推测补全）
          </span>
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="w-6 py-2" />
                <th className="py-2 pr-3 font-medium">字段</th>
                <th className="py-2 pr-3 font-medium">值</th>
                <th className="py-2 pr-3 font-medium">置信度</th>
                <th className="py-2 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {facts.map((f) => {
                const expanded = expandedId === f.id;
                return (
                  <Fragment key={f.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : f.id)}
                      className="cursor-pointer border-b border-slate-100 align-top last:border-0 hover:bg-blue-50/30"
                    >
                      <td className="py-2.5 pr-1 text-slate-300">
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">{f.label}</td>
                      <td className="py-2.5 pr-3">
                        {f.value ? (
                          <span className="font-medium text-slate-800">{f.value}</span>
                        ) : (
                          <span className="italic text-red-600">【缺失】</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <ConfidenceBadge value={f.confidence} />
                      </td>
                      <td className="py-2.5">{f.needsReview && <NeedsReviewBadge />}</td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-slate-100 bg-slate-50/60 last:border-0">
                        <td />
                        <td colSpan={4} className="py-3 pr-3">
                          <div className="space-y-2 text-xs">
                            {f.source ? (
                              <div>
                                <p className="font-medium text-slate-500">来源</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <SourceChip source={f.source} />
                                  {f.source.quote && (
                                    <span className="border-l-2 border-blue-200 pl-2 italic text-slate-500">
                                      “{f.source.quote}”
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="italic text-red-600">
                                无材料来源——该字段不会写入正式草稿。
                              </p>
                            )}
                            {f.missingNote && (
                              <div>
                                <p className="font-medium text-slate-500">判断说明 / 待办</p>
                                <p className="mt-0.5 leading-relaxed text-slate-600">
                                  {f.missingNote}
                                </p>
                              </div>
                            )}
                            <p className="text-[11px] text-slate-400">
                              置信度为抽取模型对来源匹配的估计，不代表法律判断；最终以律师核实为准。
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
