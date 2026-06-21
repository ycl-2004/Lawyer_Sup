# 运行手册 & 人工待办（RUNBOOK）

> 一份文档说清三件事：**现在到哪了** → **本机怎么真正跑起来（含后端）** → **只有你能做的人工事项**。

---

## 一、现状速览（2026-06-21）

| 项 | 状态 |
|---|---|
| 在线演示（前端，纯浏览器） | ✅ https://ycl-2004.github.io/Lawyer_Sup/ |
| GitHub Actions CI（前端41+后端50 测试） | ✅ 绿 |
| GitHub Pages 自动部署 | ✅ 绿（push main 即自动发布） |
| 完成度（作品集级） | ~92% |

**在线版能玩什么 / 不能玩什么**（重要，别误会）：
- ✅ **能**：张某案、刘某案两个演示案件的全流程——计算缺输入即拒绝、引用反幻觉核对、复核确认门槛、带水印 docx 导出。**全部在浏览器本地跑，不需要后端。**
- ⚠️ **不能**：「新建实时案件 → 上传真实文件 → 解析 → 持久化」。这部分需要 Python 后端，GitHub Pages 跑不了 Python。**要测这部分，必须在本机把后端跑起来（见下）。**

---

## 二、在本机完整跑起来（含后端 → 才能测真实上传/持久化）

> 前置：装好 **Python 3.10+** 和 **Node.js 18+（LTS）**。检查：`python3 --version`、`node -v`。

### 方式 A：一键启动（最省事，推荐给非技术验收人）

> 双击项目里的 **`start_mac.command`**（Windows 用 `start_windows.bat`）。
> 首次会自动建 Python 环境 + 装依赖 + 构建前端（联网，约 2–5 分钟），之后几秒启动，浏览器自动开 **http://localhost:8000**。

如果双击没反应（macOS 权限），在终端给一次执行权限即可：
```bash
chmod +x start_mac.command
./start_mac.command
```

### 方式 B：手动单地址（和方式 A 等价，看得清每步）

```bash
# 1) 前端构建（产物 dist/ 由后端托管，单地址 8000）
npm install
npm run build

# 2) 后端依赖（首次）
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt        # 慢的话加 -i https://pypi.tuna.tsinghua.edu.cn/simple

# 3) 启动（前端 + API 都在 8000）
python -m uvicorn app.main:app --port 8000
# 打开 http://localhost:8000   （接口文档 http://localhost:8000/docs）
```

### 方式 C：开发模式（要改代码/热重载时用，两个终端）

```bash
# 终端 1：前端 http://localhost:5173（自动指向 8000 后端）
npm run dev

# 终端 2：后端（热重载）
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

> 默认 `mock` 模式：纯规则抽取、离线可用、不调用任何外部 API。要启用 DeepSeek 真实抽取见 §四-C。

---

## 三、跑起来后的「真机验收」动作（证明真实链路通，这些在线版做不了）

按顺序点，对照「应看到」即通过。**测试材料已备好**：[`docs/acceptance/sample_test_case.txt`](./acceptance/sample_test_case.txt)（虚构「林某」案，含合同+解除通知）。

1. 打开 http://localhost:8000 → **应看到** Dashboard，**没有**「在线演示版」蓝色横幅（说明后端已连上）。
2. 点 **「新建案件」** → 当事人填「林某」、对方填「杭州云栖网络科技有限公司」→ 创建并进入材料上传。
3. **上传** `sample_test_case.txt` → **应看到** 材料列表出现该件、状态「已解析」。
4. 点 **「运行 Agent 工作流」** → **应看到** 弹窗逐节点绿色完成 + 「后端管线 · FastAPI」徽章。
5. 看工作区 → **应看到** 抽取出：林某 / 杭州云栖网络科技有限公司 / 入职 2022-04-01 / 月工资 11000 元 / 解除 2026-05-10 / 理由「公司组织架构调整」，**每项带原文来源引用**。
6. **刷新浏览器**（F5）→ **应看到** 案件与数据仍在（= 本地持久化生效）。
7. （可选）复核页填律师姓名 →「确认复核完成」→ 导出材料包。**应看到** 确认人+时间戳被记录。
8. **重启验证**：关掉后端再重新 `uvicorn ...` 启动 → 重新打开案件 → **数据仍在**（= 真持久化，不是内存）。

> 想测「拒绝计算」红线：打开 **刘某案** → 加班小时数留空 → 计算卡片显示「无法计算 — 缺少输入」→ 手动填小时数 → 立即出金额。
> 想测「反幻觉」：任意案件复核页点「核对全部草稿引用」→ 含《不存在法》/第九百条会被标红高风险。

---

## 四、只有你能做的人工待办（系统/CI 做不了的）

### A. 截图 + 演示录屏（作品集 / 验收用，对应 acceptance §F）

跑起来后按下面拍 6 张图 + 1 段录屏，存到 `docs/acceptance/`（建议建 `screenshots/` 子目录）：

- [ ] **F1** 刘某案「拒绝计算 → 填小时数 → 出金额」前后对比图（**最有说服力**）。
- [ ] **F2** 引用核对抓出幻觉引用的标红截图。
- [ ] **F3** 工作流弹窗「后端管线 · FastAPI」绿色徽章截图。
- [ ] **F4** 导出的 docx 用 Word 打开、首页红色「草稿」水印截图。
- [ ] **F5** `http://localhost:8000/docs` 接口文档页截图。
- [ ] **F6** 3–5 分钟演示录屏（口径照 [demo_script.md](./acceptance/demo_script.md)，先念诚实声明页）。

> 截图存好后，可把 F1/F3 放进 README，作品集观感会强很多（需要的话我帮你插）。

### B. 法条逐条官方核对（内容风险最高，但纯人工）

- 打开 [`docs/legal/corpus_verification.md`](./legal/corpus_verification.md)（追踪表，20 条，初始全为「待人工核对」）。
- 逐条点「官方出处」链接（法条 → 国家法律法规数据库 flk.npc.gov.cn；司法解释/类案 → 最高法），把 `corpus.json` 的 `text` 与官方现行文本逐字比对。
- 一致 → 把该行状态改成 `已核对（你的名字/日期）`；不一致 → 改 `backend/app/rag/corpus.json` **并同步** `src/data/legalCorpus.json`，再跑 `python -m app.rag.verify_corpus`（CI 会拦截两份不一致）。

### C. LLM 真实抽取的质量评估（需要 DeepSeek API key）

- 现在离线评估只覆盖「确定性规则层」（召回84%/精确100%/编造0/引用有效100%）；**LLM 增强层的质量还没有数字**。
- 要评估：在 `backend/.env` 配 `LLM_PROVIDER=deepseek` + `LLM_API_KEY=sk-...`（见 `backend/.env.example`），用更难的标注材料跑抽取，人工对比正确率。
- 没有 key 也不影响其他一切（mock 模式全流程可用）。

---

## 五、数据 / 重置 / 排错

- **本地数据在哪**：`backend/data/`（SQLite + 上传原件）。**清空** = 删掉这个目录（已被 .gitignore 忽略，不会进仓库）。
- **端口被占用 / 装依赖慢 / 上传没解析** 等：见 [FAQ](./FAQ.md)。
- **改完代码想确认没坏**：`npm test`（前端41）、`npm run build`、`cd backend && pytest`（后端50）、`python -m app.eval.run_eval`、`python -m app.rag.verify_corpus`——和 CI 同一套。
