import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// 首个导入：在渲染任何 UI 之前完成工具注册表装配
import "./tools";
import App from "./App";
import "./index.css";

// 屏蔽 WebView 自带右键菜单（重新加载/前进后退/检查元素等浏览器项）。
// 组件若有自有的右键菜单（如 Tab 栏），在各自的 onContextMenu 里另起弹层——React
// 的派发早于这里，所以这行是兜底：没人接管时，原生的那一套不出现在应用里。
document.addEventListener("contextmenu", (e) => e.preventDefault());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
