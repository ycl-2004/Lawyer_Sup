# 常见问题（FAQ / 复现排错）

## 环境与版本

**Q：需要什么版本？**
Node.js 18+（开发用 20 LTS，CI 用 20）、Python 3.10+（CI 用 3.12；本地 3.14 亦可）。

**Q：完全离线 / 没有 API key 能跑吗？**
能。后端默认 `LLM_PROVIDER=mock`，规则抽取离线可用，全流程不调用任何外部 API。
配置 DeepSeek 后才升级为「规则 + LLM 增强」。

## 安装与启动

**Q：一键启动卡住 / 报错？**
首次运行需联网安装依赖与构建（约 2–5 分钟）。确认已装 Python3 与 Node.js LTS；
公司内网可能需配镜像源（见下）。

**Q：pip 安装慢 / 失败？**
用清华镜像：`pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple`。

**Q：npm 安装慢？**
`npm config set registry https://registry.npmmirror.com` 后再 `npm install`。

**Q：PDF/docx 上传提示「未安装解析组件」？**
`cd backend && pip install pymupdf python-docx`（已在 requirements.txt 中）。
缺库时不会崩溃——会提示用「手动粘贴文本」兜底。

**Q：8000 端口被占用？**
换端口：`uvicorn app.main:app --port 8010`；前端开发态设 `VITE_API_BASE=http://localhost:8010`。

## 使用

**Q：上传自己的 PDF，扫描件没抽出内容？**
扫描件/图片无文本层，OCR 为 v1 范围外。系统会提示解析失败 → 点该材料「手动粘贴文本」录入。

**Q：刷新页面数据还在吗？**
实时案件落本地 SQLite（`backend/data/lawdesk.db`），刷新/重启不丢；14 天无活动自动清理，打开即续期。

**Q：为什么计算卡片显示「无法计算」？**
这是红线设计：缺少必要输入（或日期冲突/负值）时**拒绝计算、不推测**。补齐输入后会实时算出。

**Q：导出按钮点不动？**
导出有门槛：需先处理全部高风险复核发现、勾选四项确认清单、填写承办律师姓名并「确认复核完成」。

## 数据与隐私

**Q：数据存哪？怎么清空？**
全部在本机 `backend/data/`（SQLite + 上传原件）。删除该目录即清空；该目录已被 `.gitignore` 忽略。

**Q：能直接接真实客户材料吗？**
**不建议**。当前脱敏仅前端正则兜底，无传输/存储加密、无访问控制、无鉴权。
接真实材料前需补齐 PIPL 合规（最小必要、删除权、审计、加密、权限），见 `PROJECT_STATUS.md` §五。

## 测试与质量

**Q：怎么跑测试？**
前端 `npm test`（vitest）+ `npm run build`（typecheck+build）；后端 `cd backend && pytest`。
评估报告：`python -m app.eval.run_eval`；语料一致性：`python -m app.rag.verify_corpus`。

**Q：抽取准确率多少？**
规则层（离线）评估：召回 84% / 精确 100% / 编造 0 / 来源引用有效率 100%（诚实记录，
见 `docs/eval/`）。召回偏低是规则层「不许猜」取向的体现，漏抽交 LLM 增强与人工补齐。
