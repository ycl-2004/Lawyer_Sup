import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useCase } from "../../state/CaseContext";
import { EmptyState } from "../common/Badge";
import { EvidenceMatrix } from "../evidence/EvidenceMatrix";

export function EvidenceSection() {
  const {
    evidenceMatrix,
    missingMaterials,
    addMissingMaterial,
    removeMissingMaterial,
    hasData,
    workflowAvailable,
  } = useCase();
  const [newItem, setNewItem] = useState("");

  const submitItem = () => {
    if (!newItem.trim()) return;
    addMissingMaterial(newItem.trim());
    setNewItem("");
  };

  if (!hasData) {
    return (
      <EmptyState
        title="暂无证据矩阵"
        hint={
          workflowAvailable
            ? "点击右上角「运行 Agent 工作流」生成证据矩阵与缺失清单（演示）"
            : "完成事实抽取与请求项识别后生成"
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">
          争议焦点 × 证据矩阵{" "}
          <span className="font-normal text-slate-400">（举证思路为建议，需律师确认）</span>
        </h2>
        <div className="mt-3">
          <EvidenceMatrix rows={evidenceMatrix} />
        </div>
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-red-700">
          缺失材料清单（{missingMaterials.length} 项）
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          以下材料在已上传文件中未找到。系统不会假设其内容，相关事实在草稿中以占位符标注。
        </p>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {missingMaterials.map((m, i) => (
            <li
              key={`${i}-${m}`}
              className="group flex items-start gap-2 rounded-lg border border-red-100 bg-red-50/40 px-3 py-2 text-xs text-slate-700"
            >
              <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border border-red-300 bg-white" />
              <span className="flex-1">{m}</span>
              <button
                onClick={() => {
                  if (window.confirm(`确定移除「${m}」？（如材料已补充到位可移除）`)) {
                    removeMissingMaterial(i);
                  }
                }}
                title="移除该项"
                className="rounded p-0.5 text-slate-300 hover:bg-red-100 hover:text-red-600"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitItem()}
            placeholder="添加缺失材料项，如：2025年度绩效考核记录"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
          />
          <button
            onClick={submitItem}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700"
          >
            <Plus size={13} /> 添加
          </button>
        </div>
      </section>
    </div>
  );
}
