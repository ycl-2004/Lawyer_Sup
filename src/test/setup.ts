// Vitest 组件测试环境装配：注入 jest-dom 匹配器（含对 vitest 的类型增强），
// 每个用例后清理已渲染的 DOM，避免相互污染。
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
