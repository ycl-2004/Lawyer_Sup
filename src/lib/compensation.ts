/**
 * 确定性金额计算服务（compensation service）。
 *
 * 设计红线（见计划 §8.7）：
 * - 所有公式写死在代码中，绝不交给 LLM 推测。
 * - 输入缺失时拒绝计算（result = null + missingInputs），不编造数字。
 * - 每个结果附输入、推导步骤、公式、法律依据、警告，供律师复核。
 * - 地区社平工资等时效性参数由人工输入，系统不假装掌握最新标准。
 */

export interface CalculationInput {
  label: string;
  value: string | number | null;
  sourceNote?: string;
  needsReview?: boolean;
}

export interface CalculationResult {
  id: string;
  calculationType: string;
  title: string;
  inputs: CalculationInput[];
  steps: string[];
  formula: string;
  /** null = 因输入缺失拒绝计算 */
  result: number | null;
  legalBasis: string[];
  warnings: string[];
  missingInputs: string[];
}

interface DateParts {
  y: number;
  m: number;
  d: number;
}

function parseISO(iso: string): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** 完整月数（按日对齐），如 2024-07-01 → 2026-03-15 = 20 个整月 + 14 天 */
export function fullMonthsBetween(startISO: string, endISO: string): {
  months: number;
  extraDays: boolean;
} {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  if (!s || !e) return { months: 0, extraDays: false };
  let months = (e.y - s.y) * 12 + (e.m - s.m);
  let extraDays = false;
  if (e.d < s.d) {
    months -= 1;
    extraDays = true;
  } else if (e.d > s.d) {
    extraDays = true;
  }
  return { months: Math.max(0, months), extraDays };
}

export interface TenureResult {
  fullYears: number;
  remainderMonths: number;
  hasExtraDays: boolean;
  /** 《劳动合同法》第四十七条推导的经济补偿月数 */
  compensatedMonths: number;
  derivation: string;
}

/**
 * 第四十七条：每满一年支付一个月工资；六个月以上不满一年的，按一年计算；
 * 不满六个月的，支付半个月工资。
 */
export function deriveTenure(startISO: string, endISO: string): TenureResult {
  const { months, extraDays } = fullMonthsBetween(startISO, endISO);
  const fullYears = Math.floor(months / 12);
  const remainderMonths = months % 12;
  let extra = 0;
  let remainderRule: string;
  if (remainderMonths >= 6) {
    extra = 1;
    remainderRule = `剩余${remainderMonths}个月≥6个月，按一年计，加1个月`;
  } else if (remainderMonths > 0 || extraDays) {
    extra = 0.5;
    remainderRule = `剩余不满6个月，加0.5个月`;
  } else {
    remainderRule = "无剩余月份";
  }
  const compensatedMonths = fullYears + extra;
  return {
    fullYears,
    remainderMonths,
    hasExtraDays: extraDays,
    compensatedMonths,
    derivation:
      `工作年限约${fullYears}年${remainderMonths}个月` +
      (extraDays ? "余" : "") +
      `；每满一年计1个月（${fullYears}个月），${remainderRule}，` +
      `合计${compensatedMonths}个月（劳动合同法第四十七条）`,
  };
}

export interface EconomicCompensationParams {
  monthlySalary: number | null;
  startDate: string | null;
  endDate: string | null;
  /** 当地上年度职工月平均工资（人工输入；用于三倍封顶校验） */
  regionalAvgMonthlyWage?: number | null;
}

