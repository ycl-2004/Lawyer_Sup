import { Copy, FileDown, RefreshCw } from "lucide-react";
import { useState } from "react";
import { exportMarkdownAsDocx } from "../../lib/exportDocx";
import { maskSensitive } from "../../lib/redact";
import type { Draft } from "../../lib/types";
import { extractPlaceholders } from "../../lib/utils";
import { useCase } from "../../state/CaseContext";

export function DraftEditor({ draft }: { draft: Draft }) {
  const { updateDraft } = useCase();
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const placeholders = extractPlaceholders(draft.contentMarkdown);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft.contentMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用时静默失败 */
    }
  };

  const exportDocx = async () => {
    // 占位符拦截：未处理完毕的草稿导出前需明确确认
    if (placeholders.length > 0) {
      const ok = window.confirm(
        `当前草稿仍有 ${placeholders.length} 处待办占位符未处理（如 ${placeholders[0]}）。\n` +
          "导出件首页带红色草稿水印且保留占位符。确定仍要导出吗？",
      );
      if (!ok) return;
    }
    setExporting(true);
    try {
      // 数据层脱敏兜底后再导出
      await exportMarkdownAsDocx(
        maskSensitive(draft.contentMarkdown),
        `${draft.title.replace(/[\\/:*?"<>|]/g, "_")}_草稿.docx`,
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_260px]">
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{draft.title}</span>
            <span className="ml-2">
              v{draft.version} · 生成于 {draft.generatedAt}
            </span>
          </div>
          <div className="ml-auto flex gap-1.5">
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700"
            >
              <Copy size={12} /> {copied ? "已复制" : "复制 Markdown"}
            </button>
            <button
              onClick={exportDocx}
              disabled={exporting}
              title="导出 Word 草稿（首页含红色草稿水印）"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700"
            >
              <FileDown size={12} /> {exporting ? "导出中…" : "导出 docx（草稿水印）"}
            </button>
            <button
              disabled
              title="演示版：重新生成需接入后端 DraftAgent"
              className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-400"
            >
              <RefreshCw size={12} /> 重新生成
            </button>
          </div>
        </div>
        <textarea
          value={draft.contentMarkdown}
          onChange={(e) => updateDraft(draft.id, e.target.value)}
          spellCheck={false}
          className="h-[560px] w-full resize-y rounded-b-xl bg-white p-4 font-mono text-xs leading-relaxed text-slate-700 outline-none"
        />
      </div>

      <aside className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <h3 className="text-xs font-semibold text-slate-700">
            待办占位符（{placeholders.length}）
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            缺失事实以占位符标注，绝不由模型补全。全部占位符处理完毕前不应导出。
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {placeholders.map((p, i) => (
              <li
                key={i}
                className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-800"
              >
                {p}
              </li>
            ))}
            {placeholders.length === 0 && (
              <li className="text-[11px] text-emerald-700">无未处理占位符。</li>
            )}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <h3 className="text-xs font-semibold text-slate-700">生成依据</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] text-slate-500">
            {draft.basedOn.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
            docx 导出件首页强制带草稿水印；PDF 导出在后续版本提供。
          </p>
        </div>
      </aside>
    </div>
  );
}
