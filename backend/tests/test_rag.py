"""RAG 检索与引用核对 golden cases。"""
from app.rag.citation_check import check_citations
from app.rag.store import get_store

GOLDEN_QUERIES = [
    ("解除劳动合同经济补偿如何计算", "ldht_47"),
    ("未签书面劳动合同 二倍工资", "ldht_82"),
    ("加班费怎么算 休息日加班", "ldf_44"),
    ("公司不缴社保 解除合同能要补偿吗", "sfjs2_si"),
    ("劳动争议是否需要先仲裁", "tjzc_5"),
    ("仲裁时效多长时间", "tjzc_27"),
    ("违法解除赔偿金", "ldht_87"),
    ("组织架构调整 裁员 程序", "ldht_41"),
    ("拖欠工资", "ldht_30"),
    ("打卡记录能否认定加班", "case_demo_2"),
]


def test_retrieval_golden_top3():
    store = get_store()
    for query, expected_id in GOLDEN_QUERIES:
        ids = [h["id"] for h in store.search(query, top_k=3)]
        assert expected_id in ids, f"{query!r} -> {ids}"


def test_results_carry_metadata_and_verification_flag():
    hits = get_store().search("经济补偿", top_k=3)
    assert hits
    for h in hits:
        assert h["effective_date"]
        assert h["source_url"]
        assert h["needs_verification"] is True


def test_topic_filter():
    hits = get_store().search("解除", top_k=5, topics=["limitation"])
    assert all("limitation" in h["topics"] for h in hits)


def test_citation_check_enumeration_and_hallucination():
    cc = check_citations(
        "依据《劳动合同法》第四十七条、第八十七条及《不存在法》第一条，"
        "《劳动法》第四十四条。另见《劳动合同法》第九百条。"
    )
    assert cc["total_citations"] == 5
    assert sum(1 for f in cc["findings"] if f["status"] == "matched") == 3
    # 幻觉法律名 + 幻觉条号 → 各一条 high
    assert cc["unmatched"] == 2


def test_citation_check_summary_entries_flagged_medium():
    cc = check_citations("参见《最高人民法院关于审理劳动争议案件适用法律问题的解释（二）》。")
    assert cc["findings"][0]["severity"] in ("medium", "high")