export function calcEconomicCompensation(
  p: EconomicCompensationParams,
): CalculationResult {
  const missing: string[] = [];
  if (p.monthlySalary == null || p.monthlySalary <= 0) missing.push("月工资");
  if (!p.startDate) missing.push("入职日期");
  if (!p.endDate) missing.push("离职/解除日期");
  // 日期冲突：解除/离职日期早于入职日期 → 无效区间，拒绝计算（ISO 字符串可直接比较）
  const dateConflict = Boolean(
    p.startDate && p.endDate && parseISO(p.startDate) && parseISO(p.endDate) &&
      p.endDate < p.startDate,
  );

  const base: CalculationResult = {
    id: "calc_economic_compensation",
    calculationType: "economic_compensation",
    title: "经济补偿金（草稿）",
    inputs: [
      { label: "月工资（解除前12个月平均，待律师核实口径）", value: p.monthlySalary, needsReview: true },
      { label: "入职日期", value: p.startDate },
      { label: "解除/离职日期", value: p.endDate },
      {
        label: "当地社平月工资（人工输入）",
        value: p.regionalAvgMonthlyWage ?? null,
        sourceNote: "时效性参数，系统不自动获取",
      },
    ],
    steps: [],
    formula: "经济补偿 = 月工资基数 × 补偿月数",
    result: null,
    legalBasis: ["《劳动合同法》第四十七条"],
    warnings: [],
    missingInputs: missing,
  };

  if (dateConflict) {
    base.missingInputs.push("有效的入职—解除日期区间");
    base.warnings.push("解除/离职日期早于入职日期（日期冲突），拒绝计算，请律师核对日期。");
    return base;
  }
  if (missing.length > 0) {
    base.warnings.push(`缺少必要输入（${missing.join("、")}），拒绝计算，不做推测。`);
    return base;
  }

  const tenure = deriveTenure(p.startDate!, p.endDate!);
  let months = tenure.compensatedMonths;
  let salaryBase = p.monthlySalary!;
  base.steps.push(tenure.derivation);

  if (p.regionalAvgMonthlyWage != null && p.regionalAvgMonthlyWage > 0) {
    const cap = p.regionalAvgMonthlyWage * 3;
    if (salaryBase > cap) {
      salaryBase = cap;
      months = Math.min(months, 12);
      base.steps.push(
        `月工资高于当地社平工资三倍（${cap}元），基数按三倍封顶，补偿年限最高12年（第四十七条第二款）`,
      );
      base.warnings.push("已按三倍封顶计算，社平工资数值需律师核对当地最新标准。");
    } else {
      base.steps.push(`月工资未超过当地社平工资三倍（${cap}元），不适用封顶`);
    }
  } else {
    base.warnings.push(
      "未提供当地社平工资，无法校验三倍封顶规则，需律师结合地区标准核实。",
    );
  }

  base.steps.push(`计算：${salaryBase} × ${months} = ${salaryBase * months}`);
  base.result = salaryBase * months;
  base.warnings.push("月工资口径（应发/实发、是否含奖金）与工作年限需律师复核。");
  return base;
}

export function calcUnlawfulTerminationDamages(
  p: EconomicCompensationParams,
): CalculationResult {
  const inner = calcEconomicCompensation(p);
  const result: CalculationResult = {
    ...inner,
    id: "calc_unlawful_termination",
    calculationType: "unlawful_termination_damages",
    title: "违法解除赔偿金（草稿）",
    formula: "赔偿金 = 经济补偿标准 × 2",
    legalBasis: ["《劳动合同法》第八十七条", "《劳动合同法》第四十八条", "《劳动合同法》第四十七条"],
    steps: [...inner.steps],
    warnings: [...inner.warnings],
    result: inner.result == null ? null : inner.result * 2,
  };
  if (inner.result != null) {
    result.steps.push(`赔偿金 = ${inner.result} × 2 = ${inner.result * 2}`);
    result.warnings.push(
      "违法解除赔偿金与经济补偿金不可同时主张（二者择一），主张策略由律师决定；解除是否违法需律师判断。",
    );
  }
  return result;
}

export interface UnpaidWageItem {
  period: string;
  amountOwed: number | null;
  sourceNote?: string;
  needsReview?: boolean;
}

export function calcUnpaidWages(items: UnpaidWageItem[]): CalculationResult {
  const missing = items
    .filter((i) => i.amountOwed == null)
    .map((i) => `${i.period}欠付金额`);
  const base: CalculationResult = {
    id: "calc_unpaid_wages",
    calculationType: "unpaid_wages",
    title: "拖欠工资（草稿）",
    inputs: items.map((i) => ({
      label: `${i.period} 欠付金额`,
      value: i.amountOwed,
      sourceNote: i.sourceNote,
      needsReview: i.needsReview,
    })),
    steps: [],
    formula: "拖欠工资 = Σ 各期欠付金额",
    result: null,
    legalBasis: ["《劳动合同法》第三十条", "《劳动争议调解仲裁法》"],
    warnings: [],
    missingInputs: missing,
  };
  if (items.length === 0) {
    base.missingInputs.push("欠付期间与金额");
    base.warnings.push("无欠付记录输入，拒绝计算。");
    return base;
  }
  if (missing.length > 0) {
    base.warnings.push(`部分期间金额缺失（${missing.join("、")}），拒绝合计，不做推测。`);
    return base;
  }
  const negative = items
    .filter((i) => typeof i.amountOwed === "number" && i.amountOwed < 0)
    .map((i) => i.period);
  if (negative.length > 0) {
    base.missingInputs.push("有效（非负）的欠付金额");
    base.warnings.push(`存在为负的欠付金额（${negative.join("、")}），拒绝计算，请核对。`);
    return base;
  }
  const total = items.reduce((s, i) => s + (i.amountOwed ?? 0), 0);
  base.steps.push(
    `合计：${items.map((i) => `${i.period} ${i.amountOwed}元`).join(" + ")} = ${total}元`,
  );
  base.result = total;
  if (items.some((i) => i.needsReview)) {
    base.warnings.push("欠付金额来源置信度低（如仅聊天记录佐证），需银行流水核对。");
  }
  return base;
}

