import { ShieldAlert } from "lucide-react";
import { maskSensitive } from "../../lib/redact";
import type { CaseDocument } from "../../lib/types";
import { DOC_TYPE_LABELS } from "../../lib/types";
import { useCase } from "../../state/CaseContext";
import { ConfidenceBadge } from "../common/Badge";
import { Drawer } from "../common/Drawer";

/** 文档预览抽屉：全文、分类依据、关联抽取事实 */
export function DocumentPreview({
  doc,
  onClose,
}: {
  doc: CaseDocument | null;
  onClose: () => void;
}) {
  const { facts, timeline } = useCase();
  if (!doc) return null;

  const relatedFacts = facts.filter((f) => f.source?.documentId === doc.id);
  const relatedEvents = timeline.filter((e) =>
    e.sources.some((s) => s.documentId === doc.id),
  );

  return (
    <Drawer
      open={!!doc}
      onClose={onClose}
      title={doc.filename}
      subtitle={`${doc.id} · ${doc.pages} 页 · ${DOC_TYPE_LABELS[doc.docType]}`}
    >
      <div className="space-y-4">
        {doc.sensitive && (
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            本材料含敏感个人信息，预览已部分脱敏；对外导出前需再次确认脱敏处理。
          </p>
        )}

        <section>
          <h3 className="text-xs font-semibold text-slate-700">分类判断依据</h3>
          <div className="mt-1.5 flex items-center gap-2">
            <ConfidenceBadge value={doc.confidence} />
            <span className="text-xs text-slate-500">{doc.classificationReason}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            分类可在材料列表中人工修正；修正后置信度记为 100%（律师确认）。
          </p>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-slate-700">
            解析文本预览
            {doc.ocrStatus === "mocked" && (
              <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                OCR 为演示模拟结果
              </span>
            )}
          </h3>
          {doc.previewText ? (
            <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-700">
              {/* 数据层脱敏兜底：身份证/手机号/银行账号在渲染前统一遮蔽 */}
              {maskSensitive(doc.previewText)}
            </pre>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-400">
              暂无解析文本（演示模式下，新上传文件不读取内容；接入后端后此处显示真实解析结果与原件预览）。
            </p>
          )}
        </section>

        {relatedFacts.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-slate-700">
              由本材料抽取的事实（{relatedFacts.length}）
            </h3>
            <ul className="mt-2 space-y-2">
              {relatedFacts.map((f) => (
                <li key={f.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700">{f.label}</span>
                    <ConfidenceBadge value={f.confidence} />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {f.value ?? <span className="italic text-red-600">缺失</span>}
                  </p>
                  {f.source?.quote && (
                    <p className="mt-1 border-l-2 border-blue-200 pl-2 text-[11px] italic text-slate-400">
                      原文：“{f.source.quote}”
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {relatedEvents.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-slate-700">
              关联时间线事件（{relatedEvents.length}）
            </h3>
            <ul className="mt-2 space-y-1">
              {relatedEvents.map((e) => (
                <li key={e.id} className="flex gap-2 text-xs text-slate-600">
                  <span className="shrink-0 font-mono text-slate-400">{e.date}</span>
                  {e.title}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Drawer>
  );
}
