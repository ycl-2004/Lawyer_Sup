import { CheckCircle2, Circle, Loader2, Server, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { runWorkflowBackend } from "../../lib/api";
import { cls } from "../../lib/utils";

interface Step {
  key: string;
  label: string;
  desc: string;
}

/** 本地模拟步骤（与计划 §9.3 LangGraph 节点一致），后端不可达时使用 */
const LOCAL_NODES: Step[] = [
  { key: "parse_documents", label: "解析材料", desc: "PDF/图片/文本 → 可引用文本块" },
  { key: "classify_documents", label: "分类材料", desc: "识别材料类型并给出依据与置信度" },
  { key: "extract_facts", label: "抽取事实", desc: "结构化字段，逐项附来源，缺失返回 null" },
  { key: "build_timeline", label: "生成时间线", desc: "归并事件、标记冲突与争议" },
  { key: "identify_claims", label: "识别请求项", desc: "映射事实→请求→所需证据" },
  { key: "calculate_amounts", label: "计算金额", desc: "确定性计算服务（非 LLM），缺输入即拒绝" },
  { key: "retrieve_legal_sources", label: "检索法条（RAG）", desc: "混合检索，引用带生效日期" },
  { key: "draft_documents", label: "生成草稿", desc: "模板填充，缺失事实用占位符" },
  { key: "review_outputs", label: "复核检查", desc: "无来源事实 / 引用匹配 / 隐私 / 过度结论" },
];

const STEP_MS = 600;

export function WorkflowRunModal({
  matterId,
  alreadyLoaded,
  onComplete,
  onClose,
}: {
  matterId: string;
  alreadyLoaded: boolean;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [wasLoaded] = useState(alreadyLoaded);
  const [steps, setSteps] = useState<Step[] | null>(null); // null = 连接后端中
  const [mode, setMode] = useState<"backend" | "local" | null>(null);
  const [current, setCurrent] = useState(0);
  const done = steps != null && current >= steps.length;

  // 优先尝试后端真实管线；不可达时回退本地模拟
  useEffect(() => {
    let alive = true;
    runWorkflowBackend(matterId)
      .then((res) => {
        if (!alive) return;
        setSteps(
          res.events.map((e) => ({
            key: e.node,
            label: e.label + (e.status === "error" ? "（失败）" : ""),
            desc: e.summary,
          })),
        );
        setMode("backend");
      })
      .catch(() => {
        if (!alive) return;
        setSteps(LOCAL_NODES);
        setMode("local");
      });
    return () => {
      alive = false;
    };
  }, [matterId]);

  const completedRef = useRef(false);
  useEffect(() => {
    if (steps == null) return;
    if (done) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete(); // 只触发一次，避免父级状态更新引发的重复回调
      }
      return;
    }
    const t = setTimeout(() => setCurrent((c) => c + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [steps, current, done, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            运行 Agent 工作流
            {mode === "backend" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                <Server size={11} /> 后端管线 · FastAPI
              </span>
            )}
            {mode === "local" && (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                本地模拟（后端未启动）
              </span>
            )}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {mode === "backend"
            ? "节点摘要来自后端真实执行（含确定性计算与 RAG 检索）；工作区数据仍为本地演示集，数据同步为下一步集成项。"
            : "后端启动后（backend/README.md），此处自动切换为真实管线输出。"}
        </p>
        {wasLoaded && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-800">
            工作区已有数据：本次重跑<strong>不会覆盖</strong>你的人工编辑（分类修正、时间线、草稿等）。
            接入后端数据同步后，重跑前将提供「合并 / 覆盖」选项。
          </p>
        )}

        {steps == null ? (
          <div className="flex items-center gap-2 py-8 text-xs text-slate-500">
            <Loader2 size={15} className="animate-spin text-blue-600" /> 正在连接后端（http://localhost:8000）…未启动将自动回退本地模拟
          </div>
        ) : (
          <ol className="mt-4 space-y-2.5">
            {steps.map((n, i) => {
              const state = i < current ? "done" : i === current ? "running" : "pending";
              return (
                <li key={n.key} className="flex items-start gap-2.5">
                  {state === "done" ? (
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  ) : state === "running" ? (
                    <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-blue-600" />
                  ) : (
                    <Circle size={16} className="mt-0.5 shrink-0 text-slate-300" />
                  )}
                  <div>
                    <p
                      className={cls(
                        "text-xs font-medium",
                        state === "pending" ? "text-slate-400" : "text-slate-700",
                      )}
                    >
                      {n.label}
                      <span className="ml-1.5 font-mono text-[10px] text-slate-400">{n.key}</span>
                    </p>
                    {state !== "pending" && (
                      <p className="text-[11px] leading-relaxed text-slate-400">{n.desc}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {done && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
            {wasLoaded
              ? "工作流重跑完成：工作区分析结果已是最新。"
              : "工作流完成：已生成事实、时间线、请求项、草稿与复核发现，全部标记为「需律师复核」。"}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className={cls(
              "rounded-lg px-3.5 py-2 text-xs font-medium",
              done
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border border-slate-200 text-slate-500",
            )}
          >
            {done ? "查看结果" : "后台运行（关闭）"}
          </button>
        </div>
      </div>
    </div>
  );
}
