"""引用核对：检查草稿中引用的法条是否存在于知识库（Review 质检的一环）。

规则：
- 从文本中提取 《法律名》第X条 形式的引用。
- 法律名在知识库中匹配（含简称），条号精确比对。
- 未命中的引用 → severity=high（可能是幻觉引用或知识库未覆盖，均需律师核对）。
- 命中但为"摘要"类条目 → severity=medium（须核对官方原文）。
"""
from __future__ import annotations

import re
from typing import Any

from .store import get_store

CITATION_RE = re.compile(
    r"《([^》]{2,30})》"
    r"((?:第[一二三四五六七八九十百零\d]+条)(?:[、及和](?:第[一二三四五六七八九十百零\d]+条))*)?"
)
ARTICLE_RE = re.compile(r"第[一二三四五六七八九十百零\d]+条")

# 常见简称 → 知识库全称
ALIASES = {
    "劳动合同法": "中华人民共和国劳动合同法",
    "劳动法": "中华人民共和国劳动法",
    "调解仲裁法": "中华人民共和国劳动争议调解仲裁法",
    "劳动争议调解仲裁法": "中华人民共和国劳动争议调解仲裁法",
}


def check_citations(text: str) -> dict[str, Any]:
    store = get_store()
    findings: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    pairs: list[tuple[str, str]] = []
    for m in CITATION_RE.finditer(text):
        law_raw, articles_blob = m.group(1), m.group(2) or ""
        articles = ARTICLE_RE.findall(articles_blob) or [""]
        for article in articles:
            pairs.append((law_raw, article))

    for law_raw, article in pairs:
        law = ALIASES.get(law_raw, law_raw)
        key = (law, article)
        if key in seen:
            continue
        seen.add(key)

        law_entries = [e for e in store.entries if law in e.get("law", "")]
        if not law_entries:
            findings.append({
                "citation": f"《{law_raw}》{article}",
                "status": "not_found",
                "severity": "high",
                "message": "知识库中未收录该法律/解释——可能为幻觉引用或库未覆盖，须律师核对官方文本后再使用。",
            })
            continue

        if article:
            hit = next((e for e in law_entries if e.get("article", "").startswith(article)), None)
            if hit is None:
                findings.append({
                    "citation": f"《{law_raw}》{article}",
                    "status": "article_not_found",
                    "severity": "high",
                    "message": "法律已收录但该条号未在知识库中——条号可能有误，须逐字核对官方文本。",
                })
                continue
            is_summary = "摘要" in (hit.get("text") or "")[:20] or "摘要" in hit.get("article", "")
            findings.append({
                "citation": f"《{law_raw}》{article}",
                "status": "matched",
                "severity": "medium" if is_summary else "low",
                "matched_id": hit["id"],
                "matched_title": hit.get("title"),
                "effective_date": hit.get("effective_date"),
                "message": (
                    "命中知识库摘要条目，正式引用前须核对官方原文。"
                    if is_summary
                    else "命中知识库条文（演示样例文本），提交前仍须以官方文本核对。"
                ),
            })
        else:
            findings.append({
                "citation": f"《{law_raw}》",
                "status": "law_matched_no_article",
                "severity": "medium",
                "message": "仅引用法律名未注明条号，建议补充具体条文并核对。",
            })

    return {
        "total_citations": len(seen),
        "unmatched": sum(1 for f in findings if f["severity"] == "high"),
        "findings": findings,
        "disclaimer": "引用核对仅针对演示知识库，结果需律师确认；知识库条文为人工整理样例。",
    }
