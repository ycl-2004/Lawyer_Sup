import { useNavigate } from "react-router-dom";
import type { Matter } from "../../lib/types";
import { RiskBadge, StatusBadge } from "../common/Badge";

export function MatterList({ matters }: { matters: Matter[] }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th className="px-4 py-3 font-medium">案件名称</th>
            <th className="px-4 py-3 font-medium">客户代号</th>
            <th className="px-4 py-3 font-medium">对方公司</th>
            <th className="px-4 py-3 font-medium">地区</th>
            <th className="px-4 py-3 font-medium">当前状态</th>
            <th className="px-4 py-3 font-medium">风险等级</th>
            <th className="px-4 py-3 font-medium">最近更新</th>
          </tr>
        </thead>
        <tbody>
          {matters.map((m) => (
            <tr
              key={m.id}
              onClick={() => navigate(`/matters/${m.id}`)}
              className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-blue-50/40"
            >
              <td className="px-4 py-3">
                <p className="font-medium text-blue-700">
                  {m.title}
                  {m.isLive && (
                    <span className="ml-2 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      实时 · 本地持久化
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {m.caseType} · 负责人 {m.leadLawyer}
                  {m.isLive && m.retentionUntil && ` · 保留至 ${m.retentionUntil}`}
                </p>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-600">
                {m.clientCode}
              </td>
              <td className="px-4 py-3 text-slate-600">{m.opposingParty}</td>
              <td className="px-4 py-3 text-slate-600">{m.jurisdiction}</td>
              <td className="px-4 py-3">
                <StatusBadge status={m.status} />
              </td>
              <td className="px-4 py-3">
                <RiskBadge level={m.riskLevel} />
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{m.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
