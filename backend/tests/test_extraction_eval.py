"""抽取评估作为回归护栏：反幻觉硬指标（编造=0、引用=100%）不得退化。"""
from app.eval.run_eval import run_eval

M = run_eval()


def test_no_fabrication_red_line():
    # 红线：抽取器绝不产出真值中不存在的字段（不许猜）
    assert M["fabricated"] == 0, M["per_case"]


def test_source_quotes_all_verbatim():
    # 红线：每条来源引用必须是原文逐字子串
    assert M["quote_validity"] == 1.0


def test_precision_high():
    # 规则层高精确取向：抽出来的值几乎不应出错
    assert M["precision"] >= 0.95, M


def test_recall_floor_honest_baseline():
    # 诚实基线：规则层召回不追求 100%（漏抽交 LLM/人工），但设回归下限防退化
    assert M["recall"] >= 0.80, M


def test_eval_set_size_sanity():
    assert M["n_cases"] >= 8
    assert M["present_fields"] >= 20
