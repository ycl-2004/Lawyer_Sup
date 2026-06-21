import { BookOpenCheck, CheckCircle2, Download, Loader2, Lock, Server } from "lucide-react";
import { useState } from "react";
import {
  APPROVAL_CHECKLIST,
  GLOBAL_DISCLAIMER,
  REVIEW_GATE_NOTE,
} from "../../config/compliance";
import { checkCitationsBackend, type CitationCheckResult } from "../../lib/api";
import { downloadText } from "../../lib/exportDocx";
import { checkCitationsLocal } from "../../lib/legalSearch";
import { maskSensitive } from "../../lib/redact";
import { canConfirmReview, highUnresolvedFindings } from "../../lib/reviewGate";
import { extractPlaceholders } from "../../lib/utils";
import { FINDING_TYPE_LABELS, type RiskLevel } from "../../lib/types";
import { useCase } from "../../state/CaseContext";
import { EmptyState } from "../common/Badge";
import { ReviewFindingList } from "../review/ReviewFindingList";
import { cls } from "../../lib/utils";

export function ReviewSection() {
  const {
    matter,
    drafts,
    missingMaterials,
    findings,
    approvals,
    toggleApproval,
    confirmation,
    confirmLawyer,
    hasData,
    workflowAvailable,
  } = useCase();
  const lawyerConfirmed = !!confirmation;
  const [filter, setFilter] = useState<RiskLevel | "all">("all");
  const [lawyerName, setLawyerName] = useState("");
  const [citation, setCitation] = useState<CitationCheckResult | null>(null);
  const [citationMode, setCitationMode] = useState<"backend" | "local" | null>(null);
  const [checking, setChecking] = useState(false);

  if (!hasData) {
    return (
      <EmptyState
        title="暂无复核报告"
        hint={
          workflowAvailable
            ? "点击右上角「运行 Agent 工作流」生成复核报告（演示）"
            : "生成文书草稿后由 Review 检查器输出发现项"
        }
      />
    );
  }

  const visible = findings.filter((f) => filter === "all" || f.severity === filter);
  const highUnresolved = highUnresolvedFindings(findings);
  const canConfirm = canConfirmReview({ approvals, findings, lawyerName });

  /** 引用核对：检查全部草稿引用的法条是否存在于知识库（反幻觉引用） */
  const runCitationCheck = async () => {
    const text = drafts.map((d) => d.contentMarkdown).join("\n\n");
    setChecking(true);
    try {
      const res = await checkCitationsBackend(text);
      setCitation(res);
      setCitationMode("backend");
    } catch {
      setCitation(checkCitationsLocal(text));
      setCitationMode("local");
    } finally {
      setChecking(false);
    }
  };

  /** 导出案件材料包（Markdown，含免责声明、确认审计记录；导出前做脱敏与占位符拦截） */
  const exportBundle = () => {
    const unresolved = drafts.flatMap((d) => extractPlaceholders(d.contentMarkdown));
    if (unresolved.length > 0) {
      const ok = window.confirm(
        `草稿中仍有 ${unresolved.length} 处待办占位符未处理（如 ${unresolved[0]}）。\n` +
          "导出件将保留占位符并标记为草稿。确定仍要导出吗？",
      );
      if (!ok) return;
    }
    const parts: string[] = [
      `> ${GLOBAL_DISCLAIMER}`,
      "",
      `# 案件材料包（草稿） · ${matter.title}`,
      "",
      `- 客户代号：${matter.clientCode}　地区：${matter.jurisdiction}　负责人：${matter.leadLawyer}`,
      `- 律师复核确认：${confirmation?.name ?? "—"}（确认时间：${confirmation?.at ?? "—"}）`,
      `- 导出时间：${new Date().toLocaleString("zh-CN")}　未处理占位符：${unresolved.length} 处`,
      "",
      "## 缺失材料清单",
      "",
      ...missingMaterials.map((m) => `- [ ] ${m}`),
      "",
      "## 复核发现处理记录",
      "",
      ...findings.map(
        (f) =>
          `- [${f.resolved ? "x" : " "}] [${f.severity}] ${FINDING_TYPE_LABELS[f.findingType]}：${f.message}`,
      ),
      "",
    ];
    for (const d of drafts) {
      parts.push("---", "", d.contentMarkdown, "");
    }
    // 数据层脱敏兜底：身份证号/手机号/银行账号
    downloadText(maskSensitive(parts.join("\n")), `${matter.clientCode}_材料包_草稿.md`);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">
            复核发现（{findings.filter((f) => !f.resolved).length} 项未处理）
          </h2>
          <div className="ml-auto flex gap-1">
            {(["all", "high", "medium", "low"] as const).map((lv) => (
              <button
                key={lv}
                onClick={() => setFilter(lv)}
                className={cls(
                  "rounded-lg px-2.5 py-1 text-xs",
                  filter === lv
                    ? "bg-blue-600 font-medium text-white"
                    : "border border-slate-200 bg-white text-slate-600",
                )}
              >
                {lv === "all" ? "全部" : lv === "high" ? "高" : lv === "medium" ? "中" : "低"}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          由 Review 检查器对草稿做质量控制：无来源事实、引用匹配、过度结论、隐私脱敏。
        </p>
        <div className="mt-3">
          <ReviewFindingList findings={visible} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <BookOpenCheck size={14} className="text-blue-600" /> 引用核对（RAG）
          </h2>
          {citationMode === "backend" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
              <Server size={11} /> 后端核对
            </span>
          )}
          {citationMode === "local" && (
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
              本地核对（回退）
            </span>
          )}
          <button
            onClick={runCitationCheck}
            disabled={checking || drafts.length === 0}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {checking ? <Loader2 size={12} className="animate-spin" /> : <BookOpenCheck size={12} />}
            核对全部草稿引用
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          提取草稿中的《法律》第X条引用并与知识库比对：未命中 = 可能为幻觉引用或库未覆盖（高风险）；
          命中也仅说明存在于演示知识库，正式引用前仍须核对官方文本。
        </p>
        {citation && (
          <div className="mt-3">
            <p className="text-xs text-slate-500">
              共发现 {citation.total_citations} 处引用，
              <span className={citation.unmatched > 0 ? "font-medium text-red-600" : "text-emerald-700"}>
                {citation.unmatched} 处未命中知识库
              </span>
            </p>
            <ul className="mt-2 space-y-1.5">
              {citation.findings.map((f, i) => (
                <li
                  key={i}
                  className={cls(
                    "flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                    f.severity === "high"
                      ? "border-red-200 bg-red-50/50 text-red-700"
                      : f.severity === "medium"
                        ? "border-amber-200 bg-amber-50/50 text-amber-800"
                        : "border-slate-100 bg-slate-50/60 text-slate-600",
                  )}
                >
                  <span className="font-medium">{f.citation}</span>
                  {f.matched_title && <span className="text-slate-500">→ {f.matched_title}</span>}
                  {f.effective_date && (
                    <span className="text-[11px] text-slate-400">生效 {f.effective_date}</span>
                  )}
                  <span className="w-full text-[11px] leading-relaxed opacity-80 sm:w-auto sm:flex-1">
                    {f.message}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-blue-200 bg-white p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Lock size={14} className="text-blue-600" /> 律师确认（导出门槛）
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{REVIEW_GATE_NOTE}</p>

        <ul className="mt-3 space-y-2">
          {APPROVAL_CHECKLIST.map((c) => (
            <li key={c.key}>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!!approvals[c.key]}
                  onChange={() => toggleApproval(c.key)}
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                {c.label}
              </label>
            </li>
          ))}
        </ul>

        {highUnresolved.length > 0 && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            尚有 {highUnresolved.length} 项高风险复核发现未处理，处理完成前无法确认。
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={lawyerName}
            onChange={(e) => setLawyerName(e.target.value)}
            placeholder="承办律师姓名（确认人）"
            className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={lawyerConfirmed}
          />
          <button
            disabled={!canConfirm || lawyerConfirmed}
            onClick={() => confirmLawyer(lawyerName.trim())}
            className={cls(
              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium",
              lawyerConfirmed
                ? "bg-emerald-600 text-white"
                : canConfirm
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "cursor-not-allowed bg-slate-200 text-slate-400",
            )}
          >
            <CheckCircle2 size={15} />
            {lawyerConfirmed ? "已确认复核完成" : "确认复核完成"}
          </button>
          <button
            disabled={!lawyerConfirmed}
            onClick={exportBundle}
            title={
              lawyerConfirmed
                ? "下载 Markdown 材料包（含免责声明与复核记录）；docx 草稿可在文书页单独导出"
                : "需律师确认复核后方可导出"
            }
            className={cls(
              "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium",
              lawyerConfirmed
                ? "border-blue-300 text-blue-700 hover:bg-blue-50"
                : "cursor-not-allowed border-slate-200 text-slate-400",
            )}
          >
            <Download size={15} /> 导出材料包（Markdown）
          </button>
        </div>
        {confirmation && (
          <p className="mt-2.5 text-xs text-emerald-700">
            已记录律师确认：{confirmation.name} · {confirmation.at}
            （演示版记录在前端，正式版将落库并写入审计日志）。
            材料包含免责声明、确认记录与复核处理记录；单篇文书的 docx 草稿（带水印）可在「文书草稿」页导出。
          </p>
        )}
      </section>
    </div>
  );
}
