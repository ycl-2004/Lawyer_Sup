"""本地 SQLite 持久化层（stdlib，零外部依赖、零运维成本）。

设计约束（面向不懂代码的使用者）：
- 单文件数据库，默认存放在 backend/data/lawdesk.db，删除文件即清空。
- 数据保留策略：案件 14 天无任何活动自动清理（可用 LAWDESK_RETENTION_DAYS 调整）；
  任何读写操作都会刷新案件的 last_active_at（即"打开过就续期"）。
- 仅存模拟/脱敏数据的假设下设计；接入真实客户材料前需加加密与访问控制。
"""
from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

DATA_DIR = Path(os.getenv("LAWDESK_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
DB_PATH = DATA_DIR / "lawdesk.db"
UPLOAD_DIR = DATA_DIR / "uploads"
RETENTION_DAYS = int(os.getenv("LAWDESK_RETENTION_DAYS", "14"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS matters (
  id TEXT PRIMARY KEY,
  client_code TEXT,
  title TEXT,
  client_alias TEXT,
  opposing_party TEXT,
  jurisdiction TEXT,
  lead_lawyer TEXT,
  status TEXT DEFAULT 'intake',
  risk_level TEXT DEFAULT 'medium',
  summary TEXT DEFAULT '',
  created_at TEXT,
  last_active_at TEXT
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  matter_id TEXT,
  filename TEXT,
  file_type TEXT,
  doc_type TEXT DEFAULT 'unknown',
  pages INTEGER DEFAULT 1,
  parse_status TEXT DEFAULT 'pending',
  parse_error TEXT,
  ocr_status TEXT DEFAULT 'not_needed',
  confidence REAL DEFAULT 0.5,
  classification_reason TEXT DEFAULT '',
  key_excerpt TEXT DEFAULT '',
  content TEXT DEFAULT '',
  sensitive INTEGER DEFAULT 0,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY, matter_id TEXT, field_key TEXT, label TEXT,
  value TEXT, confidence REAL, source_document_id TEXT, source_quote TEXT,
  needs_review INTEGER DEFAULT 1, missing_note TEXT
);
CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY, matter_id TEXT, event_date TEXT, event_type TEXT,
  title TEXT, description TEXT, sources_json TEXT DEFAULT '[]',
  confidence REAL, disputed INTEGER DEFAULT 0, needs_review INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY, matter_id TEXT, claim_type TEXT, title TEXT,
  status TEXT DEFAULT 'suggested', basis_facts_json TEXT DEFAULT '[]',
  legal_basis_json TEXT DEFAULT '[]', required_evidence_json TEXT DEFAULT '[]',
  missing_evidence_json TEXT DEFAULT '[]', risk_level TEXT DEFAULT 'medium',
  alternative_group TEXT, note TEXT
);
CREATE TABLE IF NOT EXISTS calculations (
  id TEXT PRIMARY KEY, matter_id TEXT, calc_json TEXT
);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY, matter_id TEXT, draft_type TEXT, title TEXT,
  content_markdown TEXT, version INTEGER DEFAULT 1, generated_at TEXT,
  based_on_json TEXT DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS review_findings (
  id TEXT PRIMARY KEY, matter_id TEXT, severity TEXT, finding_type TEXT,
  message TEXT, location TEXT, suggestion TEXT, resolved INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS confirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, matter_id TEXT, name TEXT, confirmed_at TEXT
);
CREATE TABLE IF NOT EXISTS legal_sources_cache (
  matter_id TEXT PRIMARY KEY, sources_json TEXT DEFAULT '[]'
);
"""

ANALYSIS_TABLES = [
    "facts", "timeline_events", "claims", "calculations",
    "drafts", "review_findings",
]


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def get_conn() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
    purge_expired()


def touch_matter(matter_id: str) -> None:
    """任何活动都刷新保留期（14 天自动续期）。"""
    with get_conn() as conn:
        conn.execute(
            "UPDATE matters SET last_active_at=? WHERE id=?", (_now(), matter_id)
        )


def purge_expired() -> list[str]:
    """删除超过保留期未活动的案件及其全部数据与上传文件。"""
    cutoff = (datetime.now() - timedelta(days=RETENTION_DAYS)).isoformat(timespec="seconds")
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id FROM matters WHERE last_active_at < ?", (cutoff,)
        ).fetchall()
        expired = [r["id"] for r in rows]
        for mid in expired:
            for table in ANALYSIS_TABLES + ["documents", "confirmations", "legal_sources_cache"]:
                conn.execute(f"DELETE FROM {table} WHERE matter_id=?", (mid,))
            conn.execute("DELETE FROM matters WHERE id=?", (mid,))
    for mid in expired:
        mdir = UPLOAD_DIR / mid
        if mdir.exists():
            for f in mdir.iterdir():
                f.unlink(missing_ok=True)
            mdir.rmdir()
    return expired


def retention_deadline(last_active_at: str) -> str:
    try:
        dt = datetime.fromisoformat(last_active_at)
    except ValueError:
        return ""
    return (dt + timedelta(days=RETENTION_DAYS)).strftime("%Y-%m-%d")


# ---------- matters ----------

def create_matter(
    client_alias: str, opposing_party: str, jurisdiction: str, lead_lawyer: str = "",
) -> dict[str, Any]:
    mid = new_id("live")
    code = f"L-{datetime.now().strftime('%y%m%d')}-{mid[-4:]}"
    now = _now()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO matters (id, client_code, title, client_alias, opposing_party,"
            " jurisdiction, lead_lawyer, created_at, last_active_at)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            (
                mid, code,
                f"{client_alias} 与 {opposing_party} 劳动争议",
                client_alias, opposing_party, jurisdiction, lead_lawyer, now, now,
            ),
        )
    return get_matter(mid)  # type: ignore[return-value]


def get_matter(matter_id: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM matters WHERE id=?", (matter_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["retention_until"] = retention_deadline(d["last_active_at"])
    return d


def list_matters() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM matters ORDER BY last_active_at DESC").fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["retention_until"] = retention_deadline(d["last_active_at"])
        out.append(d)
    return out


# ---------- documents ----------

def add_document(matter_id: str, doc: dict[str, Any]) -> str:
    doc_id = new_id("doc")
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO documents (id, matter_id, filename, file_type, doc_type, pages,"
            " parse_status, parse_error, ocr_status, confidence, classification_reason,"
            " key_excerpt, content, sensitive, created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                doc_id, matter_id,
                doc.get("filename", ""), doc.get("file_type", ""),
                doc.get("doc_type", "unknown"), doc.get("pages", 1),
                doc.get("parse_status", "pending"), doc.get("parse_error"),
                doc.get("ocr_status", "not_needed"), doc.get("confidence", 0.5),
                doc.get("classification_reason", ""), doc.get("key_excerpt", ""),
                doc.get("content", ""), int(doc.get("sensitive", False)), _now(),
            ),
        )
    touch_matter(matter_id)
    return doc_id


def update_document(doc_id: str, **fields: Any) -> None:
    if not fields:
        return
    cols = ", ".join(f"{k}=?" for k in fields)
    with get_conn() as conn:
        conn.execute(f"UPDATE documents SET {cols} WHERE id=?", (*fields.values(), doc_id))


def get_document(doc_id: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
    return dict(row) if row else None


def list_documents(matter_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM documents WHERE matter_id=? ORDER BY created_at", (matter_id,)
        ).fetchall()
    return [dict(r) for r in rows]


# ---------- analysis（工作流输出整体替换，保证可重跑） ----------

def replace_analysis(
    matter_id: str,
    facts: list[dict[str, Any]],
    timeline: list[dict[str, Any]],
    claims: list[dict[str, Any]],
    calculations: list[dict[str, Any]],
    drafts: list[dict[str, Any]],
    findings: list[dict[str, Any]],
    legal_sources: list[dict[str, Any]],
) -> None:
    with get_conn() as conn:
        for table in ANALYSIS_TABLES + ["legal_sources_cache"]:
            conn.execute(f"DELETE FROM {table} WHERE matter_id=?", (matter_id,))
        for f in facts:
            conn.execute(
                "INSERT INTO facts VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    new_id("f"), matter_id, f.get("field_key"), f.get("label"),
                    f.get("value"), f.get("confidence"), f.get("source_document_id"),
                    f.get("source_quote"), int(f.get("needs_review", True)),
                    f.get("missing_note"),
                ),
            )
        for e in timeline:
            conn.execute(
                "INSERT INTO timeline_events VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    new_id("t"), matter_id, e.get("event_date"), e.get("event_type"),
                    e.get("title"), e.get("description"),
                    json.dumps(e.get("sources", []), ensure_ascii=False),
                    e.get("confidence", 0.8), int(e.get("disputed", False)),
                    int(e.get("needs_review", False)),
                ),
            )
        for c in claims:
            conn.execute(
                "INSERT INTO claims VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    new_id("c"), matter_id, c.get("claim_type"), c.get("title"),
                    c.get("status", "suggested"),
                    json.dumps(c.get("basis_facts", []), ensure_ascii=False),
                    json.dumps(c.get("legal_basis", []), ensure_ascii=False),
                    json.dumps(c.get("required_evidence", []), ensure_ascii=False),
                    json.dumps(c.get("missing_evidence", []), ensure_ascii=False),
                    c.get("risk_level", "medium"), c.get("alternative_group"),
                    c.get("note"),
                ),
            )
        for calc in calculations:
            conn.execute(
                "INSERT INTO calculations VALUES (?,?,?)",
                (new_id("calc"), matter_id, json.dumps(calc, ensure_ascii=False)),
            )
        for d in drafts:
            conn.execute(
                "INSERT INTO drafts VALUES (?,?,?,?,?,?,?,?)",
                (
                    new_id("d"), matter_id, d.get("draft_type"), d.get("title"),
                    d.get("content_markdown"), d.get("version", 1),
                    d.get("generated_at", _now()),
                    json.dumps(d.get("based_on", []), ensure_ascii=False),
                ),
            )
        for r in findings:
            conn.execute(
                "INSERT INTO review_findings VALUES (?,?,?,?,?,?,?,?)",
                (
                    new_id("r"), matter_id, r.get("severity"), r.get("finding_type"),
                    r.get("message"), r.get("location", ""), r.get("suggestion", ""),
                    int(r.get("resolved", False)),
                ),
            )
        conn.execute(
            "INSERT OR REPLACE INTO legal_sources_cache VALUES (?,?)",
            (matter_id, json.dumps(legal_sources, ensure_ascii=False)),
        )
    touch_matter(matter_id)


def add_confirmation(matter_id: str, name: str) -> dict[str, Any]:
    at = _now()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO confirmations (matter_id, name, confirmed_at) VALUES (?,?,?)",
            (matter_id, name, at),
        )
    touch_matter(matter_id)
    return {"name": name, "confirmed_at": at}


def get_workspace_bundle(matter_id: str) -> dict[str, Any] | None:
    matter = get_matter(matter_id)
    if not matter:
        return None
    with get_conn() as conn:
        def rows(table: str) -> list[dict[str, Any]]:
            return [
                dict(r)
                for r in conn.execute(
                    f"SELECT * FROM {table} WHERE matter_id=?", (matter_id,)
                ).fetchall()
            ]

        facts = rows("facts")
        timeline = []
        for e in rows("timeline_events"):
            e["sources"] = json.loads(e.pop("sources_json") or "[]")
            timeline.append(e)
        claims = []
        for c in rows("claims"):
            c["basis_facts"] = json.loads(c.pop("basis_facts_json") or "[]")
            c["legal_basis"] = json.loads(c.pop("legal_basis_json") or "[]")
            c["required_evidence"] = json.loads(c.pop("required_evidence_json") or "[]")
            c["missing_evidence"] = json.loads(c.pop("missing_evidence_json") or "[]")
            claims.append(c)
        calcs = [json.loads(r["calc_json"]) for r in rows("calculations")]
        drafts = []
        for d in rows("drafts"):
            d["based_on"] = json.loads(d.pop("based_on_json") or "[]")
            drafts.append(d)
        findings = rows("review_findings")
        conf_row = conn.execute(
            "SELECT name, confirmed_at FROM confirmations WHERE matter_id=?"
            " ORDER BY id DESC LIMIT 1",
            (matter_id,),
        ).fetchone()
        ls_row = conn.execute(
            "SELECT sources_json FROM legal_sources_cache WHERE matter_id=?", (matter_id,)
        ).fetchone()
    touch_matter(matter_id)
    return {
        "matter": matter,
        "documents": list_documents(matter_id),
        "facts": facts,
        "timeline": timeline,
        "claims": claims,
        "calculations": calcs,
        "drafts": drafts,
        "review_findings": findings,
        "legal_sources": json.loads(ls_row["sources_json"]) if ls_row else [],
        "confirmation": dict(conf_row) if conf_row else None,
        "retention_note": f"案件 {RETENTION_DAYS} 天无活动将自动清理；任何打开/编辑都会自动续期。",
    }
