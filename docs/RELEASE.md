# 发布清单（v0.1 起每版照此执行）

## 前置（✅ 已于 2026-10-02 完成）

1. **仓库**：https://github.com/Hokok/devtools-v2 （公开，默认分支 `main`）
2. **Actions secrets**（已配置）：

   | Secret | 值 |
   |---|---|
   | `TAURI_SIGNING_PRIVATE_KEY` | `~/.tauri/devtools-app.key` 的内容（私钥在仓库外，**绝不入库**；丢失则已发布的用户永远无法自动更新） |
   | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 空（密钥生成时未设密码） |

3. **updater 端点**：`tauri.conf.json` 已指向
   `https://github.com/Hokok/devtools-v2/releases/latest/download/latest.json`
   （前端状态机 `src/platform/stores/updater.ts`，UI 为右下角 `UpdateBanner` + 全局设置「关于」区块）。
4. **更新日志**：每个版本的功能条目写进 [CHANGELOG.md](./CHANGELOG.md)，随发版 PR 一起提交。

## 每次发版

1. 确认 `src-tauri/tauri.conf.json` 与 `package.json` 的 `version` 已提升。
2. `git tag v0.x.0 && git push origin v0.x.0` → Release 工作流自动构建
   macOS (Apple Silicon + Intel) 与 Windows 安装包，并生成 `latest.json`。
3. 到 GitHub Releases 检查 Draft：安装包齐全、`latest.json` 存在且签名有效 → **Publish**。
4. 已安装用户会在下次启动时收到更新提示（启动延迟 3s 静默检查一次，发现新版右下角弹提示条；手动检查在全局设置「关于」）。

## 发版前自测更新链路（本地 mock，约 2 分钟）

签发版跑一次 `tauri build` 后即可用其产物自测更新 UI，把 `tauri.conf.json` 的
`plugins.updater.endpoints` 临时指向本地静态服务（`pnpm dlx serve` 之类）：

1. 把 build 产出的 `latest.json` 改掉版本号验证正向路径：确认 `version`
   高于当前版本、`platforms` 下当前平台的 `signature`/`url` 原样保留（url
   指向真实 Release 地址，可省去重新上传产品）。
2. `pnpm tauri dev` 打开应用：
   - 全局设置 →「关于」→「检查更新」→ 应提示发现新版，右下角出现提示条
   - 「立即更新」→ 进度条走完 → 提示「重启应用」→ 点击后应用重启且版本变为 mock 的版本
   - 关闭提示条（X）→ 本次会话不再弹，重启应用后应再次出现
3. 验完把 endpoint 改回正式 Release 地址。

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
- [ ] 全局设置「关于」→「检查更新」在无新版时提示「已是最新版本」；断网时提示检查失败原因
- [ ] 正式发版后 24h 内在旧版安装包上实跑一轮自动更新（真机验证链路，mock 只能验 UI）
- [ ] Windows 侧（CI 出包后）：安装、⌘W 对应 Ctrl+W、WebView2 渲染冒烟、更新条与重启生效
