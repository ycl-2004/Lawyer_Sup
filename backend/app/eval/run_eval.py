"""规则抽取器评估运行器（确定性、离线）。

度量（诚实记录，无论高低）：
- 召回 Recall = 正确抽取的真值字段 / 标注存在的真值字段总数
- 精确 Precision = 正确抽取 / 抽取器产出的非空字段总数
- 幻觉/编造 Fabrication = 抽取器产出了真值中并不存在的字段数（红线，应为 0）
- 来源引用有效率 Quote validity = quote 确为原文子串的比例（应为 100%）

仅评估规则层（离线可复现）；LLM 增强层因依赖外部 API、非确定性，不在此离线评估。
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..agents.fact_extractor import extract_facts_rules

CASES_PATH = Path(__file__).resolve().parent / "cases.json"


def load_cases() -> list[dict[str, Any]]:
    data = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    return data["cases"]


def run_eval() -> dict[str, Any]:
    cases = load_cases()
    present = correct = wrong = missed = extracted_total = fabricated = 0
    quotes_total = quotes_valid = 0
    per_field: dict[str, dict[str, int]] = {}
    per_case: list[dict[str, Any]] = []

    for case in cases:
        text = case["text"]
        expected: dict[str, str] = case.get("expected", {})
        facts = extract_facts_rules(text, case["id"])
        got = {f["field_key"]: f["value"] for f in facts if f["value"] is not None}

        # 来源引用有效性
        for f in facts:
            q = (f.get("source") or {}).get("quote")
            if q:
                quotes_total += 1
                if q in text:
                    quotes_valid += 1

        c_correct = c_wrong = c_missed = c_fab = 0
        for key, exp_val in expected.items():
            present += 1
            pf = per_field.setdefault(key, {"present": 0, "correct": 0, "missed": 0, "wrong": 0})
            pf["present"] += 1
            if key not in got:
                missed += 1; c_missed += 1; pf["missed"] += 1
            elif got[key] == exp_val:
                correct += 1; c_correct += 1; pf["correct"] += 1
            else:
                wrong += 1; c_wrong += 1; pf["wrong"] += 1

        for key in got:
            extracted_total += 1
            if key not in expected:  # 真值中不存在该字段 → 编造
                fabricated += 1; c_fab += 1

        per_case.append({
            "id": case["id"], "expected": len(expected), "got": len(got),
            "correct": c_correct, "missed": c_missed, "wrong": c_wrong, "fabricated": c_fab,
        })

    recall = correct / present if present else 0.0
    precision = correct / extracted_total if extracted_total else 0.0
    quote_validity = quotes_valid / quotes_total if quotes_total else 1.0
    return {
        "n_cases": len(cases),
        "present_fields": present,
        "extracted_total": extracted_total,
        "correct": correct, "missed": missed, "wrong": wrong, "fabricated": fabricated,
        "recall": round(recall, 4),
        "precision": round(precision, 4),
        "quote_validity": round(quote_validity, 4),
        "quotes_total": quotes_total,
        "per_field": per_field,
        "per_case": per_case,
    }


def format_report(m: dict[str, Any]) -> str:
    lines = [
        "# 规则抽取器评估报告（自动生成）",
        "",
        "> 由 `python -m app.eval.run_eval` 生成。全部为虚构标注数据。",
        "> 仅评估**确定性规则层**（离线可复现）；LLM 增强层非确定性，不在此离线评估。",
        "",
        "## 汇总",
        "",
        f"- 案件数：{m['n_cases']}",
        f"- 标注真值字段总数：{m['present_fields']}",
        f"- 抽取器产出非空字段：{m['extracted_total']}",
        f"- **召回 Recall：{m['recall']:.1%}**（正确 {m['correct']} / 真值 {m['present_fields']}；漏抽 {m['missed']}）",
        f"- **精确 Precision：{m['precision']:.1%}**（正确 {m['correct']} / 产出 {m['extracted_total']}；值错 {m['wrong']}）",
        f"- **编造 Fabrication：{m['fabricated']}**（红线指标，应为 0：抽取了真值中不存在的字段）",
        f"- **来源引用有效率：{m['quote_validity']:.1%}**（共 {m['quotes_total']} 条引用，每条须为原文逐字子串）",
        "",
        "## 分字段",
        "",
        "| 字段 | 真值数 | 正确 | 漏抽 | 值错 |",
        "|---|---|---|---|---|",
    ]
    for key, pf in sorted(m["per_field"].items()):
        lines.append(f"| {key} | {pf['present']} | {pf['correct']} | {pf['missed']} | {pf['wrong']} |")
    lines += [
        "",
        "## 分案件",
        "",
        "| 案件 | 真值 | 产出 | 正确 | 漏抽 | 值错 | 编造 |",
        "|---|---|---|---|---|---|---|",
    ]
    for c in m["per_case"]:
        lines.append(
            f"| {c['id']} | {c['expected']} | {c['got']} | {c['correct']} | "
            f"{c['missed']} | {c['wrong']} | {c['fabricated']} |"
        )
    lines += [
        "",
        "## 诚实解读",
        "",
        "- 规则层的设计取向是**高精确、低召回**：对制式文书（含「甲方/乙方/月工资…元/于…解除」锚点）抽取稳定；",
        "  对非制式表述（如「每月薪资」「自…起解除」「姓名：」无甲乙方前缀）会**主动漏抽**而非猜测——",
        "  这正是「不许猜」红线的体现，漏抽由 LLM 增强层与人工在工作台补齐。",
        "- **编造数应恒为 0、引用有效率应恒为 100%**：这两项是反幻觉护栏的硬指标，比召回更关键。",
        "- 召回数字偏低是**诚实的规则层基线**，不代表系统整体能力（LLM 增强 + 人工确认未计入）。",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    m = run_eval()
    report = format_report(m)
    out = Path(__file__).resolve().parents[3] / "docs" / "eval" / "extraction_eval_report.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(report, encoding="utf-8")
    print(report)
    print(f"\n[written] {out}")


if __name__ == "__main__":
    main()
