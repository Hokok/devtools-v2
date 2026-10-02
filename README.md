# DevTools

开发者的随身工作台——一个打开即用、用完即走的桌面工具合集。Tauri 2 + React 19，空载内存 ~60-120MB，安装包个位数 MB，支持 Windows / macOS。

![设计基调](docs/DESIGN.md)：石墨黑 + 荧光青的"仪器风"工作台；左侧分组导航（可收缩）、中间 Chrome 式多 Tab 工作区（切换零刷新）、右侧 schema 驱动的每工具设置面板、`Ctrl/Cmd+K` 命令面板。

## 当前工具（MVP 8 个）

| 工具 | 说明 |
|---|---|
| JSON 格式化 | 美化 / 压缩 / 校验（带行号）/ 键排序 / 转义非 ASCII |
| Base64 | UTF-8 安全编解码，兼容 URL 安全字母表 |
| URL 编解码 | 组件模式 / 整体模式 |
| 时间戳转换 | 双向转换 + 相对时间，空输入实时显示当前时刻 |
| UUID 生成器 | 批量 v4（密码学随机）、大写开关 |
| 哈希计算 | MD5 / SHA-1 / SHA-256 / SHA-512 |
| JWT 解析 | Header / Payload 解码 + exp 剩余时间（本地解码，不验证签名） |
| 正则测试器 | 实时匹配列表、分组捕获、flag 开关（首个"异形布局"工具） |

## 开发

```bash
pnpm install
pnpm dev            # 纯浏览器调试（无需 Rust，存储降级 localStorage）
pnpm test           # transform 纯函数单测（vitest）
pnpm tauri dev      # 桌面窗口（需要 Rust 工具链）
pnpm tauri build    # 双端安装包（macOS: icns，Windows: NSIS）
```

## 架构一页纸

```
WebView（全部工具逻辑在此，按需懒加载）
  app/        Workbench 三栏外壳 + 命令面板
  platform/   ToolDefinition 契约 / 注册表 / Tab·设置 store / Worker 执行器
  editor/     CodeMirror 6 封装（按需语言包）
  tools/      每工具一个目录：index.ts(元信息) + impl.ts + transform.ts(纯函数) + texts.ts
src-tauri/    Rust 只装配官方插件：窗口 / store / 剪贴板
```

三条铁律（详见 `docs/adr/`）：

1. **注册表只含元信息**——工具实现必须走动态 `import()`，未打开的工具零内存开销（ADR-0002）。
2. **转换逻辑是纯函数**——`transform(input, settings)` 不碰 DOM，可进 Worker、可单测。
3. **设置由 schema 声明**——右侧面板通用渲染，工具永不自己画表单；配置是工具级全局、跨重启保留。

### 新增一个工具

```
src/tools/my-tool/
  texts.ts       # 名称 / 描述 / 搜索关键词（含拼音首字母）
  transform.ts   # 纯函数 + 默认值 + settingsSchema
  impl.ts        # 组装 ToolImpl（可选：sample / language / Component 覆盖布局）
  index.ts       # defineTool(元信息, implLoaders["my-tool"])
```

然后在 `src/tools/loaders.ts` 与 `src/tools/index.ts` 各加一行。界面自动获得：左侧导航入口、命令面板直达、输入→输出布局模板、复制/粘贴/清空、大文本自动切 Worker、设置持久化。异形工具（如正则测试器）提供 `Component` 整体覆盖布局（ADR-0003）。

## 文档

- [docs/DESIGN.md](docs/DESIGN.md) — 完整设计方案（技术选型、性能预算、里程碑）
- [CONTEXT.md](CONTEXT.md) — 领域术语表
- [docs/adr/](docs/adr/) — 架构决策记录（壳层选型、扩展模型、布局模板）

## 发布

CI / 自动更新 / 签名的完整说明见 [docs/RELEASE.md](docs/RELEASE.md)。摘要：

- `pnpm tauri dev` 启动桌面窗口（Rust 侧含原生菜单：⌘W = 关闭标签页）；
- 打 `v*` tag 触发 GitHub Actions 双端构建（macOS Apple Silicon/Intel + Windows NSIS），
  产物以 Draft Release 挂载并附带 updater 的 `latest.json`；
- updater 签名密钥在 `~/.tauri/devtools-app.key`（仓库外，绝不入库）；发布前需把
  `tauri.conf.json` 里的 `YOUR_GITHUB_ACCOUNT` 替换为实际仓库路径，并在 CI secrets 配置私钥。

## 待办（v0.1 之后）

- [ ] 创建 GitHub 仓库、配置 secrets、替换 updater 端点（见 docs/RELEASE.md 前置三步）
- [ ] Windows 侧真机/CI 出包冒烟（WebView2 渲染、Ctrl+W、安装器）
- [ ] 前端自动更新检查 UI（插件与签名已接线，`tauri-plugin-updater` 24h 静默检查）
- [ ] 体验迭代：Tab 拖拽排序、主题跟随系统、错误行号点击跳转、命令面板命中高亮
- [ ] 评估 Apple 公证（$99/年）与 Windows 证书
