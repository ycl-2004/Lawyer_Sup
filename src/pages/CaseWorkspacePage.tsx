import { ChevronLeft, Loader2, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { RiskBadge, StatusBadge } from "../components/common/Badge";
import { Drawer } from "../components/common/Drawer";
import { CaseSidebar, type SectionKey } from "../components/layout/CaseSidebar";
import { InspectorPanel } from "../components/layout/InspectorPanel";
import { ClaimsSection } from "../components/sections/ClaimsSection";
import { DraftsSection } from "../components/sections/DraftsSection";
import { EvidenceSection } from "../components/sections/EvidenceSection";
import { MaterialsSection } from "../components/sections/MaterialsSection";
import { OverviewSection } from "../components/sections/OverviewSection";
import { ReviewSection } from "../components/sections/ReviewSection";
import { TimelineSection } from "../components/sections/TimelineSection";
import { WorkflowRunModal } from "../components/workflow/WorkflowRunModal";
import { getMatter } from "../data/matters";
import { getWorkspaceBundle } from "../lib/api";
import type { Matter } from "../lib/types";
import { CaseProvider, useCase } from "../state/CaseContext";
import { cls } from "../lib/utils";

const VALID_SECTIONS: SectionKey[] = [
  "overview",
  "materials",
  "timeline",
  "claims",
  "evidence",
  "drafts",
  "review",
];

export function CaseWorkspacePage() {
  const { matterId = "", section } = useParams();
  const localMatter = getMatter(matterId);
  const [liveMatter, setLiveMatter] = useState<Matter | null>(null);
  const [loading, setLoading] = useState(!localMatter);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 本地（演示）案件直接用；否则向后端查实时案件
  useEffect(() => {
    if (localMatter || !matterId) return;
    let alive = true;
    setLoading(true);
    getWorkspaceBundle(matterId)
      .then((b) => alive && setLiveMatter(b.matter))
      .catch(() =>
        alive &&
        setLoadError("未找到该案件，或后端服务未启动（实时案件需要后端运行）。"),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [matterId, localMatter]);

  const active: SectionKey = VALID_SECTIONS.includes(section as SectionKey)
    ? (section as SectionKey)
    : "overview";

  if (localMatter) {
    return (
      <CaseProvider matter={localMatter}>
        <WorkspaceInner matter={localMatter} active={active} />
      </CaseProvider>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin text-blue-600" /> 正在从本地数据库载入案件…
      </div>
    );
  }
  if (loadError || !liveMatter) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="text-sm font-medium text-slate-700">{loadError ?? "案件不存在"}</p>
        <Link to="/" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
          返回案件列表
        </Link>
        {!loadError && <Navigate to="/" replace />}
      </div>
    );
  }
  return (
    <CaseProvider matter={liveMatter} live>
      <WorkspaceInner matter={liveMatter} active={active} />
    </CaseProvider>
  );
}

function WorkspaceInner({ matter, active }: { matter: Matter; active: SectionKey }) {
  const {
    hasData,
    workflowAvailable,
    completeWorkflowRun,
    facts,
    findings,
    isLive,
    refresh,
    refreshing,
    backendError,
  } = useCase();
  const [showRunModal, setShowRunModal] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const alertCount =
    facts.filter((f) => f.needsReview).length + findings.filter((f) => !f.resolved).length;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-4 lg:px-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <Link
          to="/"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-blue-700"
        >
          <ChevronLeft size={16} /> 案件列表
        </Link>
        <span className="text-slate-300">/</span>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-slate-900">{matter.title}</h1>
          <p className="text-xs text-slate-400">
            {matter.clientCode} · {matter.jurisdiction} · 负责人 {matter.leadLawyer}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          {isLive ? (
            <span
              className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
              title="实时案件：数据保存在本机数据库；任何打开/编辑都会自动续期保留时间"
            >
              本地已持久化{matter.retentionUntil ? ` · 保留至 ${matter.retentionUntil}` : ""}
            </span>
          ) : (
            <span
              className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
              title="演示版未接持久化：刷新页面后人工编辑将恢复为预置数据"
            >
              演示数据 · 编辑不保存
            </span>
          )}
          <RiskBadge level={matter.riskLevel} />
          <StatusBadge status={matter.status} />
          {isLive && (
            <button
              onClick={() => void refresh()}
              disabled={refreshing}
              title="从本地数据库重新载入"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:border-blue-300"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> 刷新
            </button>
          )}
          <button
            disabled={!workflowAvailable}
            onClick={() => setShowRunModal(true)}
            title={
              isLive
                ? "对已上传材料执行真实解析、抽取与分析，结果持久化到本地数据库"
                : workflowAvailable
                  ? "演示模式：本地模拟工作流，结果为预置数据"
                  : "该案件暂无演示数据集"
            }
            className={cls(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
              workflowAvailable
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400",
            )}
          >
            <Play size={13} />
            {hasData ? "重新运行工作流" : "运行 Agent 工作流"}
          </button>
        </div>
      </div>

      {backendError && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {backendError}
        </p>
      )}

      {/* Three-column workspace */}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <CaseSidebar matterId={matter.id} />
        <div className="min-w-0 flex-1">
          {active === "overview" && <OverviewSection />}
          {active === "materials" && <MaterialsSection />}
          {active === "timeline" && <TimelineSection />}
          {active === "claims" && <ClaimsSection />}
          {active === "evidence" && <EvidenceSection />}
          {active === "drafts" && <DraftsSection />}
          {active === "review" && <ReviewSection />}
        </div>
        <div className="hidden xl:block">
          <InspectorPanel />
        </div>
      </div>

      {/* 窄屏：浮动按钮唤出 AI Inspector */}
      <button
        onClick={() => setInspectorOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2.5 text-xs font-medium text-white shadow-lg hover:bg-blue-700 xl:hidden"
      >
        <ShieldCheck size={14} /> AI Inspector
        {alertCount > 0 && (
          <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-semibold">
            {alertCount}
          </span>
        )}
      </button>
      <Drawer
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        title="AI Inspector"
        subtitle="来源、待复核字段、缺失材料与复核发现"
      >
        <InspectorPanel />
      </Drawer>

      {showRunModal && (
        <WorkflowRunModal
          matterId={matter.id}
          alreadyLoaded={hasData}
          onComplete={isLive ? () => void refresh() : completeWorkflowRun}
          onClose={() => setShowRunModal(false)}
        />
      )}
    </div>
  );
}
