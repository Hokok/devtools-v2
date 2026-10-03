import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// 首个导入：在渲染任何 UI 之前完成工具注册表装配
import "./tools";
import App from "./App";
import "./index.css";

// 屏蔽 WebView 自带右键菜单（重新加载/前进后退/检查元素等浏览器项）——
// 应用内所有编辑器交互走键盘快捷键与工具栏按钮，右键无自有功能
document.addEventListener("contextmenu", (e) => e.preventDefault());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
