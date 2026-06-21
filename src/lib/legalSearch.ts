/**
 * 本地法条检索（后端不可达时的回退实现）。
 * 与 backend/app/rag/store.py 同一套算法：字符 bigram 的 BM25 + TF-IDF 余弦 + 关键词加权。
 * 语料：src/data/legalCorpus.json（backend/app/rag/corpus.json 的同步副本）。
 */
import corpusJson from "../data/legalCorpus.json";

export interface LegalEntry {
  id: string;
  source_type: "law" | "judicial_interpretation" | "case";
  law: string;
  article?: string;
  title: string;
  text: string;
  effective_date: string;
  version_note?: string;
  source_url: string;
  keywords: string[];
  topics: string[];
}

export interface LegalHit extends LegalEntry {
  score: number;
  matched_keywords: string[];
  needs_verification: boolean;
}

const CORPUS: LegalEntry[] = (corpusJson as { entries: LegalEntry[] }).entries;

const PUNCT_RE = /[\s，。；：、？！,.;:?!（）()《》“”"'【】[\]\-——·/]+/g;

export function tokenize(text: string): string[] {
  const cleaned = text.toLowerCase().replace(PUNCT_RE, "");
  const tokens: string[] = [];
  for (const m of cleaned.matchAll(/[a-z0-9]+/g)) tokens.push(m[0]);
  const han = cleaned.replace(/[a-z0-9]+/g, "");
  if (han.length === 1) tokens.push(han);
  for (let i = 0; i < han.length - 1; i++) tokens.push(han.slice(i, i + 2));
  return tokens;
}

interface Index {
  docsTokens: string[][];
  df: Map<string, number>;
  n: number;
  avgdl: number;
}

let _index: Index | null = null;

function buildIndex(): Index {
  if (_index) return _index;
  const docsTokens = CORPUS.map((e) =>
    tokenize(
      [e.law, e.article ?? "", e.title, e.text, e.keywords.join(" ")].join(" "),
    ),
  );
  const df = new Map<string, number>();
  for (const toks of docsTokens) {
    for (const t of new Set(toks)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = CORPUS.length;
  const avgdl = docsTokens.reduce((s, t) => s + t.length, 0) / Math.max(1, n);
  _index = { docsTokens, df, n, avgdl };
  return _index;
}

function bm25(qTokens: string[], docIdx: number, idx: Index): number {
  const doc = idx.docsTokens[docIdx];
  const tf = new Map<string, number>();
  for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1);
  const k1 = 1.5;
  const b = 0.75;
  let score = 0;
  for (const t of qTokens) {
    const f = tf.get(t) ?? 0;
    if (f === 0) continue;
    const df = idx.df.get(t) ?? 0;
    const idf = Math.log(1 + (idx.n - df + 0.5) / (df + 0.5));
    score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.length) / idx.avgdl));
  }
  return score;
}

function tfidfVec(tokens: string[], idx: Index): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const vec = new Map<string, number>();
  let sq = 0;
  for (const [t, c] of tf) {
    const v = (1 + Math.log(c)) * Math.log(1 + idx.n / ((idx.df.get(t) ?? 0) + 1));
    vec.set(t, v);
    sq += v * v;
  }
  const norm = Math.sqrt(sq) || 1;
  for (const [t, v] of vec) vec.set(t, v / norm);
  return vec;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let s = 0;
  for (const [t, v] of small) s += v * (big.get(t) ?? 0);
  return s;
}

export function searchLocal(query: string, topK = 5): LegalHit[] {
  const idx = buildIndex();
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const qVec = tfidfVec(qTokens, idx);
  const qLower = query.toLowerCase();

  const bm25Raw = CORPUS.map((_, i) => bm25(qTokens, i, idx));
  const cosRaw = CORPUS.map((_, i) => cosine(qVec, tfidfVec(idx.docsTokens[i], idx)));
  const matchedKw = CORPUS.map((e) =>
    e.keywords.filter(
      (kw) => qLower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(qLower),
    ),
  );
  const norm = (xs: number[]) => {
    const mx = Math.max(...xs, 0);
    return xs.map((x) => (mx > 0 ? x / mx : 0));
  };
  const bn = norm(bm25Raw);
  const cn = norm(cosRaw);

  return CORPUS.map((e, i) => ({
    ...e,
    score: Math.round((0.55 * bn[i] + 0.3 * cn[i] + 0.15 * Math.min(1, matchedKw[i].length * 0.5)) * 1e4) / 1e4,
    matched_keywords: matchedKw[i],
    needs_verification: true,
  }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((h) => h.score >= 0.05);
}

/** 本地引用核对（与 backend/app/rag/citation_check.py 同规则） */
const CITATION_RE =
  /《([^》]{2,30})》((?:第[一二三四五六七八九十百零\d]+条)(?:[、及和](?:第[一二三四五六七八九十百零\d]+条))*)?/g;
const ARTICLE_RE = /第[一二三四五六七八九十百零\d]+条/g;

const ALIASES: Record<string, string> = {
  劳动合同法: "中华人民共和国劳动合同法",
  劳动法: "中华人民共和国劳动法",
  调解仲裁法: "中华人民共和国劳动争议调解仲裁法",
  劳动争议调解仲裁法: "中华人民共和国劳动争议调解仲裁法",
};

import type { CitationCheckResult, CitationFinding } from "./api";

export function checkCitationsLocal(text: string): CitationCheckResult {
  const findings: CitationFinding[] = [];
  const seen = new Set<string>();
  const pairs: Array<[string, string]> = [];

  for (const m of text.matchAll(CITATION_RE)) {
    const articles = (m[2] ?? "").match(ARTICLE_RE) ?? [""];
    for (const a of articles) pairs.push([m[1], a]);
  }

  for (const [lawRaw, article] of pairs) {
    const law = ALIASES[lawRaw] ?? lawRaw;
    const key = `${law}|${article}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const lawEntries = CORPUS.filter((e) => e.law.includes(law));
    if (lawEntries.length === 0) {
      findings.push({
        citation: `《${lawRaw}》${article}`,
        status: "not_found",
        severity: "high",
        message: "知识库中未收录该法律/解释——可能为幻觉引用或库未覆盖，须律师核对官方文本。",
      });
      continue;
    }
    if (article) {
      const hit = lawEntries.find((e) => (e.article ?? "").startsWith(article));
      if (!hit) {
        findings.push({
          citation: `《${lawRaw}》${article}`,
          status: "article_not_found",
          severity: "high",
          message: "法律已收录但该条号未在知识库中——条号可能有误，须逐字核对官方文本。",
        });
      } else {
        const isSummary = hit.text.slice(0, 20).includes("摘要") || (hit.article ?? "").includes("摘要");
        findings.push({
          citation: `《${lawRaw}》${article}`,
          status: "matched",
          severity: isSummary ? "medium" : "low",
          matched_title: hit.title,
          effective_date: hit.effective_date,
          message: isSummary
            ? "命中知识库摘要条目，正式引用前须核对官方原文。"
            : "命中知识库条文（演示样例文本），提交前仍须以官方文本核对。",
        });
      }
    } else {
      findings.push({
        citation: `《${lawRaw}》`,
        status: "law_matched_no_article",
        severity: "medium",
        message: "仅引用法律名未注明条号，建议补充具体条文并核对。",
      });
    }
  }

  return {
    total_citations: seen.size,
    unmatched: findings.filter((f) => f.severity === "high").length,
    findings,
    disclaimer: "引用核对仅针对演示知识库，结果需律师确认。",
  };
}
