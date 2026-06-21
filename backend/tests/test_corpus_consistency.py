"""语料一致性回归护栏：前后端双拷贝漂移、缺字段、非官方出处等一律拦截。"""
from app.rag.verify_corpus import run_checks


def test_all_corpus_checks_pass():
    checks, entries = run_checks()
    failed = [(name, detail) for name, ok, detail in checks if not ok]
    assert not failed, failed
    assert len(entries) >= 20
