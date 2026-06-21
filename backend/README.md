# LawDesk Junior Backend（MVP-1 骨架）

FastAPI 后端骨架：金额计算服务（Python 版，与前端 TS 版同一套规则与测试）、
LLM 客户端（DeepSeek 就绪、默认 mock 模式）、事实抽取 Agent、工作流管线。

> 默认 `LLM_PROVIDER=mock`：不调用任何外部 API 即可跑通全流程（返回演示抽取结果），
> 适合无网络/无 key 的课堂演示。配置 DeepSeek 后自动切换为真实抽取。

## 运行

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt        # 国内可加 -i https://pypi.tuna.tsinghua.edu.cn/simple
uvicorn app.main:app --reload --port 8000
# 打开 http://localhost:8000/docs 查看接口
pytest                                  # 金额计算 golden cases
```

## 接入 DeepSeek（OpenAI 兼容）

```bash
export LLM_PROVIDER=deepseek
export LLM_BASE_URL=https://api.deepseek.com
export LLM_API_KEY=sk-...
export LLM_MODEL=deepseek-chat
```

换 Qwen/DashScope 只改这三个环境变量，业务代码不动。

## 接口

- `GET  /api/health` — 健康检查（含当前 LLM provider）
- `GET  /api/matters` — 案件列表（演示数据）
- `POST /api/extract` — `{text, document_id}` → 来源化事实抽取
  （mock 模式返回演示结果；真实模式调用 LLM，强制 JSON、缺失返 null、引用必须出自原文）
- `POST /api/matters/{matter_id}/workflows/run` — 顺序执行工作流节点（含 RAG 检索节点），返回逐节点事件
- `GET  /api/calculations/demo` — 确定性金额计算演示（张某案参数）
- `POST /api/legal/search` — `{query, top_k, topics?}` → 法条/类案混合检索
  （BM25 中文 bigram + TF-IDF 余弦 + 关键词加权；结果带 score、命中词、生效日期、官方出处）
- `GET  /api/legal/sources` — 知识库全量条目（20 条，条文级 chunk + 元数据）
- `POST /api/legal/citation-check` — `{text}` → 引用核对（提取《法律》第X条与知识库比对，
  未命中 = 高风险疑似幻觉引用）

## RAG 设计（`app/rag/`）

- `corpus.json` — 语料主拷贝：劳动合同法/劳动法/调解仲裁法核心条文全文 +
  司法解释（一）（二）摘要 + 类案演示样例；每条含 effective_date、source_url、keywords、topics。
  条文文本为人工整理演示样例，正式引用前必须核对国家法律法规数据库官方文本。
  修改后需同步前端副本 `src/data/legalCorpus.json`。
- `store.py` — 混合检索（stdlib-only，无需 jieba/向量库）；
  替换 `_tfidf_vec` 通道为 BGE-M3/Qwen embedding 即升级为真正稠密检索，`search()` 签名不变。
- `citation_check.py` — 草稿引用反幻觉核对（支持「第A条、第B条」枚举与法律简称）。

## 与前端的关系

前端当前使用本地演示数据，不依赖本后端。下一步集成：前端 `运行 Agent 工作流`
改为调用 `/workflows/run` 并以 SSE/轮询渲染真实节点状态。

## 合规设计

- 金额计算全部在 `services/compensation_service.py`，公式透明、缺输入拒绝计算，LLM 不参与。
- 抽取 Agent 的 system prompt 禁止补全材料外信息；引用 quote 在原文中找不到时强制 `needs_review=true`。
- 所有输出标记为草稿，需律师复核。
