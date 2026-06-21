"""法条/类案混合检索（hybrid retrieval）。

实现说明（MVP，stdlib-only，无外部依赖）：
- 中文分词采用字符 bigram（无需 jieba），对法律短查询效果稳定。
- 稀疏检索：BM25（bigram 词袋）。
- "向量"检索：bigram TF-IDF 余弦相似度（与 BM25 互补，平滑长文档偏置）。
- 关键词命中加权：语料人工 keywords 命中查询时强加分（法律检索召回关键）。
- 融合：score = 0.55*bm25_norm + 0.30*cosine_norm + 0.15*keyword_boost。

升级路径：embeddings.py 接口替换为 BGE-M3 / Qwen embedding 即成为真正的
稠密向量检索；本模块的 search() 签名保持不变。
"""
from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_CORPUS_PATH = Path(__file__).parent / "corpus.json"

_PUNCT_RE = re.compile(r"[\s，。；：、？！,.;:?!（）()《》“”\"'【】\[\]\-——·/]+")


def tokenize(text: str) -> list[str]:
    """中文字符 bigram + 连续 ASCII 词。"""
    cleaned = _PUNCT_RE.sub("", text.lower())
    tokens: list[str] = []
    # ASCII 词整体保留（如 N、2N、OCR）
    for m in re.finditer(r"[a-z0-9]+", cleaned):
        tokens.append(m.group())
    han = re.sub(r"[a-z0-9]+", "", cleaned)
    if len(han) == 1:
        tokens.append(han)
    for i in range(len(han) - 1):
        tokens.append(han[i : i + 2])
    return tokens


class LegalStore:
    def __init__(self, corpus_path: Path = _CORPUS_PATH) -> None:
        data = json.loads(corpus_path.read_text(encoding="utf-8"))
        self.meta: dict[str, Any] = data["meta"]
        self.entries: list[dict[str, Any]] = data["entries"]
        self._docs_tokens: list[list[str]] = []
        self._df: dict[str, int] = {}
        for e in self.entries:
            blob = " ".join(
                [e.get("law", ""), e.get("article", ""), e.get("title", ""),
                 e.get("text", ""), " ".join(e.get("keywords", []))]
            )
            toks = tokenize(blob)
            self._docs_tokens.append(toks)
            for t in set(toks):
                self._df[t] = self._df.get(t, 0) + 1
        self._n = len(self.entries)
        self._avgdl = sum(len(t) for t in self._docs_tokens) / max(1, self._n)

    # ---------- BM25 ----------
    def _bm25(self, q_tokens: list[str], doc_idx: int, k1: float = 1.5, b: float = 0.75) -> float:
        doc = self._docs_tokens[doc_idx]
        dl = len(doc)
        score = 0.0
        tf_cache: dict[str, int] = {}
        for t in doc:
            tf_cache[t] = tf_cache.get(t, 0) + 1
        for t in q_tokens:
            tf = tf_cache.get(t, 0)
            if tf == 0:
                continue
            df = self._df.get(t, 0)
            idf = math.log(1 + (self._n - df + 0.5) / (df + 0.5))
            score += idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * dl / self._avgdl))
        return score

    # ---------- TF-IDF cosine（轻量"向量"通道） ----------
    def _tfidf_vec(self, tokens: list[str]) -> dict[str, float]:
        tf: dict[str, int] = {}
        for t in tokens:
            tf[t] = tf.get(t, 0) + 1
        vec = {
            t: (1 + math.log(c)) * math.log(1 + self._n / (self._df.get(t, 0) + 1))
            for t, c in tf.items()
        }
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        return {t: v / norm for t, v in vec.items()}

    @staticmethod
    def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
        if len(a) > len(b):
            a, b = b, a
        return sum(v * b.get(t, 0.0) for t, v in a.items())

    # ---------- 检索 ----------
    def search(
        self,
        query: str,
        top_k: int = 5,
        topics: list[str] | None = None,
        min_score: float = 0.05,
    ) -> list[dict[str, Any]]:
        q_tokens = tokenize(query)
        if not q_tokens:
            return []
        q_vec = self._tfidf_vec(q_tokens)
        q_lower = query.lower()

        scored: list[tuple[float, int, list[str]]] = []
        bm25_raw: list[float] = []
        cos_raw: list[float] = []
        kw_raw: list[float] = []
        matched_kw_all: list[list[str]] = []

        for i, e in enumerate(self.entries):
            if topics and not (set(e.get("topics", [])) & set(topics)):
                bm25_raw.append(0.0); cos_raw.append(0.0); kw_raw.append(0.0)
                matched_kw_all.append([])
                continue
            bm25_raw.append(self._bm25(q_tokens, i))
            cos_raw.append(self._cosine(q_vec, self._tfidf_vec(self._docs_tokens[i])))
            matched = [
                kw for kw in e.get("keywords", [])
                if kw.lower() in q_lower or q_lower in kw.lower()
            ]
            matched_kw_all.append(matched)
            kw_raw.append(min(1.0, len(matched) * 0.5))

        def norm(xs: list[float]) -> list[float]:
            mx = max(xs) if xs else 0.0
            return [x / mx if mx > 0 else 0.0 for x in xs]

        bm25_n, cos_n = norm(bm25_raw), norm(cos_raw)
        for i in range(self._n):
            s = 0.55 * bm25_n[i] + 0.30 * cos_n[i] + 0.15 * kw_raw[i]
            scored.append((s, i, matched_kw_all[i]))

        scored.sort(key=lambda x: -x[0])
        results = []
        for s, i, kws in scored[:top_k]:
            if s < min_score:
                continue
            e = self.entries[i]
            results.append({
                **{k: e.get(k) for k in (
                    "id", "source_type", "law", "article", "title", "text",
                    "effective_date", "version_note", "source_url", "topics",
                )},
                "score": round(s, 4),
                "matched_keywords": kws,
                "needs_verification": True,
            })
        return results


@lru_cache(maxsize=1)
def get_store() -> LegalStore:
    return LegalStore()
