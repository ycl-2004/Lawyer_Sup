import {
  AlertTriangle,
  CalendarClock,
  FileText,
  FolderOpen,
  Hourglass,
  Loader2,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MatterList } from "../components/matters/MatterList";
import { MATTERS } from "../data/matters";
import { createLiveMatter, listLiveMatters } from "../lib/api";
import type { Matter } from "../lib/types";

const RECENT_ACTIVITY = [
  { time: "06-10 16:45", text: "张某案：证据清单草稿已生成（v1，待律师审核）" },
  { time: "06-10 16:42", text: "张某案：仲裁申请书草稿已生成（v1，待律师审核）" },
  { time: "06-10 15:20", text: "张某案：复核检查完成，发现 5 项待处理（2 项高风险）" },
  { time: "06-09 11:03", text: "刘某案：新建案件，等待材料上传" },
  { time: "06-08 09:30", text: "张某案：7 份材料解析与分类完成（演示数据）" },
];

const RISK_ALERTS = [
  {
    icon: AlertTriangle,
    color: "text-red-600 bg-red-50",
    title: "证据缺失",
    text: "张某案缺少 2026 年 2 月完整银行流水，欠付金额未固定",
  },
  {
    icon: ShieldAlert,
    color: "text-amber-600 bg-amber-50",
    title: "事实支撑不足",
    text: "张某案草稿存在 1 处无来源事实表述，需按复核建议修改",
  },
  {
    icon: CalendarClock,
    color: "text-blue-600 bg-blue-50",
    title: "仲裁时效提示",
    text: "张某案按解除日起算，一年时效截止约 2027-03-15（中断情形需律师判断）",
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [liveMatters, setLiveMatters] = useState<Matter[]>([]);
  const [backendUp, setBackendUp] = useState(false);
  const [checked, setChecked] = useState(false); // 后端探测是否已完成（避免初次加载闪现横幅）
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({ client_alias: "", opposing_party: "", jurisdiction: "" });

  useEffect(() => {
    let alive = true;
    listLiveMatters()
      .then((ms) => {
        if (!alive) return;
        setLiveMatters(ms);
        setBackendUp(true);
      })
      .catch(() => alive && setBackendUp(false))
      .finally(() => alive && setChecked(true));
    return () => {
      alive = false;
    };
  }, []);

  const submitCreate = async () => {
    if (!form.client_alias.trim() || !form.opposing_party.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const m = await createLiveMatter({
        client_alias: form.client_alias.trim(),
        opposing_party: form.opposing_party.trim(),
        jurisdiction: form.jurisdiction.trim(),
      });
      navigate(`/matters/${m.id}/materials`);
    } catch {
      setCreateError("创建失败：后端服务未启动。请双击 start_mac.command（或见 backend/README.md）后重试。");
    } finally {
      setCreating(false);
    }
  };

  const allMatters = [...liveMatters, ...MATTERS];
  const stats = [
    {
      label: "全部案件",
      value: allMatters.length,
      icon: FolderOpen,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "复核中",
      value: allMatters.filter((m) => m.status === "review").length,
      icon: Hourglass,
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "实时案件（本地持久化）",
      value: liveMatters.length,
      icon: FileText,
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "高风险案件",
      value: allMatters.filter((m) => m.riskLevel === "high").length,
      icon: ShieldAlert,
      color: "bg-red-50 text-red-600",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            案件总览 <span className="text-slate-400">/ Matters</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            基于来源材料的律师内部协作工作台 · 所有输出均为草稿
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          title={backendUp ? "创建实时案件（本地持久化，14天无活动自动清理）" : "需先启动后端服务"}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> 新建案件
        </button>
      </div>

      {checked && !backendUp && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm leading-relaxed text-slate-700">
          🌐 <span className="font-medium">在线演示版（GitHub Pages）</span>：下方两个
          <span className="font-medium">演示案件</span>可直接体验全部「不许猜」红线——
          计算缺输入即拒绝、引用反幻觉核对、复核确认门槛、带水印导出，全部在浏览器本地运行、无需后端。
          <span className="text-slate-500">
            　「实时案件」的真实文件上传与本地持久化需运行后端（见 README），在线演示版不提供。
          </span>
        </div>
      )}

      {showCreate && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">
            新建实时案件
            <span className="ml-2 text-xs font-normal text-slate-400">
              数据仅保存在本机，14 天无活动自动清理（打开/编辑会自动续期）
            </span>
          </h2>
          {!backendUp && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              检测到后端服务未启动。双击项目文件夹中的 start_mac.command（Windows 用
              start_windows.bat）即可一键启动；启动后回到本页重试。
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-600">
              当事人（可用匿名代号）
              <input
                value={form.client_alias}
                onChange={(e) => setForm({ ...form, client_alias: e.target.value })}
                placeholder="如：李某"
                className="mt-1 block w-44 rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              对方公司
              <input
                value={form.opposing_party}
                onChange={(e) => setForm({ ...form, opposing_party: e.target.value })}
                placeholder="如：某某科技有限公司"
                className="mt-1 block w-56 rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              地区
              <input
                value={form.jurisdiction}
                onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                placeholder="如：上海"
                className="mt-1 block w-28 rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              />
            </label>
            <button
              onClick={() => void submitCreate()}
              disabled={creating || !form.client_alias.trim() || !form.opposing_party.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              创建并进入材料上传
            </button>
          </div>
          {createError && <p className="mt-2 text-xs text-red-600">{createError}</p>}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
              <s.icon size={18} />
            </span>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-xl font-semibold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            案件列表{" "}
            <span className="font-normal text-slate-400">
              （{liveMatters.length} 个实时 + {MATTERS.length} 个演示）
            </span>
          </h2>
          <MatterList matters={allMatters} />
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700">最近动态</h3>
            <ul className="mt-3 space-y-3">
              {RECENT_ACTIVITY.map((a, i) => (
                <li key={i} className="flex gap-2 text-xs">
                  <span className="shrink-0 font-mono text-slate-400">{a.time}</span>
                  <span className="text-slate-600">{a.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700">风险提醒</h3>
            <ul className="mt-3 space-y-3">
              {RISK_ALERTS.map((r, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${r.color}`}>
                    <r.icon size={14} />
                  </span>
                  <div className="text-xs">
                    <p className="font-medium text-slate-700">{r.title}</p>
                    <p className="mt-0.5 leading-relaxed text-slate-500">{r.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
