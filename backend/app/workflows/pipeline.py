"""劳动争议工作流管线（MVP-1 骨架）。

当前为顺序执行的确定性管线，节点结构与计划 §9.3 LangGraph 图一致；
升级路径：将本模块各节点函数注册为 LangGraph StateGraph 节点即可，
状态字典字段已对齐 MatterState schema（计划 §9.4）。
"""
from __future__ import annotations

from datetime import date
from typing import Any, Callable

from ..agents.fact_extractor import extract_facts
from ..data.demo_texts import DEMO_MATERIALS
from ..services import compensation_service as comp

NodeFn = Callable[[dict[str, Any]], str]


def _parse_documents(state: dict[str, Any]) -> str:
    state["parsed"] = {doc_id: m["text"] for doc_id, m in DEMO_MATERIALS.items()}
    return f"解析 {len(state['parsed'])} 份材料（演示文本，MVP-1 接入真实上传/OCR）"


def _classify_documents(state: dict[str, Any]) -> str:
    # 骨架：基于关键词的占位分类；接入 LLM 分类时替换此实现
    labels = {}
    for doc_id, text in state["parsed"].items():
        if "解除劳动合同通知" in text:
            labels[doc_id] = "termination_notice"
        elif "劳动合同" in text and "甲方" in text:
            labels[doc_id] = "labor_contract"
        elif "：" in text and "工资" in text:
            labels[doc_id] = "chat_record"
        else:
            labels[doc_id] = "client_statement"
    state["classification"] = labels
    return f"分类完成：{labels}"


def _extract_facts(state: dict[str, Any]) -> str:
    results = []
    for doc_id, text in state["parsed"].items():
        results.append(extract_facts(text, doc_id))
    state["extraction"] = results
    n = sum(len(r["facts"]) for r in results)
    return f"抽取 {n} 个事实字段（每项附来源，缺失返 null）"


def _calculate_amounts(state: dict[str, Any]) -> str:
    today = date.today().isoformat()
    state["calculations"] = [
        comp.calc_unpaid_wages(
            [{"period": "2026年2月", "amount_owed": 6000, "needs_review": True,
              "source_note": "流水差额+聊天记录佐证，待完整流水核定"}]
        ).to_dict(),
        comp.calc_economic_compensation(12000, "2024-07-01", "2026-03-15").to_dict(),
        comp.calc_unlawful_termination_damages(12000, "2024-07-01", "2026-03-15").to_dict(),
        comp.check_limitation_period("2026-03-15", today),
    ]
    return "确定性计算完成（公式与推导见结果，LLM 不参与计算）"


def _retrieve_legal_sources(state: dict[str, Any]) -> str:
    from ..rag.store import get_store

    store = get_store()
    queries = [
        "违法解除劳动合同 赔偿金 组织架构调整",
        "拖欠工资 足额支付劳动报酬",
        "经济补偿 计算标准",
        "仲裁时效 一年",
    ]
    cards: dict[str, dict[str, Any]] = {}
    for q in queries:
        for hit in store.search(q, top_k=3):
            cards.setdefault(hit["id"], hit)
    state["legal_sources"] = list(cards.values())
    return f"混合检索（BM25+TFIDF+关键词）命中 {len(cards)} 条法条/类案，均附生效日期与出处"


def _review_outputs(state: dict[str, Any]) -> str:
    findings = []
    for r in state.get("extraction", []):
        for f in r["facts"]:
            if f.get("needs_review"):
                findings.append({
                    "severity": "medium",
                    "type": "needs_review_fact",
                    "message": f"{f.get('label')}：{f.get('missing_note') or '需律师复核'}",
                    "document_id": f.get("document_id"),
                })
    state["review_findings"] = findings
    return f"复核检查输出 {len(findings)} 项待律师确认"


NODES: list[tuple[str, str, NodeFn]] = [
    ("parse_documents", "解析材料", _parse_documents),
    ("classify_documents", "分类材料", _classify_documents),
    ("extract_facts", "抽取事实", _extract_facts),
    ("calculate_amounts", "计算金额（确定性）", _calculate_amounts),
    ("retrieve_legal_sources", "检索法条（RAG）", _retrieve_legal_sources),
    ("review_outputs", "复核检查", _review_outputs),
]


