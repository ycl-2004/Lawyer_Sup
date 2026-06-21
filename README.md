# LawDesk Junior · 初级律师工作台 Agent（MVP-1）

> 项目状态、风险评估与完成路线图见 [PROJECT_STATUS.md](./PROJECT_STATUS.md)（每次重大变更后更新）。

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

后端默认 mock 模式（规则抽取，离线可用）；配置 DeepSeek 环境变量（见 backend/README.md）
后抽取自动升级为「规则 + LLM 增强（引用逐字校验）」。

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

## 仍为模拟

真实文件解析/OCR、LLM 分类与抽取的前端接入、工作区数据与后端同步、持久化、登录权限。
RAG 语料为人工整理演示样例（正式引用须核对官方文本），向量通道为 TF-IDF 轻量实现，
接 BGE-M3/Qwen embedding 的接口已留好（`backend/app/rag/store.py` 顶部说明）。

## 目录

```
src/        前端（React + Vite + TS + Tailwind）
  lib/compensation.ts      确定性计算服务（+ .test.ts）
  config/compliance.ts     合规措辞统一配置
  data/                    演示数据集（datasets.ts 注册表）
  state/CaseContext.tsx    工作台状态
backend/    FastAPI 骨架（mock/DeepSeek 双模式，pytest 测试）
```

## 下一步（MVP-2）

工作区数据与后端工作流输出全量同步（SSE 流式节点状态）；文件上传走后端真实解析；
接入 DeepSeek 真实抽取（设 LLM_API_KEY 即可）；BGE-M3 稠密向量替换 TF-IDF 通道；
扩充语料（实施条例、地方口径）与评估数据集（5 个标注案件）。
