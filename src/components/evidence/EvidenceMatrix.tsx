import type { EvidenceRow } from "../../lib/types";
import { RiskBadge } from "../common/Badge";

export function EvidenceMatrix({ rows }: { rows: EvidenceRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <th className="px-3 py-2.5 font-medium">争议焦点</th>
            <th className="px-3 py-2.5 font-medium">申请人主张</th>
            <th className="px-3 py-2.5 font-medium">需证明的事实</th>
            <th className="px-3 py-2.5 font-medium">已有证据</th>
            <th className="px-3 py-2.5 font-medium">缺失证据</th>
            <th className="px-3 py-2.5 font-medium">风险</th>
            <th className="px-3 py-2.5 font-medium">律师备注</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 align-top last:border-0">
              <td className="px-3 py-3 font-medium text-slate-800">{r.issue}</td>
              <td className="px-3 py-3 text-slate-600">{r.claimantPosition}</td>
              <td className="px-3 py-3">
                <ul className="list-inside list-disc space-y-0.5 text-slate-600">
                  {r.factsToProve.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </td>
              <td className="px-3 py-3">
                {r.existingEvidence.length > 0 ? (
                  <ul className="space-y-0.5 text-emerald-700">
                    {r.existingEvidence.map((e, i) => (
                      <li key={i}>✓ {e}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="italic text-slate-400">暂无</span>
                )}
              </td>
              <td className="px-3 py-3">
                <ul className="space-y-0.5 text-red-600">
                  {r.missingEvidence.map((e, i) => (
                    <li key={i}>○ {e}</li>
                  ))}
                </ul>
              </td>
              <td className="px-3 py-3">
                <RiskBadge level={r.riskLevel} />
              </td>
              <td className="px-3 py-3 leading-relaxed text-slate-500">{r.lawyerNote}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
