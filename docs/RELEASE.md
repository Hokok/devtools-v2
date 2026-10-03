# 发布清单（v0.1 起每版照此执行）

## 前置（✅ 已于 2026-10-02 完成）

1. **仓库**：https://github.com/Hokok/devtools-v2 （公开，默认分支 `main`）
2. **Actions secrets**（已配置）：

   | Secret | 值 |
   |---|---|
   | `TAURI_SIGNING_PRIVATE_KEY` | `~/.tauri/devtools-app.key` 的内容（私钥在仓库外，**绝不入库**；丢失则已发布的用户永远无法自动更新） |
   | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 空（密钥生成时未设密码） |

3. **updater 端点**：`tauri.conf.json` 已指向
   `https://github.com/Hokok/devtools-v2/releases/latest/download/latest.json`。

## 每次发版

1. 确认 `src-tauri/tauri.conf.json` 与 `package.json` 的 `version` 已提升。
2. `git tag v0.x.0 && git push origin v0.x.0` → Release 工作流自动构建
   macOS (Apple Silicon + Intel) 与 Windows 安装包，并生成 `latest.json`。
3. 到 GitHub Releases 检查 Draft：安装包齐全、`latest.json` 存在且签名有效 → **Publish**。
4. 已安装用户会在下次启动时收到更新提示（updater 每 24h 检查一次）。

## 未签名的现状（个人开源的常见取舍）

- **macOS**：未做 Apple 公证（$99/年），用户首次打开需 `右键 App → 打开`，或
  `xattr -cr /Applications/DevTools.app`。
- **Windows**：无 EV 证书，SmartScreen 会提示"更多信息 → 仍要运行"。
- 口碑起来后再评估购买证书，属于独立决策。

## 每版人工冒烟清单（CI 无法覆盖的桌面行为）

在 `pnpm tauri dev` 的真实窗口里过一遍（约 5 分钟）：

- [ ] ⌘W 关闭当前标签页（而不是关闭窗口）；窗口菜单栏出现「编辑 / 窗口」
- [ ] 任意 Tab 输入内容后按 ⌘Q → 弹出"放弃内容并退出"确认；空 Tab 时直接退出
- [ ] 工具内「粘贴」按钮可用（WKWebView 剪贴板权限链路）
- [ ] 修改任一设置（如 JSON 缩进）→ 重启应用 → 设置保留
  （落盘文件：`~/Library/Application Support/io.github.devtools.desktop/workbench.json`）
- [ ] 命令面板 ⌘K、中文输入法打 "sj" 回车选词 → 打开时间戳而非误触发
- [ ] JSON 提取：勾选列 → CSV 页签 → 「导出 CSV」弹出系统另存为对话框，保存后用 Excel 打开中文不乱码（dialog/fs 插件链路；用户在对话框选中的路径由 dialog 自动加入 fs 范围）
- [ ] Windows 侧（CI 出包后）：安装、⌘W 对应 Ctrl+W、WebView2 渲染冒烟
