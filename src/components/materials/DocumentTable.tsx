import { Eye, FileImage, FileText, Trash2 } from "lucide-react";
import type { CaseDocument, DocumentType } from "../../lib/types";
import { DOC_TYPE_LABELS } from "../../lib/types";
import { useCase } from "../../state/CaseContext";
import { ConfidenceBadge } from "../common/Badge";

/**
 * 精简材料表：详情（全文、分类依据、关联事实）收纳进预览抽屉，
 * 点击行或眼睛图标打开。
 */
export function DocumentTable({
  documents,
  onPreview,
  onPasteText,
}: {
  documents: CaseDocument[];
  onPreview: (doc: CaseDocument) => void;
  /** 实时案件：解析失败材料的"手动粘贴文本"兜底入口 */
  onPasteText?: (doc: CaseDocument) => void;
}) {
  const { setDocumentType, removeDocument } = useCase();

  const remove = (d: CaseDocument) => {
    if (window.confirm(`确定删除材料「${d.filename}」？此操作不可撤销。`)) {
      removeDocument(d.id);
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th className="px-4 py-3 font-medium">文件</th>
            <th className="px-4 py-3 font-medium">材料类型（可修正）</th>
            <th className="px-4 py-3 font-medium">状态</th>
            <th className="px-4 py-3 font-medium">置信度</th>
            <th className="px-4 py-3 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr
              key={d.id}
              onClick={() => onPreview(d)}
              className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-blue-50/40"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {d.fileType === "png" || d.fileType === "jpg" ? (
                    <FileImage size={16} className="shrink-0 text-slate-400" />
                  ) : (
                    <FileText size={16} className="shrink-0 text-slate-400" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{d.filename}</p>
                    <p className="font-mono text-[11px] text-slate-400">
                      {d.id} · {d.pages} 页
                      {d.sensitive && (
                        <span className="ml-1.5 rounded bg-red-50 px-1 font-sans text-red-600">
                          敏感
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <select
                  value={d.docType}
                  onChange={(e) => setDocumentType(d.id, e.target.value as DocumentType)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
                >
                  {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map((t) => (
                    <option key={t} value={t}>
                      {DOC_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                {d.parseStatus === "parsed" ? (
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    已解析{d.ocrStatus === "mocked" ? " · OCR模拟" : ""}
                  </span>
                ) : d.parseStatus === "pending" ? (
                  <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                    解析中…
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-600"
                      title={d.parseError ?? "解析失败"}
                    >
                      解析失败
                    </span>
                    {onPasteText && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPasteText(d);
                        }}
                        className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                      >
                        粘贴文本
                      </button>
                    )}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <ConfidenceBadge value={d.confidence} />
              </td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onPreview(d)}
                  title="预览全文与分类依据"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => remove(d)}
                  title="删除材料"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
