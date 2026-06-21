import { describe, expect, it } from "vitest";
import {
  calcDoubleWageDifference,
  calcEconomicCompensation,
  calcOvertimePay,
  calcUnlawfulTerminationDamages,
  calcUnpaidWages,
  checkLimitationPeriod,
  deriveTenure,
  fullMonthsBetween,
} from "./compensation";

describe("fullMonthsBetween", () => {
  it("counts full months with extra days", () => {
    expect(fullMonthsBetween("2024-07-01", "2026-03-15")).toEqual({
      months: 20,
      extraDays: true,
    });
    expect(fullMonthsBetween("2024-07-01", "2025-07-01")).toEqual({
      months: 12,
      extraDays: false,
    });
    expect(fullMonthsBetween("2024-07-15", "2024-08-01")).toEqual({
      months: 0,
      extraDays: true,
    });
  });
});

describe("deriveTenure (劳动合同法第四十七条)", () => {
  it("demo case: 1年8个月余 → 2个月补偿", () => {
    const t = deriveTenure("2024-07-01", "2026-03-15");
    expect(t.fullYears).toBe(1);
    expect(t.remainderMonths).toBe(8);
    expect(t.compensatedMonths).toBe(2);
  });
  it("不满六个月 → 0.5个月", () => {
    expect(deriveTenure("2024-01-01", "2024-06-01").compensatedMonths).toBe(0.5);
  });
  it("恰好六个月 → 按一年计 1个月", () => {
    expect(deriveTenure("2024-01-01", "2024-07-01").compensatedMonths).toBe(1);
  });
  it("整年无剩余 → 不加成", () => {
    expect(deriveTenure("2022-03-01", "2025-03-01").compensatedMonths).toBe(3);
  });
});

describe("calcEconomicCompensation", () => {
  const demo = {
    monthlySalary: 12000,
    startDate: "2024-07-01",
    endDate: "2026-03-15",
  };
  it("demo case: 12000 × 2 = 24000", () => {
    const r = calcEconomicCompensation(demo);
    expect(r.result).toBe(24000);
    expect(r.missingInputs).toHaveLength(0);
    expect(r.legalBasis).toContain("《劳动合同法》第四十七条");
  });
  it("缺少月工资时拒绝计算，不推测", () => {
    const r = calcEconomicCompensation({ ...demo, monthlySalary: null });
    expect(r.result).toBeNull();
    expect(r.missingInputs).toContain("月工资");
  });
  it("高于社平三倍时封顶且年限≤12年", () => {
    const r = calcEconomicCompensation({
      monthlySalary: 60000,
      startDate: "2010-01-01",
      endDate: "2025-01-01", // 15 年
      regionalAvgMonthlyWage: 12000, // 3x = 36000
    });
    expect(r.result).toBe(36000 * 12);
  });
  it("未提供社平工资时给出核实警告", () => {
    const r = calcEconomicCompensation(demo);
    expect(r.warnings.some((w) => w.includes("社平工资"))).toBe(true);
  });
});

describe("calcUnlawfulTerminationDamages", () => {
  it("= 经济补偿 × 2，并提示二者择一", () => {
    const r = calcUnlawfulTerminationDamages({
      monthlySalary: 12000,
      startDate: "2024-07-01",
      endDate: "2026-03-15",
    });
    expect(r.result).toBe(48000);
    expect(r.warnings.some((w) => w.includes("二者择一"))).toBe(true);
  });
  it("输入缺失时同样拒绝", () => {
    const r = calcUnlawfulTerminationDamages({
      monthlySalary: null,
      startDate: null,
      endDate: null,
    });
    expect(r.result).toBeNull();
  });
});

describe("calcUnpaidWages", () => {
  it("合计各期欠付", () => {
    const r = calcUnpaidWages([
      { period: "2026年2月", amountOwed: 6000, needsReview: true },
    ]);
    expect(r.result).toBe(6000);
    expect(r.warnings.some((w) => w.includes("置信度低"))).toBe(true);
  });
  it("金额缺失时拒绝合计", () => {
    const r = calcUnpaidWages([{ period: "2026年2月", amountOwed: null }]);
    expect(r.result).toBeNull();
    expect(r.missingInputs.length).toBeGreaterThan(0);
  });
});

