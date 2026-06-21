"""事实抽取 Agent：规则抽取打底（离线可用、确定性），LLM 增强（可选）。

抽取策略：
1. 规则抽取（正则）：高精度、低召回，对制式文书（合同/通知）效果好，零成本零依赖。
2. 配置了 LLM（DeepSeek 等）时，再跑 LLM 抽取并与规则结果合并：
   字段冲突时规则优先（可解释），LLM 补充规则未覆盖的字段。
3. 反幻觉护栏：任何来源 quote 在原文中找不到 → 强制 needs_review + 降置信度；
   无 source 的非空字段一律 needs_review。

不做的事：绝不凭常识补全材料中没有的信息。
"""
from __future__ import annotations

import re
from typing import Any

from ..services.llm_client import llm

# ---------- 中文日期/金额归一化 ----------

CN_DATE_RE = r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日"


def normalize_cn_date(s: str) -> str | None:
    m = re.search(CN_DATE_RE, s)
    if not m:
        return None
    return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"


def normalize_money(s: str) -> str:
    return s.replace(",", "").replace("，", "")


# ---------- 规则抽取 ----------

def _fact(
    field_key: str, label: str, value: str | None, quote: str | None,
    confidence: float, needs_review: bool, missing_note: str | None = None,
) -> dict[str, Any]:
    return {
        "field_key": field_key,
        "label": label,
        "value": value,
        "confidence": confidence,
        "source": {"quote": quote} if quote else None,
        "needs_review": needs_review,
        "missing_note": missing_note,
    }


RULES: list[tuple[str, str, str, float, bool, str | None]] = [
    # (field_key, label, pattern, confidence, needs_review, missing_note)
    ("employee_name", "劳动者姓名",
     r"乙方（?\(?(?:劳动者)?）?\)?[：:]\s*([一-龥·]{2,4})", 0.85, False, None),
    ("employer_name", "用人单位名称",
     r"甲方（?\(?(?:用人单位)?）?\)?[：:]\s*([一-龥A-Za-z0-9（）()]{4,30}?(?:公司|集团|厂|店|中心|事务所|合伙))",
     0.85, False, None),
    ("start_date", "入职/用工开始日期",
     # 负向先行：排除「自…起解除/终止劳动合同」这类解除条款被误判为入职日期
     r"(?:期限自|合同期限自|自)\s*(" + CN_DATE_RE + r")\s*起(?!\s*(?:解除|终止))", 0.85, False, None),
    ("monthly_salary", "月工资",
     r"月工资(?:为)?(?:人民币)?\s*([\d,，]+(?:\.\d{1,2})?)\s*元", 0.8, True,
     "应发/实发口径需结合工资条与银行流水核实"),
    ("termination_date", "解除日期",
     r"(?:决定)?于\s*(" + CN_DATE_RE + r")\s*(?:与您?|与其)?解除劳动合同", 0.85, False, None),
    ("termination_reason", "解除理由（单位主张）",
     r"因([一-龥]{2,15})[，,]?\s*(?:公司|单位)?决定", 0.7, True,
     "解除理由的事实与程序依据需核实"),
]


def extract_facts_rules(text: str, document_id: str) -> list[dict[str, Any]]:
    """确定性规则抽取：每个命中字段附原文 quote。"""
    facts: list[dict[str, Any]] = []
    for field_key, label, pattern, conf, review, note in RULES:
        m = re.search(pattern, text)
        if not m:
            continue
        raw_value = m.group(1)
        if field_key in ("start_date", "termination_date"):
            value = normalize_cn_date(raw_value) or raw_value
        elif field_key == "monthly_salary":
            value = f"{normalize_money(raw_value)}元"
        else:
            value = raw_value.strip()
        facts.append(
            _fact(field_key, label, value, m.group(0), conf, review, note)
        )
    # 书面合同存在性（结构信号）。引用须为原文逐字子串（反幻觉不变量）：
    # 取真实出现的「甲方…」行作为锚点，而非拼接的示意串。
    if "劳动合同" in text and re.search(r"甲方", text) and re.search(r"乙方", text):
        party_line = re.search(r"甲方[^\n]{0,40}", text)
        quote = party_line.group(0) if party_line else "劳动合同"
        facts.append(
            _fact("contract_signed", "是否订立书面劳动合同", "是（材料含书面合同）",
                  quote, 0.75, True, "签订日期与版本需以原件核对")
        )
    for f in facts:
        f["document_id"] = document_id
        f["extractor"] = "rules"
    return facts


# ---------- LLM 抽取（可选增强） ----------

EXTRACTION_SYSTEM_PROMPT = """你是一个律师助理，只能根据给定材料抽取事实。
规则：
1. 不要补全材料中没有的信息；无法确定的字段返回 null，并在 missing_note 说明需律师补充什么。
2. 每个非 null 字段必须提供 source（包含原文 quote，quote 必须逐字出自材料）。
3. 输出必须是 JSON 对象，键为 facts（数组），不要输出任何额外解释。
4. 每个 fact 包含：field_key, label, value, confidence(0-1), source{quote}, needs_review, missing_note。
字段范围：employee_name, employer_name, job_title, start_date, end_date,
monthly_salary, termination_date, termination_reason, contract_signed,
unpaid_salary, overtime_hours, social_insurance。日期一律 YYYY-MM-DD。"""


def _validate(facts: list[dict[str, Any]], source_text: str, document_id: str) -> list[dict[str, Any]]:
    """引用校验：quote 不在原文 → 强制 needs_review；无 source 的非空字段同样强制。"""
    out: list[dict[str, Any]] = []
    for f in facts:
        f = dict(f)
        f["document_id"] = document_id
        quote = (f.get("source") or {}).get("quote") if f.get("source") else None
        if f.get("value") is not None:
            if not quote:
                f["needs_review"] = True
                f["missing_note"] = (f.get("missing_note") or "") + "（无来源引用，需律师核对）"
            elif quote not in source_text:
                f["needs_review"] = True
                f["confidence"] = min(float(f.get("confidence") or 0.5), 0.5)
                f["missing_note"] = (f.get("missing_note") or "") + "（引用未能在原文中精确定位，可能为改写或幻觉，需律师核对）"
        else:
            f["needs_review"] = True
        out.append(f)
    return out


def extract_facts(text: str, document_id: str) -> dict[str, Any]:
    """规则抽取打底；配置 LLM 后增强合并。"""
    rule_facts = extract_facts_rules(text, document_id)
    provider = "rules"
    merged = {f["field_key"]: f for f in rule_facts}

    if not llm.is_mock:
        user_prompt = f"材料编号：{document_id}\n材料全文：\n---\n{text[:8000]}\n---\n请按规则输出 JSON。"
        try:
            raw = llm.chat_json(EXTRACTION_SYSTEM_PROMPT, user_prompt)
            llm_facts = _validate(raw.get("facts", []), text, document_id)
            for f in llm_facts:
                f["extractor"] = "llm"
                key = f.get("field_key")
                # 规则结果优先（可解释、确定性）；LLM 补充未覆盖字段
                if key and key not in merged and f.get("value") is not None:
                    merged[key] = f
            provider = f"rules+{llm.provider}"
        except Exception as exc:  # noqa: BLE001 —— LLM 故障降级为纯规则，不中断流程
            provider = f"rules（LLM 调用失败已降级：{type(exc).__name__}）"

    return {
        "document_id": document_id,
        "provider": provider,
        "facts": list(merged.values()),
        "disclaimer": "抽取结果为草稿，逐项需律师复核；缺失字段不做推测补全。",
    }
