import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { CALC_DISCLAIMER } from "../../config/compliance";
import { LEGAL_SOURCES } from "../../data/legalSources";
import {
  calcEconomicCompensation,
  calcOvertimePay,
  calcUnlawfulTerminationDamages,
  calcUnpaidWages,
  checkLimitationPeriod,
  type CalculationResult,
} from "../../lib/compensation";
import type { CalcParams, Claim, RiskLevel } from "../../lib/types";
import { todayISO } from "../../lib/utils";
import { useCase } from "../../state/CaseContext";
import { ClaimChecklist } from "../claims/ClaimChecklist";
import { CalculationCard, LimitationCard } from "../claims/CalculationCard";
import { EmptyState } from "../common/Badge";
import { LegalSearchPanel } from "../legal/LegalSearchPanel";

export function ClaimsSection() {
  const {
    claims,
    facts,
    calcKinds,
    unpaidItem,
    calcParams,
    setCalcParam,
    addClaim,
    hasData,
    workflowAvailable,
    isLive,
    backendCalcs,
    backendLimitation,
  } = useCase();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClaim, setNewClaim] = useState({ title: "", riskLevel: "medium" as RiskLevel });

  const submitNewClaim = () => {
    if (!newClaim.title.trim()) return;
    const claim: Claim = {
      id: `c_manual_${Date.now()}`,
      claimType: "custom",
      title: newClaim.title.trim(),
      status: "suggested",
      basisFacts: ["人工添加请求项，事实基础待补充"],
      legalBasis: ["【待律师确认法律依据】"],
      requiredEvidence: [],
      missingEvidence: ["待律师梳理所需证据"],
      riskLevel: newClaim.riskLevel,
      note: "人工添加（非系统建议），需补充事实基础、法律依据与证据后再评估。",
    };
    addClaim(claim);
    setNewClaim({ title: "", riskLevel: "medium" });
    setShowAddForm(false);
  };

  const dates = useMemo(() => {
    const get = (key: string) => facts.find((f) => f.fieldKey === key)?.value ?? null;
    const iso = (v: string | null) =>
      v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
    return { startDate: iso(get("start_date")), terminationDate: iso(get("termination_date")) };
  }, [facts]);

  const cards = useMemo<CalculationResult[]>(() => {
    const base = {
      monthlySalary: calcParams.monthlySalary,
      startDate: dates.startDate,
      endDate: dates.terminationDate,
      regionalAvgMonthlyWage: calcParams.regionalAvgMonthlyWage,
    };
    const out: CalculationResult[] = [];
    if (calcKinds.includes("unpaid") && unpaidItem) {
      out.push(
        calcUnpaidWages([
          {
            period: unpaidItem.period,
            amountOwed: calcParams.unpaidAmount,
            sourceNote: unpaidItem.sourceNote,
            needsReview: true,
          },
        ]),
      );
    }
    if (calcKinds.includes("overtime")) {
      out.push(
        calcOvertimePay({
          monthlySalary: calcParams.monthlySalary,
          hours150: calcParams.otHours150,
          hours200: calcParams.otHours200,
          hours300: calcParams.otHours300,
        }),
      );
    }
    if (calcKinds.includes("economic")) out.push(calcEconomicCompensation(base));
    if (calcKinds.includes("unlawful")) out.push(calcUnlawfulTerminationDamages(base));
    return out;
  }, [calcKinds, unpaidItem, calcParams, dates]);

  const limitation = useMemo(
    () =>
      calcKinds.includes("limitation")
        ? checkLimitationPeriod(dates.terminationDate, todayISO())
        : null,
    [calcKinds, dates],
  );

  if (!hasData) {
    return (
      <EmptyState
        title="暂无请求项与计算"
        hint={
          isLive
            ? "上传材料后点击右上角「运行 Agent 工作流」——后端将真实抽取并计算"
            : workflowAvailable
              ? "点击右上角「运行 Agent 工作流」生成建议请求项与金额草稿（演示）"
              : "运行请求项识别后在此查看"
        }
      />
    );
  }

  const numInput = (label: string, key: keyof CalcParams, hint?: string) => (
    <label key={key} className="text-xs text-slate-600">
      {label}
      <input
        type="number"
        value={calcParams[key] ?? ""}
        placeholder="未提供"
        onChange={(e) =>
          setCalcParam(key, e.target.value === "" ? null : Number(e.target.value))
        }
        className="mt-1 block w-36 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
      />
      {hint && <span className="mt-0.5 block w-36 text-[11px] text-slate-400">{hint}</span>}
    </label>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-800">建议请求项（需律师确认）</h2>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700"
          >
            <Plus size={13} /> 添加请求项
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          请求项由系统根据事实与证据建议，点击卡片展开判断依据；是否主张及主备位策略由承办律师决定。
        </p>

        {showAddForm && (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
            <label className="flex-1 text-xs text-slate-600">
              请求项名称
              <input
                value={newClaim.title}
                onChange={(e) => setNewClaim({ ...newClaim, title: e.target.value })}
                placeholder="如：支付未休年休假工资"
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs text-slate-600">
              初步风险
              <select
                value={newClaim.riskLevel}
                onChange={(e) =>
                  setNewClaim({ ...newClaim, riskLevel: e.target.value as RiskLevel })
                }
                className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </label>
            <button
              onClick={submitNewClaim}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              添加（标记为人工添加）
            </button>
          </div>
        )}

        <div className="mt-3">
          <ClaimChecklist claims={claims} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">
          金额计算（确定性服务）
          {isLive && (
            <span className="ml-2 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
              后端计算 · 已持久化
            </span>
          )}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{CALC_DISCLAIMER}</p>

        {isLive ? (
          <>
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              金额由后端根据抽取事实自动计算；如需修正输入（工资口径、欠付金额等），
              请补充/修正材料后点击右上角「重新运行工作流」（参数手动编辑将在后续版本提供）。
            </p>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {backendCalcs.map((c) => (
                <CalculationCard key={c.id} result={c} />
              ))}
              {backendLimitation && <LimitationCard check={backendLimitation} />}
              {backendCalcs.length === 0 && (
                <p className="text-xs text-slate-400">
                  尚无计算结果——上传材料并运行工作流后生成。
                </p>
              )}
            </div>
          </>
        ) : (
        <div className="mt-3 flex flex-wrap gap-4 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          {numInput("月工资基数（元）", "monthlySalary", "来源：劳动合同（口径需复核）")}
          {(calcKinds.includes("economic") || calcKinds.includes("unlawful")) &&
            numInput("当地社平月工资（元）", "regionalAvgMonthlyWage", "人工输入，用于三倍封顶校验")}
          {calcKinds.includes("unpaid") &&
            unpaidItem &&
            numInput(`${unpaidItem.period}欠付金额（元）`, "unpaidAmount", "低置信，待流水核定")}
          {calcKinds.includes("overtime") && (
            <>
              {numInput("平日加班小时（1.5倍）", "otHours150", "须经考勤+审批核定后输入")}
              {numInput("休息日加班小时（2倍）", "otHours200", "未补休部分")}
              {numInput("节假日加班小时（3倍）", "otHours300")}
            </>
          )}
        </div>

        )}

        {!isLive && (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {cards.map((c) => (
              <CalculationCard key={c.id} result={c} />
            ))}
            {limitation && <LimitationCard check={limitation} />}
          </div>
        )}
      </section>

      <LegalSearchPanel />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">
          案件关联法条卡片{" "}
          <span className="font-normal text-slate-400">（样例知识库，正式引用须核对官方文本）</span>
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {LEGAL_SOURCES.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700">
                  {s.title}
                  {s.article && <span className="ml-1 text-blue-700">{s.article}</span>}
                </p>
                <span className="shrink-0 rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {s.sourceType === "law"
                    ? "法律"
                    : s.sourceType === "judicial_interpretation"
                      ? "司法解释"
                      : "类案参考"}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{s.summary}</p>
              <p className="mt-1.5 text-[11px] text-blue-700">关联：{s.relevance}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {s.effectiveDate && <>生效/入库：{s.effectiveDate} · </>}
                {s.citation}
                {s.needsVerification && " · 需核实"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
