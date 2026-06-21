"""确定性金额计算服务（Python 版，与前端 src/lib/compensation.ts 同一套规则）。

设计红线：
- 公式写死在代码中，绝不交给 LLM 推测。
- 输入缺失时拒绝计算（result=None + missing_inputs），不编造数字。
- 每个结果附输入、推导步骤、公式、法律依据、警告，供律师复核。

仅依赖标准库，便于独立测试与复用。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

ISO_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


@dataclass
class CalculationResult:
    id: str
    calculation_type: str
    title: str
    inputs: list[dict[str, Any]] = field(default_factory=list)
    steps: list[str] = field(default_factory=list)
    formula: str = ""
    result: float | None = None
    legal_basis: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    missing_inputs: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()


def _parse(iso: str | None) -> tuple[int, int, int] | None:
    if not iso:
        return None
    m = ISO_RE.match(iso)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def full_months_between(start_iso: str, end_iso: str) -> tuple[int, bool]:
    """完整月数（按日对齐）与是否有零头天数。"""
    s, e = _parse(start_iso), _parse(end_iso)
    if not s or not e:
        return 0, False
    months = (e[0] - s[0]) * 12 + (e[1] - s[1])
    extra = False
    if e[2] < s[2]:
        months -= 1
        extra = True
    elif e[2] > s[2]:
        extra = True
    return max(0, months), extra


@dataclass
class TenureResult:
    full_years: int
    remainder_months: int
    has_extra_days: bool
    compensated_months: float
    derivation: str


def derive_tenure(start_iso: str, end_iso: str) -> TenureResult:
    """《劳动合同法》第四十七条：每满一年1个月；≥6个月按一年计；<6个月0.5个月。"""
    months, extra_days = full_months_between(start_iso, end_iso)
    full_years, rem = divmod(months, 12)
    if rem >= 6:
        extra, rule = 1.0, f"剩余{rem}个月≥6个月，按一年计，加1个月"
    elif rem > 0 or extra_days:
        extra, rule = 0.5, "剩余不满6个月，加0.5个月"
    else:
        extra, rule = 0.0, "无剩余月份"
    comp = full_years + extra
    return TenureResult(
        full_years=full_years,
        remainder_months=rem,
        has_extra_days=extra_days,
        compensated_months=comp,
        derivation=(
            f"工作年限约{full_years}年{rem}个月{'余' if extra_days else ''}；"
            f"每满一年计1个月（{full_years}个月），{rule}，"
            f"合计{comp}个月（劳动合同法第四十七条）"
        ),
    )


def calc_economic_compensation(
    monthly_salary: float | None,
    start_date: str | None,
    end_date: str | None,
    regional_avg_monthly_wage: float | None = None,
) -> CalculationResult:
    missing: list[str] = []
    if not monthly_salary or monthly_salary <= 0:
        missing.append("月工资")
    if not start_date:
        missing.append("入职日期")
    if not end_date:
        missing.append("离职/解除日期")
    # 日期冲突：解除/离职日期早于入职日期 → 无效区间，拒绝计算（ISO 字符串可直接比较）
    date_conflict = bool(
        start_date and end_date and _parse(start_date) and _parse(end_date)
        and end_date < start_date
    )

    r = CalculationResult(
        id="calc_economic_compensation",
        calculation_type="economic_compensation",
        title="经济补偿金（草稿）",
        inputs=[
            {"label": "月工资（解除前12个月平均，口径需律师核实）", "value": monthly_salary, "needs_review": True},
            {"label": "入职日期", "value": start_date},
            {"label": "解除/离职日期", "value": end_date},
            {"label": "当地社平月工资（人工输入）", "value": regional_avg_monthly_wage,
             "source_note": "时效性参数，系统不自动获取"},
        ],
        formula="经济补偿 = 月工资基数 × 补偿月数",
        legal_basis=["《劳动合同法》第四十七条"],
        missing_inputs=missing,
    )
    if date_conflict:
        r.missing_inputs.append("有效的入职—解除日期区间")
        r.warnings.append("解除/离职日期早于入职日期（日期冲突），拒绝计算，请律师核对日期。")
        return r
    if missing:
        r.warnings.append(f"缺少必要输入（{'、'.join(missing)}），拒绝计算，不做推测。")
        return r

    tenure = derive_tenure(start_date, end_date)  # type: ignore[arg-type]
    months = tenure.compensated_months
    base = float(monthly_salary)  # type: ignore[arg-type]
    r.steps.append(tenure.derivation)

    if regional_avg_monthly_wage and regional_avg_monthly_wage > 0:
        cap = regional_avg_monthly_wage * 3
        if base > cap:
            base = cap
            months = min(months, 12)
            r.steps.append(f"月工资高于当地社平工资三倍（{cap}元），基数封顶，年限最高12年（第四十七条第二款）")
            r.warnings.append("已按三倍封顶计算，社平工资数值需律师核对当地最新标准。")
        else:
            r.steps.append(f"月工资未超过当地社平工资三倍（{cap}元），不适用封顶")
    else:
        r.warnings.append("未提供当地社平工资，无法校验三倍封顶规则，需律师结合地区标准核实。")

    r.result = base * months
    r.steps.append(f"计算：{base} × {months} = {r.result}")
    r.warnings.append("月工资口径（应发/实发、是否含奖金）与工作年限需律师复核。")
    return r


def calc_unlawful_termination_damages(
    monthly_salary: float | None,
    start_date: str | None,
    end_date: str | None,
    regional_avg_monthly_wage: float | None = None,
) -> CalculationResult:
    inner = calc_economic_compensation(monthly_salary, start_date, end_date, regional_avg_monthly_wage)
    r = CalculationResult(
        id="calc_unlawful_termination",
        calculation_type="unlawful_termination_damages",
        title="违法解除赔偿金（草稿）",
        inputs=inner.inputs,
        steps=list(inner.steps),
        formula="赔偿金 = 经济补偿标准 × 2",
        legal_basis=["《劳动合同法》第八十七条", "《劳动合同法》第四十八条", "《劳动合同法》第四十七条"],
        warnings=list(inner.warnings),
        missing_inputs=inner.missing_inputs,
    )
    if inner.result is not None:
        r.result = inner.result * 2
        r.steps.append(f"赔偿金 = {inner.result} × 2 = {r.result}")
        r.warnings.append("违法解除赔偿金与经济补偿金不可同时主张（二者择一），策略由律师决定；解除是否违法需律师判断。")
    return r


def calc_unpaid_wages(items: list[dict[str, Any]]) -> CalculationResult:
    """items: [{period, amount_owed, source_note?, needs_review?}]"""
    missing = [f"{i.get('period')}欠付金额" for i in items if i.get("amount_owed") is None]
    r = CalculationResult(
        id="calc_unpaid_wages",
        calculation_type="unpaid_wages",
        title="拖欠工资（草稿）",
        inputs=[
            {"label": f"{i.get('period')} 欠付金额", "value": i.get("amount_owed"),
             "source_note": i.get("source_note"), "needs_review": i.get("needs_review", False)}
            for i in items
        ],
        formula="拖欠工资 = Σ 各期欠付金额",
        legal_basis=["《劳动合同法》第三十条"],
        missing_inputs=missing,
    )
    if not items:
        r.missing_inputs.append("欠付期间与金额")
        r.warnings.append("无欠付记录输入，拒绝计算。")
        return r
    if missing:
        r.warnings.append(f"部分期间金额缺失（{'、'.join(missing)}），拒绝合计，不做推测。")
        return r
    negative = [str(i.get("period")) for i in items
                if isinstance(i.get("amount_owed"), (int, float)) and i["amount_owed"] < 0]
    if negative:
        r.missing_inputs.append("有效（非负）的欠付金额")
        r.warnings.append(f"存在为负的欠付金额（{'、'.join(negative)}），拒绝计算，请核对。")
        return r
    r.result = float(sum(i["amount_owed"] for i in items))
    r.steps.append(" + ".join(f"{i['period']} {i['amount_owed']}元" for i in items) + f" = {r.result}元")
    if any(i.get("needs_review") for i in items):
        r.warnings.append("欠付金额来源置信度低（如仅聊天记录佐证），需银行流水核对。")
    return r


def calc_overtime_pay(
    monthly_salary: float | None,
    hours_150: float | None,
    hours_200: float | None,
    hours_300: float | None,
) -> CalculationResult:
    """简化版加班费（《劳动法》第四十四条）。基数 = 月工资÷21.75÷8。"""
    missing: list[str] = []
    if not monthly_salary or monthly_salary <= 0:
        missing.append("月工资")
    if hours_150 is None and hours_200 is None and hours_300 is None:
        missing.append("经核定的加班小时数")
    negative_hours = [
        name for name, h in
        [("平日延时", hours_150), ("休息日", hours_200), ("法定节假日", hours_300)]
        if isinstance(h, (int, float)) and h < 0
    ]

    r = CalculationResult(
        id="calc_overtime",
        calculation_type="overtime_pay",
        title="加班费（简化试算，草稿）",
        inputs=[
            {"label": "月工资", "value": monthly_salary},
            {"label": "平日延时加班小时（1.5倍）", "value": hours_150, "needs_review": True},
            {"label": "休息日加班小时（2倍，未补休）", "value": hours_200, "needs_review": True},
            {"label": "法定节假日加班小时（3倍）", "value": hours_300, "needs_review": True},
        ],
        formula="加班费 = (月工资÷21.75÷8) × (1.5×平日 + 2×休息日 + 3×节假日)",
        legal_basis=["《劳动法》第四十四条"],
        missing_inputs=missing,
    )
    if missing:
        r.warnings.append(
            f"缺少必要输入（{'、'.join(missing)}），拒绝计算。加班小时数须以考勤与加班审批记录核定，系统不从打卡记录推测。"
        )
        return r
    if negative_hours:
        r.missing_inputs.append("有效（非负）的加班小时数")
        r.warnings.append(f"加班小时数不能为负（{'、'.join(negative_hours)}），拒绝计算，请核对考勤。")
        return r
    hourly = monthly_salary / 21.75 / 8  # type: ignore[operator]
    h1, h2, h3 = hours_150 or 0, hours_200 or 0, hours_300 or 0
    r.result = round(hourly * (1.5 * h1 + 2 * h2 + 3 * h3), 2)
    r.steps.append(f"小时工资基数 = {monthly_salary} ÷ 21.75 ÷ 8 = {round(hourly, 2)}元/小时")
    r.steps.append(f"加班费 = 基数 × (1.5×{h1} + 2×{h2} + 3×{h3}) = {r.result}元")
    r.warnings.append("加班事实与小时数需考勤、审批记录及工资条核定；工时制度需律师确认。")
    return r


def check_limitation_period(termination_iso: str | None, today_iso: str) -> dict[str, Any]:
    """仲裁时效检查（《调解仲裁法》第二十七条，一年）。中止/中断由律师判断。"""
    if not termination_iso:
        return {"deadline": None, "status": "unknown", "severity": "medium",
                "message": "缺少解除/终止日期，无法计算仲裁时效，需律师确认。"}
    t = _parse(termination_iso)
    if not t:
        return {"deadline": None, "status": "unknown", "severity": "medium", "message": "日期格式无效。"}
    deadline = f"{t[0] + 1}-{t[1]:02d}-{t[2]:02d}"
    if today_iso >= deadline:
        return {"deadline": deadline, "status": "expired", "severity": "high",
                "message": f"仲裁时效可能已于 {deadline} 届满，是否存在中止/中断事由需律师紧急评估。"}
    months_left, _ = full_months_between(today_iso, deadline)
    if months_left < 2:
        return {"deadline": deadline, "status": "approaching", "severity": "high",
                "message": f"仲裁时效临近：截止日约为 {deadline}（剩余不足2个月），建议尽快申请。"}
    return {"deadline": deadline, "status": "ok", "severity": "low",
            "message": f"按解除日起算，一年仲裁时效截止日约为 {deadline}（中止/中断情形需律师判断）。"}
