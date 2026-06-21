# LawDesk Junior · 初级律师工作台 Agent（MVP-1）

> 🌐 **在线演示**：https://ycl-2004.github.io/Lawyer_Sup/ —— 演示案件（张某/刘某）可直接体验
> 全部「不许猜」红线（计算拒绝、引用反幻觉、复核门槛、带水印导出），纯浏览器运行。
> 实时文件上传与持久化需本地后端（见下方运行说明）。
>
> [English README](./README.en.md) ｜ 项目状态与完成路线图见 [PROJECT_STATUS.md](./PROJECT_STATUS.md)。
> 作品集页与技术文章见 [docs/showcase/](./docs/showcase/project_page.md)。

劳动争议仲裁材料包生成的**律师内部辅助工作台**演示版。

> ⚠️ 定位声明：本系统面向律师/律师助理内部使用，所有输出均为草稿与建议，
> 不构成法律意见，不评估胜诉概率，最终成果必须经承办律师逐项复核确认。

## 运行

### 方式一：一键启动（推荐，面向非技术用户）

双击项目文件夹中的 **`start_mac.command`**（Windows 用 `start_windows.bat`）。
首次运行自动安装依赖并构建（需联网，约 2-5 分钟，需要已安装 Python3 与 Node.js LTS）；
之后每次启动只需数秒，浏览器自动打开 **http://localhost:8000**（单地址，前后端一体）。

- 「实时案件」数据保存在本机 `backend/data/lawdesk.db`，**14 天无活动自动清理**，打开/编辑自动续期。
- 关闭启动窗口即停止运行；删除 `backend/data/` 即清空全部数据。

### 方式二：开发模式

```bash
npm install && npm run dev        # 前端 http://localhost:5173
npm test                          # 金额计算 golden cases（vitest）
# 另开终端：
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
pytest                            # 后端测试
```

后端默认 mock 模式（规则抽取，离线可用）；复制 `backend/.env.example` → `backend/.env`
配置 DeepSeek 环境变量后，抽取自动升级为「规则 + LLM 增强（引用逐字校验）」。
前端可选 `.env.example` → `.env.local` 配置 `VITE_API_BASE`。

## 演示路径建议

1. **实时案件（核心演示）**：Dashboard →「新建案件」→ 上传劳动合同/解除通知（PDF 或 txt）→
   「运行 Agent 工作流」→ 真实抽取出当事人/日期/工资 → 自动计算补偿金 → 模板草稿带来源锚点与占位符 →
   刷新页面数据仍在（本地持久化）。扫描件会提示解析失败 → 用「粘贴文本」兜底。
2. 张某案（演示数据）：概览 → 材料预览 → 时间线 → 请求与计算（改月工资/社平工资看实时重算）→ 草稿（导出带水印 docx）→ 复核确认。
3. 刘某案（加班费）：加班小时数初始为空 → 计算卡片**拒绝计算**，演示"不从打卡记录推测时长"红线。

## 已实现

- Dashboard + 三栏案件工作台（7 个工作区 + AI Inspector）
- 两个完整演示案件（张某违法解除案 / 刘某加班费案，全部虚构）
- 工作流运行动画（节点与计划 §9.3 LangGraph 图一致）
- **确定性金额计算服务**（TS + Python 双实现，同一套 golden tests）：
  拖欠工资、经济补偿（47条推导+三倍封顶+12年上限）、违法解除赔偿（×2）、
  未签合同二倍工资差额、加班费（21.75 基数）、仲裁时效检查。输入缺失即拒绝计算。
- docx 草稿导出（首页强制红色草稿水印）、Markdown 材料包导出（律师确认后解锁）
- 模拟上传、可编辑时间线、请求项采纳/排除、复核发现处理 + 律师确认门槛
- 后端骨架：FastAPI + 事实抽取 Agent（引用必须出自原文，否则强制 needs_review）+
  顺序工作流管线（LangGraph 升级路径已留好）
- **法条 RAG（中国劳动法，条文级知识库）**：
  - 语料：劳动合同法 / 劳动法 / 调解仲裁法核心条文 + 司法解释（一）（二）摘要 + 类案样例，
    共 20 条，每条带 effective_date、官方 source_url、keywords（主拷贝
    `backend/app/rag/corpus.json`，前端同步副本 `src/data/legalCorpus.json`）
  - 检索：BM25（中文 bigram）+ TF-IDF 余弦 + 关键词加权的混合检索，
    前后端同算法双实现（后端不可达自动回退本地），golden 查询 10/10
  - 引用核对：提取草稿中《法律》第X条（支持「第A条、第B条」枚举），
    未命中知识库 = 高风险（疑似幻觉引用）；摘要条目命中 = 中风险须核对原文
  - 接口：`POST /api/legal/search`、`POST /api/legal/citation-check`、`GET /api/legal/sources`