def run_pipeline_db(matter_id: str) -> dict[str, Any]:
    """实时案件管线：从 SQLite 读取已上传材料 → 分析 → 全部落库。

    与演示管线节点一致，但每一步的输入输出都是真实数据。
    """
    from .. import db
    from ..agents.document_classifier import classify_document
    from ..rag.store import get_store
    from ..services import analysis_service as ana

    matter = db.get_matter(matter_id)
    if matter is None:
        return {"matter_id": matter_id, "events": [
            {"node": "load", "label": "载入案件", "status": "error", "summary": "案件不存在"}
        ]}

    events: list[dict[str, Any]] = []

    def step(node: str, label: str, fn: Callable[[], str]) -> bool:
        try:
            events.append({"node": node, "label": label, "status": "done", "summary": fn()})
            return True
        except Exception as exc:  # noqa: BLE001 —— 单节点失败可见且不崩整个流程
            events.append({"node": node, "label": label, "status": "error",
                           "summary": f"{type(exc).__name__}: {exc}"})
            return False

    documents = db.list_documents(matter_id)
    parsed = [d for d in documents if d["parse_status"] == "parsed" and d["content"].strip()]
    events.append({
        "node": "parse_documents", "label": "载入已解析材料", "status": "done",
        "summary": f"共 {len(documents)} 份材料，其中 {len(parsed)} 份有可分析文本"
        + (f"，{len(documents) - len(parsed)} 份待处理（解析失败/无文本）" if len(documents) > len(parsed) else ""),
    })

    def _classify() -> str:
        for d in parsed:
            label, conf, reason = classify_document(d["content"], d["filename"])
            db.update_document(d["id"], doc_type=label, confidence=conf,
                               classification_reason=reason,
                               key_excerpt=d["content"].strip().replace("\n", " ")[:80])
        return f"完成 {len(parsed)} 份材料的关键词分类（可在工作台人工修正）"

    step("classify_documents", "分类材料", _classify)

    all_facts: list[dict[str, Any]] = []

    def _extract() -> str:
        providers = set()
        for d in parsed:
            res = extract_facts(d["content"], d["id"])
            providers.add(res["provider"])
            for f in res["facts"]:
                f["source_document_id"] = d["id"]
                f["source_quote"] = (f.get("source") or {}).get("quote")
                all_facts.append(f)
        return f"抽取 {len(all_facts)} 个事实字段（{'、'.join(sorted(providers)) or '无'}；缺失不补全）"

    step("extract_facts", "抽取事实", _extract)

    timeline = ana.build_timeline(all_facts)
    step("build_timeline", "生成时间线", lambda: f"生成 {len(timeline)} 个事件（确定性规则）")

    claims = ana.identify_claims(all_facts)
    step("identify_claims", "识别请求项", lambda: f"建议 {len(claims)} 个请求项（规则映射，需律师确认）")

    calculations = ana.run_calculations(all_facts)
    step("calculate_amounts", "计算金额（确定性）",
         lambda: "计算完成；输入缺失的项目已拒绝计算并标注")

    legal_sources: list[dict[str, Any]] = []

    def _retrieve() -> str:
        store = get_store()
        seen: dict[str, dict[str, Any]] = {}
        queries = [c["title"] for c in claims[:4]] + ["仲裁时效 一年"]
        for q in queries:
            for hit in store.search(q, top_k=3):
                seen.setdefault(hit["id"], hit)
        legal_sources.extend(seen.values())
        return f"混合检索命中 {len(legal_sources)} 条法条/类案（附生效日期与出处）"

    step("retrieve_legal_sources", "检索法条（RAG）", _retrieve)

    draft = ana.generate_draft(matter, all_facts, calculations)
    step("draft_documents", "生成草稿",
         lambda: "模板填充生成仲裁申请书草稿（缺失字段为占位符，非 LLM 自由生成）")

    findings = ana.build_review_findings(all_facts, documents)
    step("review_outputs", "复核检查",
         lambda: f"输出 {len(findings)} 项复核发现（待复核字段/解析失败/关键字段缺失）")

    db.replace_analysis(matter_id, all_facts, timeline, claims,
                        calculations, [draft], findings, legal_sources)
    events.append({"node": "persist", "label": "持久化", "status": "done",
                   "summary": "分析结果已写入本地数据库（刷新页面不丢失；14 天无活动自动清理）"})

    return {
        "matter_id": matter_id,
        "events": events,
        "calculations": calculations,
        "legal_sources": legal_sources,
        "review_findings": findings,
        "disclaimer": "全部输出为草稿，需承办律师逐项复核确认；本接口不输出法律意见。",
    }


def run_pipeline(matter_id: str) -> dict[str, Any]:
    state: dict[str, Any] = {"matter_id": matter_id}
    events: list[dict[str, Any]] = []
    for key, label, fn in NODES:
        try:
            summary = fn(state)
            events.append({"node": key, "label": label, "status": "done", "summary": summary})
        except Exception as exc:  # noqa: BLE001 —— 节点失败需可见而非中断演示
            events.append({"node": key, "label": label, "status": "error", "summary": str(exc)})
            break
    return {
        "matter_id": matter_id,
        "events": events,
        "calculations": state.get("calculations", []),
        "legal_sources": state.get("legal_sources", []),
        "review_findings": state.get("review_findings", []),
        "disclaimer": "全部输出为草稿，需承办律师逐项复核确认；本接口不输出法律意见。",
    }
