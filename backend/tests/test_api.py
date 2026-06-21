"""API 层端到端与边界用例（FastAPI TestClient，隔离临时 DB，mock 模式）。

覆盖：健康检查、案件创建、真实上传解析、工作流落库、刷新恢复、
确认审计、空文件/超大文件/404 等边界。
"""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

CONTRACT = (
    "劳动合同\n甲方：测试鲲鹏物流有限公司\n乙方：陈某\n"
    "合同期限自2023年3月1日起至2026年2月28日止。\n月工资人民币9,500元。"
)
TERMINATION = (
    "解除劳动合同通知书\n陈某：\n"
    "因连续旷工，公司决定于2026年5月20日与您解除劳动合同。\n测试鲲鹏物流有限公司"
)


def _create_matter() -> str:
    r = client.post("/api/matters", json={
        "client_alias": "陈某", "opposing_party": "测试鲲鹏物流有限公司",
        "jurisdiction": "深圳", "lead_lawyer": "测试律师",
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_health_ok_mock_mode():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["llm_provider"] == "mock"


def test_demo_matters_listed():
    r = client.get("/api/matters")
    assert r.status_code == 200
    ids = {m["id"] for m in r.json()["matters"]}
    assert {"m_001", "m_002"}.issubset(ids)


def test_create_matter_validation_rejects_empty_alias():
    r = client.post("/api/matters", json={"client_alias": "", "opposing_party": "X 公司"})
    assert r.status_code == 422  # pydantic min_length


def test_full_live_pipeline_and_persistence():
    mid = _create_matter()

    # 上传两份材料（txt 即可，离线必通）
    r = client.post(f"/api/matters/{mid}/documents",
                    files={"file": ("contract.txt", CONTRACT.encode("utf-8"), "text/plain")})
    assert r.json()["parse_status"] == "parsed"
    r = client.post(f"/api/matters/{mid}/documents",
                    files={"file": ("termination.txt", TERMINATION.encode("utf-8"), "text/plain")})
    assert r.json()["parse_status"] == "parsed"

    # 运行工作流
    r = client.post(f"/api/matters/{mid}/workflows/run")
    assert r.status_code == 200
    assert not [e for e in r.json()["events"] if e["status"] == "error"]

    # 工作区恢复（模拟刷新）
    r = client.get(f"/api/matters/{mid}/workspace")
    ws = r.json()
    facts = {f["field_key"]: f["value"] for f in ws["facts"]}
    assert facts.get("employee_name") == "陈某"
    assert facts.get("termination_date") == "2026-05-20"
    assert ws["timeline"] and ws["claims"] and ws["drafts"]

    # 律师确认审计落库
    r = client.post(f"/api/matters/{mid}/confirm", json={"name": "测试律师"})
    assert r.status_code == 200
    r = client.get(f"/api/matters/{mid}/workspace")
    assert r.json()["confirmation"]["name"] == "测试律师"


def test_upload_empty_file_marked_failed():
    mid = _create_matter()
    r = client.post(f"/api/matters/{mid}/documents",
                    files={"file": ("empty.txt", b"", "text/plain")})
    assert r.status_code == 200
    assert r.json()["parse_status"] == "failed"
    assert r.json()["parse_error"]


def test_upload_oversized_rejected_413():
    mid = _create_matter()
    big = b"x" * (20 * 1024 * 1024 + 1)
    r = client.post(f"/api/matters/{mid}/documents",
                    files={"file": ("big.txt", big, "text/plain")})
    assert r.status_code == 413


def test_upload_to_missing_matter_404():
    r = client.post("/api/matters/does_not_exist/documents",
                    files={"file": ("x.txt", b"hi", "text/plain")})
    assert r.status_code == 404


def test_workspace_missing_matter_404():
    r = client.get("/api/matters/nope_404/workspace")
    assert r.status_code == 404


def test_legal_search_returns_hits():
    r = client.post("/api/legal/search", json={"query": "经济补偿 计算标准", "top_k": 3})
    assert r.status_code == 200
    assert r.json()["results"]


def test_citation_check_flags_hallucination():
    r = client.post("/api/legal/citation-check",
                    json={"text": "依据《不存在法》第一条及《劳动合同法》第九百条。"})
    assert r.status_code == 200
    assert r.json()["unmatched"] >= 1
