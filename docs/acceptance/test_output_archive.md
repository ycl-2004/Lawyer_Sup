# 测试输出存档（验收用）

> 生成时间：2026-06-21 08:55:30 PDT　机器：macOS 15.5 · node v24.4.1 · python Python 3.14.4
> 复现：在项目根执行 `npm test` / `npm run build`，在 backend 执行 `pytest` / `python -m app.eval.run_eval` / `python -m app.rag.verify_corpus`。

## 前端 vitest（计算服务 + 复核门槛 + 组件）
```
 RUN  v2.1.9 /Users/yichenlin/Desktop/AI Agent/Lawyer_Workspace/lawdesk-junior

 ✓ src/lib/reviewGate.test.ts (7 tests) 2ms
 ✓ src/lib/compensation.test.ts (30 tests) 4ms
 ✓ src/components/claims/CalculationCard.test.tsx (4 tests) 31ms

 Test Files  3 passed (3)
      Tests  41 passed (41)
   Start at  08:55:30
   Duration  516ms (transform 61ms, setup 261ms, collect 100ms, tests 36ms, environment 461ms, prepare 65ms)
```

## 前端 typecheck + 生产构建
```
dist/index.html                   0.42 kB │ gzip:   0.35 kB
dist/assets/index-CoZp2OuB.css   22.28 kB │ gzip:   4.86 kB
dist/assets/index-h76SZa7V.js   626.60 kB │ gzip: 197.45 kB
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.06s
```

## 后端 pytest（单测 + 边界 + API + 评估护栏 + 语料一致性）
```
============================= test session starts ==============================
platform darwin -- Python 3.14.4, pytest-9.0.3, pluggy-1.6.0
rootdir: /Users/yichenlin/Desktop/AI Agent/Lawyer_Workspace/lawdesk-junior/backend
plugins: anyio-4.13.0
collected 50 items

tests/test_api.py ..........                                             [ 20%]
tests/test_compensation_edge.py ..........                               [ 40%]
tests/test_compensation_service.py .........                             [ 58%]
tests/test_corpus_consistency.py .                                       [ 60%]
tests/test_extraction_eval.py .....                                      [ 70%]
tests/test_parse_service.py ..........                                   [ 90%]
tests/test_rag.py .....                                                  [100%]


======================== 50 passed, 1 warning in 0.28s =========================
```

## 抽取评估（反幻觉硬指标）
```

- 案件数：8
- 标注真值字段总数：25
- 抽取器产出非空字段：21
- **召回 Recall：84.0%**（正确 21 / 真值 25；漏抽 4）
- **精确 Precision：100.0%**（正确 21 / 产出 21；值错 0）
- **编造 Fabrication：0**（红线指标，应为 0：抽取了真值中不存在的字段）
- **来源引用有效率：100.0%**（共 21 条引用，每条须为原文逐字子串）
```

## 法条语料一致性校验
```
语料条目：20
  [PASS] 前后端语料逐字一致 — 一致
  [PASS] id 唯一 — 唯一
  [PASS] 必填元数据齐全 — 齐全
  [PASS] 出处 URL 为官方域名 — 全部官方域名
  [PASS] 生效日期格式合法 — 合法
```
