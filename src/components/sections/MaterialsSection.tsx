import { Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { submitDocumentText, uploadDocumentBackend } from "../../lib/api";
import type { CaseDocument } from "../../lib/types";
import { useCase } from "../../state/CaseContext";
import { EmptyState } from "../common/Badge";
import { Drawer } from "../common/Drawer";
import { DocumentPreview } from "../materials/DocumentPreview";
import { DocumentTable } from "../materials/DocumentTable";
import { cls } from "../../lib/utils";

export function MaterialsSection() {
  const {
    matter,
    documents,
    hasData,
    workflowAvailable,
    isLive,
    refresh,
    addDocument,
    markDocumentParsed,
  } = useCase();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<CaseDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [pasteDoc, setPasteDoc] = useState<CaseDocument | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteSubmitting, setPasteSubmitting] = useState(false);

  /** 实时案件：真实上传到后端（保存原件 + 解析）；演示案件：仅登记模拟 */
  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (isLive) {
      setUploading(true);
      setUploadMsg(null);
      let failed = 0;
      for (const f of Array.from(files)) {
        try {
          const res = await uploadDocumentBackend(matter.id, f);
          if (res.parse_status === "failed") failed += 1;
        } catch {
          setUploadMsg(`「${f.name}」上传失败：后端未连接或文件过大（限 20MB）。`);
        }
      }
      await refresh();
      setUploading(false);
      if (failed > 0) {
        setUploadMsg(
          `已上传，但有 ${failed} 份材料无法自动解析（扫描件/图片等）——点击对应行的「粘贴文本」补录内容后再运行工作流。`,
        );
      }
      return;
    }

    Array.from(files).forEach((f, idx) => {
      const id = `doc_up_${Date.now()}_${idx}`;
      const ext = (f.name.split(".").pop() ?? "file").toLowerCase();
      addDocument({
        id,
        matterId: matter.id,
        filename: f.name,
        fileType: ext,
        docType: "unknown",
        pages: 1,
        parseStatus: "pending",
        ocrStatus: ["png", "jpg", "jpeg", "pdf"].includes(ext) ? "mocked" : "not_needed",
        confidence: 0.4,
        classificationReason: "演示模式：未接入真实解析与 LLM 分类，请人工指定材料类型",
        keyExcerpt: "（演示）文件内容未解析；实时案件支持真实解析。",
      });
      setTimeout(() => markDocumentParsed(id), 1400);
    });
  };

  const submitPaste = async () => {
    if (!pasteDoc || !pasteText.trim()) return;
    setPasteSubmitting(true);
    try {
      await submitDocumentText(pasteDoc.id, pasteText.trim());
      await refresh();
      setPasteDoc(null);
      setPasteText("");
    } catch {
      setUploadMsg("提交失败：后端未连接。");
    } finally {
      setPasteSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cls(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white px-4 py-8 text-center transition-colors",
          dragging ? "border-blue-400 bg-blue-50/50" : "border-slate-300",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <Loader2 className="animate-spin text-blue-500" size={28} />
        ) : (
          <UploadCloud className={dragging ? "text-blue-400" : "text-slate-300"} size={28} />
        )}
        <p className="mt-2 text-sm font-medium text-slate-500">
          {uploading ? "正在上传并解析…" : "拖拽或点击上传客户材料（PDF / docx / txt）"}
        </p>
        <p className="mt-1 max-w-md text-xs text-slate-400">
          {isLive
            ? "实时案件：文件保存在本机并真实解析（PDF/docx/txt）；扫描件与图片暂不支持 OCR，可用「粘贴文本」补录。上传后点右上角「运行 Agent 工作流」开始分析。"
            : "演示模式：仅登记文件并模拟解析状态，不读取文件内容。新建「实时案件」可体验真实解析与持久化。"}
        </p>
      </div>

      {uploadMsg && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          {uploadMsg}
        </p>
      )}

      {documents.length > 0 ? (
        <>
          <p className="text-xs text-slate-400">
            点击任意材料行可预览解析全文、分类依据与关联事实。
          </p>
          <DocumentTable
            documents={documents}
            onPreview={setPreviewDoc}
            onPasteText={isLive ? (d) => setPasteDoc(d) : undefined}
          />
          <DocumentPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />
        </>
      ) : (
        <EmptyState
          title="暂无材料"
          hint={
            isLive
              ? "上传材料后点击「运行 Agent 工作流」开始真实解析与抽取"
              : workflowAvailable && !hasData
                ? "可先上传材料，或点击右上角「运行 Agent 工作流」载入演示分析结果"
                : "上传材料后在此查看解析与分类结果"
          }
        />
      )}

      {/* 手动粘贴文本兜底（解析失败/扫描件/图片） */}
      <Drawer
        open={!!pasteDoc}
        onClose={() => setPasteDoc(null)}
        title={`粘贴文本 · ${pasteDoc?.filename ?? ""}`}
        subtitle={pasteDoc?.parseError ?? "将文件中的文字内容粘贴到下方，系统将以此参与分析"}
      >
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="在此粘贴材料的文字内容（如从扫描件中人工誊录的文本）…"
          className="h-72 w-full resize-y rounded-lg border border-slate-200 p-3 text-sm"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={() => setPasteDoc(null)}
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs text-slate-600"
          >
            取消
          </button>
          <button
            onClick={() => void submitPaste()}
            disabled={pasteSubmitting || !pasteText.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pasteSubmitting && <Loader2 size={12} className="animate-spin" />}
            提交（标记为人工录入）
          </button>
        </div>
      </Drawer>
    </div>
  );
}
