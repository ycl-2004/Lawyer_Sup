"""确定性分析服务：从抽取事实生成时间线、请求项、复核发现与文书草稿。

全部为规则/模板实现（非 LLM）：可解释、可测试、离线可用。
缺失事实一律输出占位符，绝不补全。
"""
from __future__ import annotations

from datetime import date
from typing import Any

from . import compensation_service as comp

FactMap = dict[str, dict[str, Any]]


def to_fact_map(facts: list[dict[str, Any]]) -> FactMap:
    out: FactMap = {}
    for f in facts:
        key = f.get("field_key")
        if key and key not in out and f.get("value") is not None:
            out[key] = f
    return out


def _src(f: dict[str, Any]) -> list[dict[str, Any]]:
    return [{"documentId": f.get("document_id", ""), "quote": (f.get("source") or {}).get("quote")}]


def build_timeline(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    fm = to_fact_map(facts)
    events: list[dict[str, Any]] = []
    if "start_date" in fm:
        f = fm["start_date"]
        events.append({
            "event_date": f["value"], "event_type": "入职",
            "title": "劳动者入职",
            "description": "入职日期来自材料抽取，需与社保/考勤起始记录交叉核对。",
            "sources": _src(f), "confidence": f.get("confidence", 0.8),
            "needs_review": bool(f.get("needs_review")),
        })
        if "contract_signed" in fm:
            events.append({
                "event_date": f["value"], "event_type": "签订合同",
                "title": "订立书面劳动合同",
                "description": "以材料中合同文本为据；签订日期需以原件核对。",
                "sources": _src(fm["contract_signed"]), "confidence": 0.75,
                "needs_review": True,
            })
    if "termination_date" in fm:
        f = fm["termination_date"]
        reason = fm.get("termination_reason", {}).get("value")
        events.append({
            "event_date": f["value"], "event_type": "解除通知",
            "title": "用人单位送达解除通知" + (f"（理由：{reason}）" if reason else ""),
            "description": "解除合法性为常见核心争点，需核实程序与依据。",
            "sources": _src(f), "confidence": f.get("confidence", 0.8),
            "disputed": True, "needs_review": True,
        })
    return sorted(events, key=lambda e: e.get("event_date") or "")


def identify_claims(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    fm = to_fact_map(facts)
    claims: list[dict[str, Any]] = []
    if "termination_date" in fm:
        claims.append({
            "claim_type": "unlawful_termination_damages",
            "title": "支付违法解除劳动合同赔偿金（与经济补偿金择一）",
            "basis_facts": [f"用人单位于{fm['termination_date']['value']}解除劳动合同"
                            + (f"，理由为“{fm['termination_reason']['value']}”" if "termination_reason" in fm else "")],
            "legal_basis": ["《劳动合同法》第八十七条", "《劳动合同法》第四十八条"],
            "required_evidence": ["解除通知", "劳动合同", "公司规章制度/解除依据"],
            "missing_evidence": ["公司规章制度或解除依据文件", "解除程序材料（协商/工会）"],
            "risk_level": "medium",
            "alternative_group": "termination_remedy",
            "note": "解除是否违法需律师判断；与经济补偿金二者择一主张。",
        })
        claims.append({
            "claim_type": "economic_compensation",
            "title": "支付经济补偿金（备位；与赔偿金择一）",
            "basis_facts": ["若解除被认定属应付经济补偿情形"],
            "legal_basis": ["《劳动合同法》第四十六条", "《劳动合同法》第四十七条"],
            "required_evidence": ["劳动合同", "解除通知", "解除前12个月工资记录"],
            "missing_evidence": ["解除前12个月完整工资记录（核定补偿基数）"],
            "risk_level": "low",
            "alternative_group": "termination_remedy",
            "note": "备位请求，主备位策略由承办律师决定。",
        })
    if "unpaid_salary" in fm:
        claims.append({
            "claim_type": "unpaid_salary",
            "title": "支付拖欠工资",
            "basis_facts": [str(fm["unpaid_salary"]["value"])],
            "legal_basis": ["《劳动合同法》第三十条"],
            "required_evidence": ["银行流水", "工资条", "劳动合同"],
            "missing_evidence": ["欠付期间完整银行流水"],
            "risk_level": "medium",
            "note": "欠付金额需以银行流水固定后填入计算。",
        })
    if not claims:
        claims.append({
            "claim_type": "pending",
            "title": "暂未识别出可建议的请求项（材料不足）",
            "basis_facts": ["现有材料未抽取到解除/欠薪等关键事实"],
            "legal_basis": ["【待律师确认】"],
            "required_evidence": [],
            "missing_evidence": ["劳动合同", "解除/离职相关文件", "工资支付记录"],
            "risk_level": "high",
            "note": "请补充材料或在工作台人工添加请求项。",
        })
    return claims


def run_calculations(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    fm = to_fact_map(facts)

    def num(key: str) -> float | None:
        v = fm.get(key, {}).get("value")
        if not v:
            return None
        digits = "".join(ch for ch in str(v) if ch.isdigit() or ch == ".")
        try:
            return float(digits) if digits else None
        except ValueError:
            return None

    salary = num("monthly_salary")
    start = fm.get("start_date", {}).get("value")
    end = fm.get("termination_date", {}).get("value")
    out = [
        comp.calc_economic_compensation(salary, start, end).to_dict(),
        comp.calc_unlawful_termination_damages(salary, start, end).to_dict(),
        comp.check_limitation_period(end, date.today().isoformat()),
    ]
    return out


def build_review_findings(
    facts: list[dict[str, Any]], documents: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []
    for f in facts:
        if f.get("needs_review"):
            findings.append({
                "severity": "medium", "finding_type": "needs_review_fact",
                "message": f"{f.get('label')}：{f.get('missing_note') or '需律师复核来源与口径'}",
                "location": f"事实字段 · {f.get('field_key')}",
                "suggestion": "在工作台核对来源原文后确认或修正。",
            })
    failed = [d for d in documents if d.get("parse_status") == "failed"]
    for d in failed:
        findings.append({
            "severity": "high", "finding_type": "missing_evidence",
            "message": f"材料「{d.get('filename')}」解析失败：{d.get('parse_error') or '未知原因'}，其内容未参与分析。",
            "location": f"材料 · {d.get('id')}",
            "suggestion": "使用「手动粘贴文本」补录内容后重新运行工作流。",
        })
    fm = to_fact_map(facts)
    for key, label in [("start_date", "入职日期"), ("monthly_salary", "月工资"),
                        ("termination_date", "解除日期")]:
        if key not in fm:
            findings.append({
                "severity": "high", "finding_type": "missing_evidence",
                "message": f"未能从材料中抽取「{label}」——相关计算与文书将使用占位符。",
                "location": f"事实字段 · {key}",
                "suggestion": "补充对应材料（合同/通知/流水）或人工录入后重跑。",
            })
    return findings


def generate_draft(
    matter: dict[str, Any], facts: list[dict[str, Any]],
    calculations: list[dict[str, Any]],
) -> dict[str, Any]:
    """模板填充式草稿：有来源的事实写入并附锚点，缺失用占位符。"""
    fm = to_fact_map(facts)

    def val(key: str, ph: str) -> str:
        f = fm.get(key)
        return str(f["value"]) if f else f"【待律师确认：{ph}】"

    def anchor(key: str) -> str:
        f = fm.get(key)
        return f" [来源: {f.get('document_id')}]" if f else ""

    calc_by_type = {c.get("calculation_type"): c for c in calculations if isinstance(c, dict)}
    econ = calc_by_type.get("economic_compensation", {})
    unlaw = calc_by_type.get("unlawful_termination_damages", {})

    def amount(c: dict[str, Any], name: str) -> str:
        r = c.get("result")
        return f"人民币{r:,.0f}元" if isinstance(r, (int, float)) else f"【待计算：{name}——缺少输入，详见请求项与计算页】"

    employee = val("employee_name", "申请人姓名")
    employer = fm.get("employer_name", {}).get("value") or matter.get("opposing_party") or "【待确认：被申请人名称】"

    content = f"""> ⚠️ 草稿 · 未经律师审核 · 不得直接对外提交
> 本文书由系统根据已上传材料自动生成（模板填充，非 LLM 自由生成），
> 结构参照劳动仲裁申请书通用格式；提交前由承办律师按管辖仲裁委要求核对调整。

# 劳动仲裁申请书（草稿）

**申请人**：{employee}{anchor("employee_name")}，【待律师确认：性别】，【待律师确认：出生日期】出生，住【待律师确认：住址】，公民身份号码【待律师确认（注意脱敏）】，联系电话【待律师确认】。

**被申请人**：{employer}{anchor("employer_name")}，住所地【待核实：注册地址】，统一社会信用代码【待核实】。
法定代表人：【待核实】。

## 仲裁请求

一、裁决被申请人支付违法解除劳动合同赔偿金{amount(unlaw, "赔偿金")}；
【待律师确认：主备位策略——经济补偿金{amount(econ, "经济补偿金")}与赔偿金二者择一】

二、【待律师确认：是否增加其他请求项（拖欠工资、加班费等以证据固定后填入）】。

## 事实与理由

申请人于{val("start_date", "入职日期")}入职被申请人处{anchor("start_date")}，约定月工资{val("monthly_salary", "月工资标准")}{anchor("monthly_salary")}。{"双方订立书面劳动合同" + anchor("contract_signed") + "。" if "contract_signed" in fm else "【待核实：是否订立书面劳动合同】"}

{val("termination_date", "解除日期")}，被申请人{("以“" + fm["termination_reason"]["value"] + "”为由") if "termination_reason" in fm else ""}解除劳动合同{anchor("termination_date")}。现有材料未显示解除的法定依据与程序履行情况【待核实：规章制度、解除依据、程序材料】。

申请人认为，被申请人的解除行为缺乏事实与法律依据，特依据《劳动争议调解仲裁法》第二条、第五条之规定申请仲裁，请求依法裁决。

## 证据和证据来源

（以工作台「材料管理」与「证据与缺失」页为准，证据原件待律师当面核对）

## 此致

【待律师确认：有管辖权的劳动人事争议仲裁委员会名称】

附：一、本申请书副本【待确认份数】；二、证据清单及证据材料一式【待确认】份；三、申请人身份证明复印件一份。

申请人（签名）：{employee}

【待律师确认：提交日期】年　月　日
"""
    return {
        "draft_type": "arbitration_application",
        "title": "劳动仲裁申请书（草稿 v1 · 自动生成）",
        "content_markdown": content,
        "version": 1,
        "based_on": ["规则/LLM 抽取事实（带来源锚点）", "确定性金额计算", "模板填充（缺失字段为占位符）"],
    }