export interface DoubleWageParams {
  monthlySalary: number | null;
  employmentStart: string | null;
  /** null = 至今/至离职未签 */
  contractSignedDate: string | null;
  employmentEnd: string | null;
}

/**
 * 未签书面劳动合同二倍工资差额（简化版）：
 * 自用工之日起满一个月的次日至签订之日（或满一年前一日/离职日），最长11个月。
 * 《劳动合同法》第八十二条。
 */
export function calcDoubleWageDifference(p: DoubleWageParams): CalculationResult {
  const missing: string[] = [];
  if (p.monthlySalary == null || p.monthlySalary <= 0) missing.push("月工资");
  if (!p.employmentStart) missing.push("用工开始日期");

  const base: CalculationResult = {
    id: "calc_double_wage",
    calculationType: "double_wage_difference",
    title: "未签劳动合同二倍工资差额（草稿）",
    inputs: [
      { label: "月工资", value: p.monthlySalary },
      { label: "用工开始日期", value: p.employmentStart },
      { label: "合同签订日期", value: p.contractSignedDate ?? "未签订" },
      { label: "用工结束日期", value: p.employmentEnd },
    ],
    steps: [],
    formula: "差额 = 月工资 × 未签合同月数（自满1个月次日起，最长11个月）",
    result: null,
    legalBasis: ["《劳动合同法》第八十二条", "《劳动合同法实施条例》第六、七条"],
    warnings: [],
    missingInputs: missing,
  };
  if (missing.length > 0) {
    base.warnings.push(`缺少必要输入（${missing.join("、")}），拒绝计算。`);
    return base;
  }

  // 责任期起点：用工满1个月的次日（简化为 start + 1 个月）
  const liabilityEnd = p.contractSignedDate ?? p.employmentEnd;
  if (!liabilityEnd) {
    base.missingInputs.push("合同签订日期或用工结束日期");
    base.warnings.push("无法确定责任期终点，拒绝计算。");
    return base;
  }

  const { months: monthsFromStart } = fullMonthsBetween(p.employmentStart!, liabilityEnd);
  const unsignedMonths = Math.min(11, Math.max(0, monthsFromStart - 1));

  if (unsignedMonths === 0) {
    base.steps.push("用工之日起一个月内已签订书面劳动合同（或期间不足），不产生二倍工资差额");
    base.result = 0;
    return base;
  }
  const total = p.monthlySalary! * unsignedMonths;
  base.steps.push(
    `未签合同责任期约${unsignedMonths}个月（简化按整月计，最长11个月，具体起止日需律师核对）`,
    `计算：${p.monthlySalary} × ${unsignedMonths} = ${total}`,
  );
  base.result = total;
  base.warnings.push("责任期起止日按简化规则估算，需律师按实际日期精确核算；时效问题需另行评估。");
  return base;
}

export interface OvertimeParams {
  monthlySalary: number | null;
  /** 平日延时加班小时数（1.5倍） */
  hours150: number | null;
  /** 休息日加班且未补休小时数（2倍） */
  hours200: number | null;
  /** 法定节假日加班小时数（3倍） */
  hours300: number | null;
}

/**
 * 简化版加班费计算（《劳动法》第四十四条）。
 * 小时工资基数 = 月工资 ÷ 21.75 ÷ 8（人社部月计薪天数口径）。
 * 加班小时数必须由考勤与审批记录核定后人工输入；缺失即拒绝计算。
 */
