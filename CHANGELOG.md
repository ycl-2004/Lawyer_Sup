# 更新日志 / Changelog

格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；
版本遵循语义化版本意图（本项目处于 0.x，接口可能变动）。

## [Unreleased]

- Phase 4–6：文档与复现、交付验收材料、作品集包装（进行中）。

## [0.2.0] - 2026-06-21 — Phase 3 稳定性与质量

### Added
- **后端边界用例**：解析服务（空文件/乱码/不支持类型/图片/真实 PDF·docx/超长文档）、
  金额计算（日期冲突、零/负金额、负工时一律拒绝计算）、API 层端到端（隔离临时 DB）。
  后端 pytest 由 14 增至 **50**。
- **抽取评估集**：8 个标注案件 + 运行器，诚实记录规则层指标
  （召回 84% / 精确 100% / **编造 0** / **来源引用有效率 100%**）。报告见 `docs/eval/`。
- **前端组件测试**：引入 jsdom + Testing Library；计算卡片（拒绝计算路径）与
  复核门槛逻辑测试。前端 vitest 由 22 增至 **41**。
- **法条语料一致性校验器**：前后端双拷贝逐字一致、必填元数据、官方域名出处校验，
  并生成官方核对追踪表 `docs/legal/corpus_verification.md`。
- **CI**：GitHub Actions（前端 typecheck+build+vitest，后端 pytest+评估+语料校验）。

### Fixed
- 抽取器误把「自…起解除劳动合同」识别为入职日期（假阳性，评估集发现）→ 负向先行修正。
- `contract_signed` 来源引用为拼接示意串而非原文子串（违反反幻觉不变量）→ 改为真实「甲方…」行。
- 解析服务空文件/全空白返回明确错误（此前静默判失败无原因）。
- FastAPI `on_event` 迁移为 lifespan（去除弃用告警）。

### Changed
- 复核门槛逻辑从 `ReviewSection` 抽离为纯函数 `lib/reviewGate.ts`（可单测、防漂移）。
- TS 与 Python 计算服务同步新增「日期冲突/负值拒绝」规则，保持双实现一致。

## [0.1.0] - 2026-06-11 — Phase 1–2 MVP

### Added
- Dashboard + 三栏案件工作台（7 工作区 + AI Inspector）；两个完整演示案件。
- **确定性金额计算服务**（TS + Python 双实现，同一套 golden tests）：拖欠工资、经济补偿
  （47 条推导 + 三倍封顶 + 12 年上限）、违法解除赔偿、二倍工资差额、加班费、仲裁时效。
- **法条 RAG**（劳动法条文级语料 20 条，BM25 + TF-IDF + 关键词混合检索）与草稿引用反幻觉核对。
- **真实数据链路**：上传 PDF/docx/txt → 解析（PyMuPDF/python-docx，编码兜底，粘贴文本兜底）
  → 规则抽取（+ 可选 LLM 增强）→ 确定性计算 → 模板草稿 → 复核门槛 → 带水印导出。
- **本地持久化**：SQLite 全量落库（14 天 TTL + 自动续期 + 级联清理）；单地址运行 + 一键启动脚本。

[Unreleased]: https://github.com/ycl-2004/Lawyer_Sup/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ycl-2004/Lawyer_Sup/releases/tag/v0.2.0
[0.1.0]: https://github.com/ycl-2004/Lawyer_Sup/releases/tag/v0.1.0
