"""法条语料一致性 / 完整性校验 + 官方核对追踪表生成。

诚实边界：本脚本**不**声称语料文本与官方文本逐字一致——那需要人工对照
国家法律法规数据库（flk.npc.gov.cn）/ 最高法等官方来源核对。
脚本能确定性保证的是「可机器校验」的部分：
  1. 前后端两份语料拷贝**逐字一致**（消除「双拷贝人工同步」漂移风险）；
  2. id 唯一；必填元数据（生效日期/出处/关键词等）齐全；
  3. 出处 URL 落在官方域名；生效日期格式合法。
并据此生成 `docs/legal/corpus_verification.md` 追踪表，将每条标注为「待人工官方核对」，
供承办人逐条对照官方文本后更新状态——把内容风险显式化、可追踪，而非隐藏。
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parents[3]
_BACKEND_CORPUS = Path(__file__).resolve().parent / "corpus.json"
_FRONTEND_CORPUS = _ROOT / "src" / "data" / "legalCorpus.json"
_TRACKER_OUT = _ROOT / "docs" / "legal" / "corpus_verification.md"

OFFICIAL_DOMAINS = ("flk.npc.gov.cn", "court.gov.cn", "rmfyalk.court.gov.cn")
REQUIRED = ("id", "source_type", "law", "title", "text", "effective_date", "source_url", "keywords")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _load(p: Path) -> dict[str, Any]:
    return json.loads(p.read_text(encoding="utf-8"))


def run_checks() -> tuple[list[tuple[str, bool, str]], list[dict[str, Any]]]:
    be = _load(_BACKEND_CORPUS)
    fe = _load(_FRONTEND_CORPUS)
    entries: list[dict[str, Any]] = be["entries"]
    checks: list[tuple[str, bool, str]] = []

    identical = json.dumps(be, ensure_ascii=False, sort_keys=True) == json.dumps(
        fe, ensure_ascii=False, sort_keys=True
    )
    checks.append(("前后端语料逐字一致", identical,
                   "一致" if identical else "不一致！需同步 backend/app/rag/corpus.json 与 src/data/legalCorpus.json"))

    ids = [e.get("id") for e in entries]
    checks.append(("id 唯一", len(ids) == len(set(ids)),
                   "唯一" if len(ids) == len(set(ids)) else f"重复：{[i for i in ids if ids.count(i) > 1]}"))

    missing = {e.get("id"): [k for k in REQUIRED if not e.get(k)] for e in entries}
    missing = {k: v for k, v in missing.items() if v}
    checks.append(("必填元数据齐全", not missing, "齐全" if not missing else f"缺失：{missing}"))

    bad_url = [e.get("id") for e in entries
               if not any(d in (e.get("source_url") or "") for d in OFFICIAL_DOMAINS)]
    checks.append(("出处 URL 为官方域名", not bad_url, "全部官方域名" if not bad_url else f"非官方：{bad_url}"))

    bad_date = [e.get("id") for e in entries if not DATE_RE.match(e.get("effective_date") or "")]
    checks.append(("生效日期格式合法", not bad_date, "合法" if not bad_date else f"格式异常：{bad_date}"))

    return checks, entries


def build_tracker(entries: list[dict[str, Any]], checks: list[tuple[str, bool, str]]) -> str:
    lines = [
        "# 法条语料官方核对追踪表",
        "",
        "> 由 `python -m app.rag.verify_corpus` 生成。**全部为人工整理的演示样例**。",
        "",
        "## 诚实声明（内容风险）",
        "",
        "- 语料文本为**人工整理**，**尚未逐字对照官方文本核对**；正式引用前必须以",
        "  [国家法律法规数据库](https://flk.npc.gov.cn/) 等官方来源核对原文与现行有效性。",
        "- 下表「核对状态」初始为 **待人工核对**；承办人对照官方文本后将该行改为",
        "  `已核对（核对人/日期）`，使内容风险可追踪、可交付审计。",
        "- 司法解释条目为**摘要**（非全文），命中检索时按中风险提示「须核对原文」。",
        "",
        "## 可机器校验项（确定性，已纳入 CI）",
        "",
        "| 校验项 | 结果 | 说明 |",
        "|---|---|---|",
    ]
    for name, ok, detail in checks:
        lines.append(f"| {name} | {'✅' if ok else '❌'} | {detail} |")
    lines += [
        "",
        f"机器校验：{sum(1 for _, ok, _ in checks if ok)}/{len(checks)} 通过。",
        "",
        "## 逐条官方核对追踪",
        "",
        "| id | 法律/来源 | 条文 | 类型 | 生效日期 | 官方出处 | 核对状态 |",
        "|---|---|---|---|---|---|---|",
    ]
    for e in entries:
        lines.append(
            f"| `{e.get('id')}` | {e.get('law','')} | {e.get('article','')} | "
            f"{e.get('source_type','')} | {e.get('effective_date','')} | "
            f"[官方]({e.get('source_url','')}) | 待人工核对 |"
        )
    lines += [
        "",
        "## 核对操作指引",
        "",
        "1. 打开该条「官方出处」链接（法条：国家法律法规数据库；司法解释/类案：最高法）。",
        "2. 检索对应法律名 + 条号，逐字比对 `text` 字段与官方现行有效文本。",
        "3. 一致则把「核对状态」改为 `已核对（姓名/YYYY-MM-DD）`；不一致则修正 `corpus.json`",
        "   **并同步前端副本**后重跑本脚本（CI 会拦截不一致）。",
        "4. 同时确认该条**现行有效**（未被修订/废止），必要时更新 `effective_date` 与 `version_note`。",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    checks, entries = run_checks()
    tracker = build_tracker(entries, checks)
    _TRACKER_OUT.parent.mkdir(parents=True, exist_ok=True)
    _TRACKER_OUT.write_text(tracker, encoding="utf-8")
    print(f"语料条目：{len(entries)}")
    for name, ok, detail in checks:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name} — {detail}")
    print(f"[written] {_TRACKER_OUT}")
    return 0 if all(ok for _, ok, _ in checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
