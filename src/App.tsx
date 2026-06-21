import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { CaseWorkspacePage } from "./pages/CaseWorkspacePage";
import { DashboardPage } from "./pages/DashboardPage";

// 子路径部署（GitHub Pages /Lawyer_Sup/）时，路由 basename 取构建期 base；
// 根路径部署时 BASE_URL="/"，去尾斜杠后为 ""（等价于根）。
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/matters/:matterId" element={<CaseWorkspacePage />} />
          <Route path="/matters/:matterId/:section" element={<CaseWorkspacePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
