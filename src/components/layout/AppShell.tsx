import { Info, Scale, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  GLOBAL_DISCLAIMER,
  POSITIONING_BADGE,
  PRODUCT_NAME,
  PRODUCT_NAME_ZH,
} from "../../config/compliance";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Scale size={16} />
            </span>
            <span className="text-base font-semibold text-slate-900">
              {PRODUCT_NAME}
            </span>
            <span className="hidden text-sm text-slate-500 sm:inline">
              {PRODUCT_NAME_ZH}
            </span>
          </Link>
          <div className="hidden max-w-xl flex-1 items-center md:flex">
            <div className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-400">
              <Search size={14} />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder="搜索案件、材料、客户或关键词（演示版未开放）"
                disabled
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 lg:inline">
              {POSITIONING_BADGE}
            </span>
            <span className="flex items-center gap-2 text-sm text-slate-600">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                ZL
              </span>
              <span className="hidden sm:inline">
                张律师助理 · <span className="text-slate-400">劳动组</span>
              </span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-white px-4 py-2.5 lg:px-6">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <Info size={14} className="mt-0.5 shrink-0 text-blue-500" />
          <span>
            <span className="font-medium text-slate-600">
              所有 AI 输出仅供内部草稿使用，需律师复核确认。
            </span>{" "}
            {GLOBAL_DISCLAIMER}
          </span>
        </p>
      </footer>
    </div>
  );
}
