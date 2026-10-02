import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// 首个导入：在渲染任何 UI 之前完成工具注册表装配
import "./tools";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
