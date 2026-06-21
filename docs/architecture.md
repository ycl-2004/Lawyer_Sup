# 架构说明

LawDesk Junior 是一个**律师内部辅助工作台**：把散乱的劳动争议材料整理成可复核的仲裁文书草稿。
核心工程主张是「**不许猜**」——确定性计算 + 来源锚定 + 反幻觉核对 + 律师确认门槛。

## 单地址部署

`npm run build` 产物 `dist/` 由后端 FastAPI 静态托管，用户只需打开 **http://localhost:8000**，
前后端一体，面向非技术用户的双击一键启动（`start_mac.command` / `start_windows.bat`）。

## 端到端数据流（实时案件）

```mermaid
flowchart TD
    U[律师上传 PDF/docx/txt] -->|POST /documents| P[解析 parse_service]
    P -->|失败/扫描件| M[手动粘贴文本兜底]
    P --> X[规则抽取 fact_extractor<br/>+ 可选 LLM 增强]
    M --> X
    X -->|引用逐字校验<br/>缺失不补全| C[确定性计算 compensation_service<br/>缺输入即拒绝]
    X --> T[时间线 / 请求项 analysis_service]
    C --> D[模板草稿 generate_draft<br/>缺失=占位符]
    T --> D
    X --> R[法条 RAG store.py<br/>BM25+TFIDF+关键词]
    R --> CC[引用反幻觉核对 citation_check]
    D --> CC
    CC --> RV[复核发现 + 律师确认门槛 reviewGate]
    RV -->|确认后解锁| E[导出 docx 水印 / Markdown 材料包]
    X & C & T & D & R & RV -->|replace_analysis| DB[(SQLite 本地持久化<br/>14 天 TTL)]
    DB -->|GET /workspace 刷新恢复| FE[前端工作台]
```

## 分层

```mermaid
flowchart LR
    subgraph Frontend [前端 React + Vite + TS + Tailwind]
        FUI[pages / components<br/>7 工作区 + Inspector]
        FLIB[lib: compensation.ts · reviewGate.ts<br/>legalSearch.ts · redact.ts · exportDocx.ts]
        FST[state: CaseContext]
        FUI --- FST --- FLIB
    end
    subgraph Backend [后端 FastAPI · stdlib 优先]
        API[main.py<br/>REST + 静态托管 + lifespan]
        AG[agents: fact_extractor · document_classifier]
        SV[services: parse · compensation · analysis · llm_client]
        WF[workflows: pipeline 6+ 节点]
        RAG[rag: store · citation_check · verify_corpus]
        DBL[db.py SQLite]
        API --- WF --- AG & SV & RAG
        WF --- DBL
    end
    FLIB -->|VITE_API_BASE / 同源 api| API
```

## 双实现一致性

金额计算同时有 **TS（`src/lib/compensation.ts`）** 与 **Python（`backend/.../compensation_service.py`）**
两份实现，共享同一套 golden + 边界用例（前端 vitest / 后端 pytest），CI 双侧守护，防止口径漂移。
法条语料 `backend/app/rag/corpus.json` 与前端副本 `src/data/legalCorpus.json` 由 `verify_corpus.py`
校验逐字一致（CI 拦截漂移）。

## 风控护栏（贯穿全链路）

| 护栏 | 位置 | 行为 |
|---|---|---|
| 确定性计算 | `compensation_service` / `compensation.ts` | 公式写死；缺输入/日期冲突/负值 → 拒绝计算，不编数字 |
| 来源锚定 | `fact_extractor` | 每个事实附原文逐字 quote；quote 不在原文 → 强制 needs_review |
| 反幻觉引用 | `citation_check` | 草稿引用的《法律》第X条不在知识库 → 高风险标记 |
| 确认门槛 | `reviewGate.ts` | 高风险发现未清 + 清单未勾 + 无签名 → 不可确认、不可导出 |
| 数据脱敏 | `redact.ts` | 导出前正则兜底脱敏身份证/手机号/账号 |
| 演示边界 | `compliance.ts` | 全局免责声明、草稿水印、「演示样例须核对官方文本」 |

## 升级路径（接口已预留）

- RAG：`store.py` 的 TF-IDF 通道替换为 BGE-M3 / Qwen embedding 即成稠密检索，`search()` 签名不变。
- 抽取：`LLM_PROVIDER=deepseek` 即从纯规则升级为「规则 + LLM 增强（引用逐字校验）」。
- 工作流：顺序管线节点结构已对齐 LangGraph，可平移为 StateGraph。