export function calcOvertimePay(p: OvertimeParams): CalculationResult {
  const missing: string[] = [];
  if (p.monthlySalary == null || p.monthlySalary <= 0) missing.push("月工资");
  const hoursMissing =
    p.hours150 == null && p.hours200 == null && p.hours300 == null;
  if (hoursMissing) missing.push("经核定的加班小时数");
  const negativeHours = (
    [
      ["平日延时", p.hours150],
      ["休息日", p.hours200],
      ["法定节假日", p.hours300],
    ] as [string, number | null][]
  )
    .filter(([, h]) => typeof h === "number" && h < 0)
    .map(([name]) => name);

  const base: CalculationResult = {
    id: "calc_overtime",
    calculationType: "overtime_pay",
    title: "加班费（简化试算，草稿）",
    inputs: [
      { label: "月工资", value: p.monthlySalary },
      { label: "平日延时加班小时（1.5倍）", value: p.hours150, needsReview: true },
      { label: "休息日加班小时（2倍，未补休）", value: p.hours200, needsReview: true },
      { label: "法定节假日加班小时（3倍）", value: p.hours300, needsReview: true },
    ],
    steps: [],
    formula: "加班费 = (月工资÷21.75÷8) × (1.5×平日时数 + 2×休息日时数 + 3×节假日时数)",
    result: null,
    legalBasis: ["《劳动法》第四十四条", "原劳动部《关于职工全年月平均工作时间和工资折算问题的通知》"],
    warnings: [],
    missingInputs: missing,
  };

  if (missing.length > 0) {
    base.warnings.push(
      `缺少必要输入（${missing.join("、")}），拒绝计算。加班小时数须以考勤与加班审批记录核定，系统不从打卡记录推测。`,
    );
    return base;
  }
  if (negativeHours.length > 0) {
    base.missingInputs.push("有效（非负）的加班小时数");
    base.warnings.push(`加班小时数不能为负（${negativeHours.join("、")}），拒绝计算，请核对考勤。`);
    return base;
  }

  const hourly = p.monthlySalary! / 21.75 / 8;
  const h150 = p.hours150 ?? 0;
  const h200 = p.hours200 ?? 0;
  const h300 = p.hours300 ?? 0;
  const total = hourly * (1.5 * h150 + 2 * h200 + 3 * h300);
  const rounded = Math.round(total * 100) / 100;

  base.steps.push(
    `小时工资基数 = ${p.monthlySalary} ÷ 21.75 ÷ 8 = ${(Math.round(hourly * 100) / 100).toFixed(2)}元/小时`,
    `加班费 = 基数 × (1.5×${h150} + 2×${h200} + 3×${h300}) = ${rounded}元`,
  );
  base.result = rounded;
  base.warnings.push(
    "加班事实与小时数需考勤、审批记录及工资条核定；是否实行综合工时/不定时工时制需律师确认。",
  );
  return base;
}

export interface LimitationCheckResult {
  deadline: string | null;
  status: "ok" | "approaching" | "expired" | "unknown";
  message: string;
  severity: "low" | "medium" | "high";
}

/**
 * 仲裁时效检查：劳动争议申请仲裁的时效期间为一年（《调解仲裁法》第二十七条）。
 * 简化：自解除/终止之日起算；中止中断情形需律师判断。
 */
export function checkLimitationPeriod(
  terminationISO: string | null,
  todayISO: string,
): LimitationCheckResult {
  if (!terminationISO) {
    return {
      deadline: null,
      status: "unknown",
      severity: "medium",
      message: "缺少解除/终止日期，无法计算仲裁时效，需律师确认。",
    };
  }
  const t = parseISO(terminationISO);
  if (!t) {
    return { deadline: null, status: "unknown", severity: "medium", message: "日期格式无效。" };
  }
  const deadline = `${t.y + 1}-${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`;
  const { months: monthsLeftRaw } = fullMonthsBetween(todayISO, deadline);
  const expired = todayISO >= deadline;
  if (expired) {
    return {
      deadline,
      status: "expired",
      severity: "high",
      message: `仲裁时效可能已于 ${deadline} 届满（一年时效，调解仲裁法第二十七条）。是否存在中止/中断事由需律师紧急评估。`,
    };
  }
  if (monthsLeftRaw < 2) {
    return {
      deadline,
      status: "approaching",
      severity: "high",
      message: `仲裁时效临近：截止日约为 ${deadline}（剩余不足2个月），建议尽快申请。`,
    };
  }
  return {
    deadline,
    status: "ok",
    severity: "low",
    message: `按解除日起算，一年仲裁时效截止日约为 ${deadline}（中止/中断情形需律师判断）。`,
  };
}