describe("calcDoubleWageDifference (第八十二条)", () => {
  it("未签合同4个整月 → 3个月差额", () => {
    const r = calcDoubleWageDifference({
      monthlySalary: 10000,
      employmentStart: "2024-01-01",
      contractSignedDate: null,
      employmentEnd: "2024-05-01",
    });
    expect(r.result).toBe(30000);
  });
  it("一个月内签订 → 0", () => {
    const r = calcDoubleWageDifference({
      monthlySalary: 10000,
      employmentStart: "2024-01-01",
      contractSignedDate: "2024-01-20",
      employmentEnd: null,
    });
    expect(r.result).toBe(0);
  });
  it("最长封顶11个月", () => {
    const r = calcDoubleWageDifference({
      monthlySalary: 10000,
      employmentStart: "2020-01-01",
      contractSignedDate: null,
      employmentEnd: "2023-01-01",
    });
    expect(r.result).toBe(110000);
  });
});

describe("calcOvertimePay (劳动法第四十四条, 简化)", () => {
  it("按 21.75 基数与倍率计算", () => {
    const r = calcOvertimePay({
      monthlySalary: 8700, // 8700/21.75/8 = 50 元/小时
      hours150: 10,
      hours200: 8,
      hours300: 0,
    });
    expect(r.result).toBe(50 * (1.5 * 10 + 2 * 8)); // 1550
  });
  it("缺少加班小时数时拒绝计算", () => {
    const r = calcOvertimePay({
      monthlySalary: 9000,
      hours150: null,
      hours200: null,
      hours300: null,
    });
    expect(r.result).toBeNull();
    expect(r.missingInputs).toContain("经核定的加班小时数");
  });
});

describe("checkLimitationPeriod (调解仲裁法第二十七条)", () => {
  it("时效内", () => {
    const r = checkLimitationPeriod("2026-03-15", "2026-06-11");
    expect(r.status).toBe("ok");
    expect(r.deadline).toBe("2027-03-15");
  });
  it("临近时效 → high", () => {
    const r = checkLimitationPeriod("2026-03-15", "2027-02-20");
    expect(r.status).toBe("approaching");
    expect(r.severity).toBe("high");
  });
  it("已过时效 → high warning", () => {
    const r = checkLimitationPeriod("2024-01-01", "2026-06-11");
    expect(r.status).toBe("expired");
    expect(r.severity).toBe("high");
  });
  it("缺少日期 → unknown，不推测", () => {
    expect(checkLimitationPeriod(null, "2026-06-11").status).toBe("unknown");
  });
});

// 边界用例：与后端 tests/test_compensation_edge.py 对齐，验证"拒绝计算"红线
describe("边界用例（日期冲突/零负金额/负小时）", () => {
  it("解除日期早于入职 → 日期冲突，拒绝计算", () => {
    const r = calcEconomicCompensation({
      monthlySalary: 12000,
      startDate: "2026-03-15",
      endDate: "2024-07-01",
    });
    expect(r.result).toBeNull();
    expect(r.warnings.some((w) => w.includes("日期冲突"))).toBe(true);
  });
  it("违法解除赔偿金同样传导日期冲突", () => {
    const r = calcUnlawfulTerminationDamages({
      monthlySalary: 12000,
      startDate: "2026-03-15",
      endDate: "2024-07-01",
    });
    expect(r.result).toBeNull();
  });
  it("月工资为 0 → 拒绝", () => {
    const r = calcEconomicCompensation({
      monthlySalary: 0,
      startDate: "2024-07-01",
      endDate: "2026-03-15",
    });
    expect(r.result).toBeNull();
    expect(r.missingInputs).toContain("月工资");
  });
  it("月工资为负 → 拒绝", () => {
    const r = calcEconomicCompensation({
      monthlySalary: -5000,
      startDate: "2024-07-01",
      endDate: "2026-03-15",
    });
    expect(r.result).toBeNull();
  });
  it("入职与解除同日 → 补偿 0（不崩溃、不拒绝）", () => {
    const r = calcEconomicCompensation({
      monthlySalary: 12000,
      startDate: "2026-03-15",
      endDate: "2026-03-15",
    });
    expect(r.result).toBe(0);
  });
  it("欠付金额为负 → 拒绝合计", () => {
    const r = calcUnpaidWages([{ period: "2026年2月", amountOwed: -6000 }]);
    expect(r.result).toBeNull();
    expect(r.warnings.some((w) => w.includes("为负"))).toBe(true);
  });
  it("加班小时为负 → 拒绝计算", () => {
    const r = calcOvertimePay({
      monthlySalary: 8700,
      hours150: -10,
      hours200: null,
      hours300: null,
    });
    expect(r.result).toBeNull();
    expect(r.warnings.some((w) => w.includes("不能为负"))).toBe(true);
  });
  it("加班小时明确为 0 → 结果 0（非缺失）", () => {
    const r = calcOvertimePay({
      monthlySalary: 8700,
      hours150: 0,
      hours200: 0,
      hours300: 0,
    });
    expect(r.result).toBe(0);
  });
});
