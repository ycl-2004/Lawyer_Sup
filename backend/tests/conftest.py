"""Pytest 全局夹具：用临时目录隔离 SQLite，避免污染真实 backend/data/lawdesk.db。

必须在任何 app.db 导入之前设置环境变量（db.py 在模块加载时读取 DATA_DIR）。
conftest.py 在测试模块导入前由 pytest 最先加载，满足该时序要求。
"""
import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="lawdesk_test_"))
os.environ["LAWDESK_DATA_DIR"] = str(_TMP)
os.environ.setdefault("LAWDESK_RETENTION_DAYS", "14")

# 显式建表：TestClient 非 with 上下文时不触发 startup 事件（其中调用 init_db）。
from app import db  # noqa: E402

db.init_db()
