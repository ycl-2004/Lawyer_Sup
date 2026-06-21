# LawDesk Junior · Labor-Dispute Arbitration Workbench (MVP)

> 🌐 **Live demo**: https://ycl-2004.github.io/Lawyer_Sup/ — the demo cases run the full
> "no-guessing" red-line flow (calc refusal, anti-hallucination citation check, review gate,
> watermarked export) entirely in-browser. Real file upload + persistence need the local backend.

[中文 README](./README.md) ｜ Internal assistive tool for junior lawyers — turns messy
labor-dispute materials into **sourced, reviewable, never-fabricated** arbitration draft documents.

> ⚠️ **Positioning**: an internal assistant for lawyers/paralegals. All outputs are **drafts**,
> not legal advice. The system does **not** assess win probability and does **not** replace a
> lawyer's judgment. Every fact, citation, and amount must be verified and confirmed by the
> handling lawyer. All data here is fictional demo data.

## Why this project is different

Most "legal AI" feeds documents to an LLM and lets it generate freely — impressive but untrustworthy:
it invents amounts, hallucinates statutes, and states facts that aren't in the source. This project
inverts that by making **risk control the first-class constraint** — engineering a "**no guessing**" rule:

| Principle | Code | Tests | UI behavior |
|---|---|---|---|
| Amounts aren't guessed by the model | `compensation_service.py` / `compensation.ts` | 30+ golden/edge cases | missing input → card shows "cannot calculate" |
| Every fact must have a source | `fact_extractor.py` | eval: quote-validity 100% | each field carries a verbatim quote |
| Citations can't be hallucinated | `citation_check.py` | golden catches fake law/article | high-risk flagged red in review |
| The lawyer has the final say | `reviewGate.ts` | 7 gate cases | not confirmed → export locked |

## Run

### One-click (for non-technical users)
Double-click `start_mac.command` (Windows: `start_windows.bat`). First run installs deps + builds
(needs network, ~2–5 min; requires Python 3 and Node.js LTS). Then opens **http://localhost:8000**
(single address — backend serves the built frontend).

### Dev mode
```bash
npm install && npm run dev          # frontend at http://localhost:5173
npm test                            # vitest (calc + review gate + components, jsdom)
npm run build                       # tsc --noEmit + production build
# separate terminal:
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
pytest                              # backend tests
```
Backend defaults to `LLM_PROVIDER=mock` (rule-based extraction, fully offline). Copy
`backend/.env.example` → `backend/.env` and set DeepSeek vars to enable LLM-augmented extraction.

## Architecture (30s)

Upload PDF/docx/txt → parse → rule extraction (+ optional LLM, verbatim-quote validated) →
deterministic calculation → legal RAG (BM25 + TF-IDF + keyword) → template draft → review gate →
watermarked export. Local SQLite persistence (14-day TTL). Amount calc has **dual TS/Python
implementations** sharing one test suite, guarded on both sides by CI. See [architecture](./docs/architecture.md).

## Tested & honest (verified on-machine 2026-06-21)

- Frontend **41** vitest + typecheck + build; backend **50** pytest — all green.
- Rule-layer extraction eval (offline, honest): **Recall 84% / Precision 100% / Fabrication 0 /
  Quote-validity 100%**. The eval caught 2 real extraction bugs (now fixed).
- End-to-end: brand-new case → real PDF parse → 7 fields extracted → lawyer confirm →
  **data survives a backend restart**.

## Known limits (stated up front)

- LLM extraction is **wired but its quality is unevaluated**; offline eval covers the deterministic
  rule layer only.
- Legal corpus is **hand-curated demo samples**; official text must be verified before real citation
  ([tracker ready](./docs/legal/corpus_verification.md)).
- RAG is BM25+TF-IDF (**not dense vectors**); interface reserved for BGE-M3. Corpus is 20 entries.
- No auth/encryption/access control — PIPL compliance is a hard prerequisite before real client data.

## Docs

- [PROJECT_STATUS](./PROJECT_STATUS.md) · [Architecture](./docs/architecture.md) · [FAQ](./docs/FAQ.md)
- [Extraction eval report](./docs/eval/extraction_eval_report.md) · [Corpus verification](./docs/legal/corpus_verification.md)
- [Acceptance checklist](./docs/acceptance/acceptance_checklist.md) · [Demo script](./docs/acceptance/demo_script.md)
- Article: [Engineering "no-guessing" constraints for legal AI](./docs/showcase/article_no-guessing-legal-ai.md)

## License

[MIT](./LICENSE)
