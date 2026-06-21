import { BookOpen, ExternalLink, Loader2, Search, Server } from "lucide-react";
import { useState } from "react";
import { searchLegalBackend } from "../../lib/api";
import { searchLocal, type LegalHit } from "../../lib/legalSearch";
import { cls } from "../../lib/utils";

const QUICK_QUERIES = [
  "经济补偿如何计算",
  "违法解除赔偿金",
  "未签合同二倍工资",
  "加班费标准",
  "不缴社保解除合同",
  "仲裁时效",
];

const TYPE_LABELS: Record<LegalHit["source_type"], string> = {
  law: "法律",
  judicial_interpretation: "司法解释",
  case: "类案参考",
};

/** 法条/类案 RAG 检索面板：优先后端混合检索，后端不可达时回退本地同算法实现 */
export function LegalSearchPanel() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LegalHit[] | null>(null);
  const [mode, setMode] = useState<"backend" | "local" | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setLoading(true);
    try {
      const res = await searchLegalBackend(trimmed, 5);
      setHits(res.results);
      setMode("backend");
    } catch {
      setHits(searchLocal(trimmed, 5));
      setMode("local");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <BookOpen size={14} className="text-blue-600" />
        法条 / 类案检索（RAG）
        {mode === "backend" && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
            <Server size={11} /> 后端混合检索
          </span>
        )}
        {mode === "local" && (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
            本地检索（同算法回退）
          </span>
        )}
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        BM25 + TF-IDF + 关键词加权的混合检索；语料为条文级中国劳动法知识库（附生效日期与官方出处）。
        生成内容只允许引用检索结果，检索不到 ≠ 不存在，需律师另行查证。
      </p>

      <div className="mt-3 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(query)}
            placeholder="如：解除劳动合同经济补偿如何计算"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <button
          onClick={() => run(query)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          检索
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => run(q)}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500 hover:border-blue-300 hover:text-blue-700"
          >
            {q}
          </button>
        ))}
      </div>

      {hits != null && (
        <ul className="mt-4 space-y-3">
          {hits.length === 0 && (
            <li className="text-xs text-slate-400">
              未检索到相关条文——这不代表法律上不存在依据，请调整关键词或由律师另行查证。
            </li>
          )}
          {hits.map((h) => (
            <li key={h.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {TYPE_LABELS[h.source_type]}
                </span>
                <p className="text-xs font-semibold text-slate-700">
                  {h.law}
                  {h.article && <span className="ml-1 text-blue-700">{h.article}</span>}
                </p>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                    <span
                      className="block h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.round(h.score * 100)}%` }}
                    />
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {h.score.toFixed(2)}
                  </span>
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-600">{h.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {h.text.length > 120 ? `${h.text.slice(0, 120)}…` : h.text}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {h.matched_keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700"
                  >
                    命中：{kw}
                  </span>
                ))}
                <span className="text-[11px] text-slate-400">
                  生效：{h.effective_date}
                  {h.version_note ? `（${h.version_note}）` : ""}
                </span>
                <a
                  href={h.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className={cls("inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:underline")}
                >
                  官方来源 <ExternalLink size={10} />
                </a>
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  需核对官方文本
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
