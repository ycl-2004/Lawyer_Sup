"""材料分类：关键词规则版（确定性、零成本）。后续可由 LLM 分类替换，接口不变。"""
from __future__ import annotations

RULES: list[tuple[str, list[str], str]] = [
    # (label, 必须包含其一, 依据描述)
    ("termination_notice", ["解除劳动合同通知", "解除劳动合同", "终止劳动合同通知"], "出现解除/终止劳动合同字样"),
    ("labor_contract", ["劳动合同", "甲方", "乙方"], "含劳动合同结构要素（甲方/乙方/期限）"),
    ("payslip", ["工资条", "应发工资", "实发工资"], "含工资条目结构"),
    ("bank_transfer", ["转账", "流水", "到账"], "含转账/流水字样"),
    ("attendance", ["考勤", "打卡", "出勤"], "含考勤/打卡记录"),
    ("chat_record", ["微信", "钉钉", "聊天记录"], "对话体或聊天平台字样"),
    ("social_insurance", ["社保", "社会保险", "公积金"], "含社保缴纳信息"),
    ("business_registration", ["统一社会信用代码", "工商", "营业执照"], "含企业登记信息"),
    ("client_statement", ["口述", "陈述", "我"], "第一人称陈述文本"),
]


def classify_document(text: str, filename: str = "") -> tuple[str, float, str]:
    """返回 (doc_type, confidence, reason)。规则未命中 → unknown，交人工指定。"""
    blob = f"{filename}\n{text[:3000]}"
    for label, keywords, reason in RULES:
        hits = [k for k in keywords if k in blob]
        if label == "labor_contract":
            # 合同需同时具备多个要素，避免误判（解除通知也含"劳动合同"）
            if len(hits) >= 2 and "解除" not in blob[:200]:
                return label, 0.8, f"{reason}（命中：{'、'.join(hits)}）"
            continue
        if hits:
            return label, 0.75, f"{reason}（命中：{'、'.join(hits)}）"
    return "unknown", 0.3, "关键词规则未命中，请人工指定材料类型"