- **前端 ↔ 后端集成**：「运行 Agent 工作流」优先调用
  `POST /api/matters/{id}/workflows/run` 展示真实节点输出（含 RAG 检索节点），
  后端未启动时自动回退本地模拟并明确标注；`VITE_API_BASE` 可配后端地址

## 已落地（Phase 2–3）

真实文件上传解析（PDF/docx/txt + 编码兜底 + 粘贴文本兜底）、规则抽取、工作区数据与后端同步、
SQLite 本地持久化（14 天 TTL）、单地址运行均**已实现并端到端验证**（见 `PROJECT_STATUS.md`）。
测试由前端 22 / 后端 14 增至 **前端 41 / 后端 50**，新增抽取评估集、语料一致性校验与 CI。

## 仍为模拟 / 未做

- **OCR**：扫描件/图片无文本层时不自动识别（v1 范围外），引导手动粘贴。
- **LLM 抽取质量**：接线就绪（`LLM_PROVIDER=deepseek` 启用），但真实抽取质量**未经评估**；
  离线评估仅覆盖确定性规则层（`docs/eval/`）。
- **RAG 语料**：人工整理演示样例，**正式引用须核对官方文本**（`docs/legal/corpus_verification.md`）；
  向量通道为 TF-IDF 轻量实现，接 BGE-M3/Qwen embedding 的接口已留好。
- **登录/权限/多用户、传输与存储加密**：未做；接真实客户材料前为硬性前置条件。

## 测试与质量

```bash
npm test            # 前端 vitest：计算服务 + 复核门槛 + 组件（41 项，jsdom）
npm run build       # tsc --noEmit 类型检查 + 生产构建
cd backend && pytest                  # 后端 50 项：单测 + 边界 + API + 评估护栏 + 语料一致性
python -m app.eval.run_eval           # 抽取评估报告（召回84%/精确100%/编造0/引用有效100%）
python -m app.rag.verify_corpus       # 前后端语料逐字一致性校验
```

CI（GitHub Actions，`.github/workflows/ci.yml`）：前端 typecheck+build+vitest，
后端 pytest+评估+语料校验，双侧守护 TS/Python 计算一致性。

## 文档

- 🚀 [docs/RUNBOOK.md](./docs/RUNBOOK.md) — **本机完整运行步骤 + 真机验收清单 + 人工待办**（先看这个）
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) — 现状评估、风险、完成路线图（每次变更后更新）
- [docs/architecture.md](./docs/architecture.md) — 架构图（数据流 + 分层 + 风控护栏）
- [docs/FAQ.md](./docs/FAQ.md) — 复现排错（版本/镜像源/端口/上传/导出）
- [docs/eval/extraction_eval_report.md](./docs/eval/extraction_eval_report.md) — 抽取评估报告
- [docs/legal/corpus_verification.md](./docs/legal/corpus_verification.md) — 法条官方核对追踪表
- [CHANGELOG.md](./CHANGELOG.md) — 更新日志

## 目录

```
src/        前端（React + Vite + TS + Tailwind）
  lib/compensation.ts      确定性计算服务（+ .test.ts）
  config/compliance.ts     合规措辞统一配置
  data/                    演示数据集（datasets.ts 注册表）
  state/CaseContext.tsx    工作台状态
backend/    FastAPI 骨架（mock/DeepSeek 双模式，pytest 测试）
```

## 下一步

已完成：真实上传解析、持久化、前后端同步、抽取评估集、CI、语料一致性校验。
仍待办（见 `PROJECT_STATUS.md` 路线图）：
- DeepSeek 真实抽取的**质量评估**（prompt + 校验 + 标注集扩到含 LLM 层）。
- 法条文本**逐条官方核对**（追踪表已就绪，待人工对照）。
- BGE-M3 稠密向量替换 TF-IDF 通道；语料扩充（实施条例、地方口径）。
- 工作流 SSE 流式节点状态；人工编辑（时间线/请求项增删）回写后端。
- 接真实材料前的合规前置：脱敏后移、加密、鉴权、审计。
