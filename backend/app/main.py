"""LawDesk Junior 后端（MVP-1 骨架）。

定位：律师内部辅助工作台后端。所有输出均为草稿，需律师复核；不输出法律意见。
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db
from .agents.fact_extractor import extract_facts
from .data.demo_texts import DEMO_MATTERS
from .rag.citation_check import check_citations
from .rag.store import get_store
from .services import compensation_service as comp
from .services.llm_client import llm
from .services.parse_service import parse_file
from .workflows.pipeline import run_pipeline, run_pipeline_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()  # 含过期案件清理（14 天无活动自动删除）
    yield


app = FastAPI(
    title="LawDesk Junior API",
    description="初级律师工作台后端骨架 —— 内部辅助工具，所有输出均为草稿，需律师复核确认。",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "llm_provider": "mock" if llm.is_mock else llm.provider,
        "note": "mock 模式下不调用外部 API，抽取返回演示结果。",
    }


@app.get("/api/matters")
def list_matters() -> dict:
    live = [{**m, "live": True} for m in db.list_matters()]
    return {
        "matters": [{**m, "live": False} for m in DEMO_MATTERS] + live,
        "disclaimer": "演示案件为虚构数据；实时案件存储于本地数据库，14 天无活动自动清理。",
    }


class CreateMatterRequest(BaseModel):
    client_alias: str = Field(min_length=1, max_length=30, description="当事人（可用匿名代号）")
    opposing_party: str = Field(min_length=1, max_length=50)
    jurisdiction: str = Field(default="", max_length=20)
    lead_lawyer: str = Field(default="", max_length=20)


@app.post("/api/matters")
def create_matter(req: CreateMatterRequest) -> dict:
    """创建实时案件（本地持久化，14 天无活动自动清理）。"""
    return db.create_matter(req.client_alias, req.opposing_party, req.jurisdiction, req.lead_lawyer)


@app.get("/api/matters/{matter_id}/workspace")
def get_workspace(matter_id: str) -> dict:
    """工作区完整数据包（前端刷新后从此处恢复，访问即自动续期）。"""
    bundle = db.get_workspace_bundle(matter_id)
    if bundle is None:
        raise HTTPException(status_code=404, detail="matter not found")
    return bundle


@app.post("/api/matters/{matter_id}/documents")
async def upload_document(matter_id: str, file: UploadFile) -> dict:
    """真实上传：保存原件 + 解析文本。解析失败时返回明确原因，前端引导手动粘贴。"""
    if db.get_matter(matter_id) is None:
        raise HTTPException(status_code=404, detail="matter not found")
    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="文件超过 20MB 限制")
    filename = file.filename or "unnamed"
    result = parse_file(filename, data)

    # 保存原件（与案件同生命周期，过期一并清理）
    mdir = db.UPLOAD_DIR / matter_id
    mdir.mkdir(parents=True, exist_ok=True)
    (mdir / filename).write_bytes(data)

    doc_id = db.add_document(matter_id, {
        "filename": filename,
        "file_type": result.file_type,
        "pages": result.pages,
        "parse_status": "parsed" if result.ok else "failed",
        "parse_error": result.error,
        "ocr_status": result.ocr_status,
        "content": result.text,
        "key_excerpt": result.text.strip().replace("\n", " ")[:80] if result.ok else "",
        "classification_reason": "待运行工作流分类" if result.ok else "解析失败，未分类",
        "confidence": 0.5 if result.ok else 0.0,
    })
    return {"document_id": doc_id, "parse_status": "parsed" if result.ok else "failed",
            "parse_error": result.error}


class DocumentTextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100000)


@app.post("/api/documents/{document_id}/text")
def submit_document_text(document_id: str, req: DocumentTextRequest) -> dict:
    """手动粘贴文本兜底（解析失败/扫描件/图片场景）。"""
    doc = db.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")
    db.update_document(
        document_id, content=req.text, parse_status="parsed", parse_error=None,
        key_excerpt=req.text.strip().replace("\n", " ")[:80],
        classification_reason="人工粘贴文本，待运行工作流分类",
    )
    db.touch_matter(doc["matter_id"])
    return {"document_id": document_id, "parse_status": "parsed"}


class DocumentTypeRequest(BaseModel):
    doc_type: str = Field(min_length=1, max_length=40)


@app.patch("/api/documents/{document_id}/type")
def patch_document_type(document_id: str, req: DocumentTypeRequest) -> dict:
    doc = db.get_document(document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")
    db.update_document(document_id, doc_type=req.doc_type, confidence=1.0,
                       classification_reason="人工修正分类（律师确认）")
    db.touch_matter(doc["matter_id"])
    return {"document_id": document_id, "doc_type": req.doc_type}


class ConfirmRequest(BaseModel):
    name: str = Field(min_length=1, max_length=30)


@app.post("/api/matters/{matter_id}/confirm")
def confirm_matter(matter_id: str, req: ConfirmRequest) -> dict:
    """律师复核确认（审计记录落库：确认人 + 时间戳）。"""
    if db.get_matter(matter_id) is None:
        raise HTTPException(status_code=404, detail="matter not found")
    return db.add_confirmation(matter_id, req.name)


class ExtractRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000, description="材料全文")
    document_id: str = Field(default="doc_adhoc", max_length=64)


@app.post("/api/extract")
def extract(req: ExtractRequest) -> dict:
    """来源化事实抽取：缺失返 null；引用 quote 必须出自原文，否则强制 needs_review。"""
    return extract_facts(req.text, req.document_id)


@app.post("/api/matters/{matter_id}/workflows/run")
def run_workflow(matter_id: str) -> dict:
    """实时案件走 DB 管线（真实解析+抽取+落库）；演示案件走内存演示管线。"""
    if db.get_matter(matter_id) is not None:
        return run_pipeline_db(matter_id)
    if matter_id in {m["id"] for m in DEMO_MATTERS}:
        return run_pipeline(matter_id)
    raise HTTPException(status_code=404, detail="matter not found")


class LegalSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    top_k: int = Field(default=5, ge=1, le=10)
    topics: list[str] | None = None


@app.post("/api/legal/search")
def legal_search(req: LegalSearchRequest) -> dict:
    """法条/类案混合检索（BM25 + TF-IDF + 关键词加权）。"""
    results = get_store().search(req.query, top_k=req.top_k, topics=req.topics)
    return {
        "query": req.query,
        "results": results,
        "retrieval": "hybrid_bm25_tfidf_keyword",
        "disclaimer": "条文为人工整理演示样例，正式引用前须以国家法律法规数据库等官方文本核对。",
    }


@app.get("/api/legal/sources")
def legal_sources() -> dict:
    store = get_store()
    return {"meta": store.meta, "count": len(store.entries), "entries": store.entries}


class CitationCheckRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50000)


@app.post("/api/legal/citation-check")
def citation_check(req: CitationCheckRequest) -> dict:
    """检查文本中引用的《法律》第X条是否存在于知识库（反幻觉引用）。"""
    return check_citations(req.text)


@app.get("/api/calculations/demo", include_in_schema=True)
def calculations_demo() -> dict:
    """确定性金额计算演示（张某案参数）。公式透明，LLM 不参与。"""
    today = date.today().isoformat()
    return {
        "calculations": [
            comp.calc_unpaid_wages(
                [{"period": "2026年2月", "amount_owed": 6000, "needs_review": True}]
            ).to_dict(),
            comp.calc_economic_compensation(12000, "2024-07-01", "2026-03-15").to_dict(),
            comp.calc_unlawful_termination_damages(12000, "2024-07-01", "2026-03-15").to_dict(),
            comp.calc_overtime_pay(8700, 10, 8, 0).to_dict(),
            comp.check_limitation_period("2026-03-15", today),
        ],
        "disclaimer": "金额为草稿，需律师复核；输入缺失时服务将拒绝计算。",
    }


# ---------- 前端静态托管（单地址运行，面向非技术用户） ----------
# 若项目根目录存在 dist/（npm run build 产物），后端直接托管前端：
# 用户只需打开 http://localhost:8000，无需再启动 vite。
_DIST = Path(__file__).resolve().parents[2] / "dist"

if _DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa_fallback(path: str) -> FileResponse:
        candidate = _DIST / path
        if path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_DIST / "index.html")
