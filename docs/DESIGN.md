# DevTools 设计方案

> 面向开发者日常使用的桌面工具合集。定位：个人开源项目，主打便利性，支持 Win / Mac，低内存占用。
> 术语见 [CONTEXT.md](../CONTEXT.md)，关键决策记录见 [docs/adr/](./adr/)。

## 1. 技术栈总览

| 层 | 选型 | 理由 |
|---|---|---|
| 桌面壳 | Tauri 2（Rust） | 系统 WebView，空载内存 ~60-120MB，安装包 ~5-10MB（ADR-0001） |
| 前端 | React 19 + TypeScript（strict） | 编辑器/组件生态最好，Tab 保活用"隐藏而非卸载"实现 |
| 构建 | Vite + pnpm | Tauri 官方推荐链路，HMR 快 |
| 编辑器 | CodeMirror 6（按需语言包） | 单实例体积 ~200KB 级，多 Tab 多编辑器内存可控 |
| UI 组件 | Tailwind CSS 4 + Radix UI（无头）+ lucide-react 图标 | 无头组件自己掌管样式，保证"简洁大气"的可控性 |
| 状态 | Zustand | 轻量（~1KB），Tab/设置这类全局状态不需要 Redux 的仪式感 |
| 持久化 | tauri-plugin-store（JSON 落盘应用配置目录） | 只存工具配置与应用偏好，不需要 SQLite |
| 自动更新 | tauri-plugin-updater + GitHub Releases | 更新公钥编进安装包，tag 触发 CI 发布 |
| 测试 | Vitest（转换逻辑纯函数单测） | 工具的核心价值在转换正确性，优先保这块 |

进程模型：单窗口单 WebView。Rust 侧职责刻意最小化——窗口管理、store、updater、剪贴板，全部走官方插件，MVP 阶段不写任何自定义 Rust 命令。所有工具逻辑是纯前端计算，这是内存与复杂度都能压住的根基。

## 2. 整体架构

```
┌────────────────────────────────────────────────────────────┐
│ WebView（前端，所有工具逻辑在这里）                            │
│                                                            │
│  app/                  platform/              tools/       │
│  ┌──────────┐   ┌─────────────────────┐   ┌────────────┐  │
│  │Workbench │──▶│ Registry(元信息)     │◀──│ json/      │  │
│  │ ├Nav     │   │ TabStore(Zustand)   │   │ base64/ …  │  │
│  │ ├TabBar  │   │ SettingsStore       │   │ 每个工具：   │  │
│  │ ├Panel   │   │ LayoutTemplate      │   │ index.ts   │  │
│  │ └Palette │   └─────────────────────┘   │ transform  │  │
│  └──────────┘   ┌─────────────────────┐   └────────────┘  │
│                 │ CodeMirror 封装      │   （动态 import()  │
│                 └─────────────────────┘     懒加载）        │
└──────────────┬─────────────────────────────────────────────┘
               │ IPC（仅 4 类官方插件）
┌──────────────┴─────────────────────────────────────────────┐
│ Tauri（Rust）：窗口 / store(JSON落盘) / updater / 剪贴板      │
└────────────────────────────────────────────────────────────┘
```

三条铁律：

1. **Registry 只含元信息**。`tools/index.ts` 里每个工具以 `() => import('./xxx')` 的形式登记，实现体绝不进入主包（ADR-0002 的 Consequences）。
2. **转换逻辑是纯函数**。`transform(input, settings) => output` 不碰 DOM、不碰 store，可被 Worker 调用、可被单测覆盖。
3. **设置由 schema 声明**。右侧设置面板是通用渲染器，工具只声明 schema，不自己画表单。

## 3. 界面设计（Workbench）

```
┌───┬──────────────────────────────────┬─────────────┐
│ N │ [JSON-1 ×] [JSON-2 ×] [Base64 ×] │ 设置面板 (⌘,)│◀ 默认收起
│ A │──────────────────────────────────│ ┌─────────┐ │
│ V │                                  │ │ 缩进 2/4 │ │
│   │        激活 Tab 的工具界面        │ │ 去转义 ○ │ │
│ 🔍│     （Input → Output 模板）       │ │ 排序   ▾ │ │
│   │                                  │ └─────────┘ │
│   │                                  │  仅当前工具  │
└───┴──────────────────────────────────┴─────────────┘
  ▲ 可收缩至图标栏（48px），悬停/点击展开
```

- **左侧导航**：按工具分组（编码/转换/文本/生成器…），底部 🔍（等于 `Cmd/Ctrl+K`）与 ⚙（全局设置，`Cmd/Ctrl+,`）两个按钮。收缩后只留图标，tooltip 显示名称；收缩状态持久化。
- **中间工作区**：Chrome 式 Tab 栏（可中键关闭、拖拽排序、溢出滚动）。激活切换通过 `display:none` 实现，**DOM 不卸载、状态在 store**，切换零刷新。
- **右侧设置面板**：抽屉式，默认收起；展示**当前激活 Tab 所属工具**的 schema 渲染出的表单。配置是工具级全局的（ADR 见 §5.3）。
- **命令面板**：`Cmd/Ctrl+K`，对 Registry 元信息（名称 + keywords）做模糊搜索（fuzzysort，~10KB），回车即在新 Tab 打开工具；同类检索也能直达全局命令（打开设置、切换主题/布局）。这是 MVP 唯一的"便利性魔法入口"，不做托盘和全局快捷键。
- **全局设置**：独立模态弹窗（侧栏 ⚙ 或 `Cmd/Ctrl+,`；macOS 应用菜单「设置…」同效），与工具级设置面板语义分离。v1 两项：**外观模式**（深色/浅色/跟随系统，跟随系统时实时响应系统变化；侧栏日/月按钮保留为深浅快捷切换）与**布局方向**（上下分栏/左右分栏，全局统一管所有模板型工具，比例仍按工具记忆；异形工具不受影响）。
- **视觉**：暗色/浅色 GitHub Primer 配色体系，默认跟随系统；主色单色克制，信息密度靠 8px 网格和留白撑起来。文案纯中文硬编码（已决策），集中在各工具自己的目录里。

**Tab 行为细则**（资深经验填坑）：从导航/命令面板打开工具时，若已存在该工具的 Tab 且其输入为空，则聚焦它而不是新开——避免手滑产生一堆空 Tab；否则新开。Tab 数量上限 20，超出时 LRU 卸载最久未激活 Tab 的组件实例（输入内容保留在 store，切回时重建，用户无感）。会话不持久化（已决策）：关闭应用即清空。

## 4. 工具系统（核心扩展点）

### 4.1 ToolDefinition 契约

```ts
// platform/types.ts
interface ToolDefinition<S = Record<string, unknown>> {
  id: string;                    // "json-formatter"，全局唯一
  name: string;                  // 显示名"JSON 格式化"
  icon: LucideIcon;
  group: ToolGroupId;            // 'encode' | 'convert' | 'text' | 'generate' | 'format'
  keywords?: string[];           // 命令面板补充搜索词，如 ["json", "美化", "压缩"]

  // —— 模板型工具（80% 场景）：只填这两个 ——
  defaultSettings: S;
  settingsSchema?: SettingsSchema<S>;   // 声明式，右侧面板自动渲染
  transform: (input: string, s: S) => TransformResult;  // 纯函数

  // —— 异形工具（正则/取色器等）：整体覆盖布局 ——
  layout?: () => Promise<ComponentType>;   // 懒加载的自定义布局
}

interface TransformResult {
  output?: string;
  error?: { message: string; line?: number };  // 错误就地显示，不弹窗
}
```

SettingsSchema 节点只支持五种字段：`toggle / select / number / text / divider`，带 `visibleWhen` 条件显示。刻意不做成"随便渲染任意 React"——设置面板的可预测性比表达力重要。

### 4.2 注册表与懒加载

```ts
// tools/index.ts —— 全应用唯一的登记处
export const registry = [
  defineTool(() => import('./json-formatter')),
  defineTool(() => import('./base64')),
  // …新增工具 = 加一行 + 建一个目录
];
```

`defineTool` 接收懒加载器，启动时只解析元信息；首次打开该工具的 Tab 时才 `import()` 实现体。布局模板由平台提供，模板型工具的实现体里连 UI 都不用写。

### 4.3 工具目录结构

```
src/tools/json-formatter/
  index.ts        # ToolDefinition（元信息 + schema + 懒加载入口）
  transform.ts    # 纯函数：格式化/压缩/校验，可单测
  texts.ts        # 该工具的全部文案（中文硬编码集中于此）
  ui.tsx          # 仅异形工具需要
```

### 4.4 设置持久化

键 `settings.{toolId}` 存入 tauri-plugin-store（应用配置目录单文件 JSON，写入防抖 500ms）。工具级全局配置、跨重启保留、所有 Tab 共享——Tab 的输入内容则是纯内存会话态（已决策的组合）。

应用级偏好同样落 tauri-plugin-store：`ui.themeMode`（`dark`/`light`/`system`，由旧键 `ui.theme` 自动迁移；并镜像一份到 localStorage 供 index.html 首帧防闪脚本读取）、`ui.layoutDirection`（`vertical`/`horizontal`）、`ui.navCollapsed`、`ui.settingsOpen`、`ui.splitRatios`。

## 5. 性能设计

| 指标 | 预算 | 手段 |
|---|---|---|
| 冷启动到可交互 | < 1s | 主包只含 Workbench 骨架 + Registry 元信息（<300KB gzip） |
| 空载内存 | < 120MB | Tauri 壳层保证；无后台常驻任务 |
| 开 10 个 Tab 内存 | < 250MB | CodeMirror 按需语言包；LRU 卸载 Tab 组件（上限 20） |
| 大文本不卡 UI | 1MB 输入 < 300ms | 输入 >256KB 自动切 Web Worker；防抖 200ms 才触发 transform |
| 切 Tab | 0 刷新 | display:none 保活，状态在 Zustand |

其余：updater 每 24h 静默检查一次；图标走 lucide tree-shake；字体用系统字体栈（省掉字体文件加载，也是"简洁大气"的正解）。

## 6. 工程化与发布

- **仓库布局**：单体（`src/` + `src-tauri/`），目录按可拆包的边界组织，工具数 >30 或多人协作时再演进 monorepo（ADR-0002）。
- **代码质量**：TS strict + eslint + prettier；transform 一律纯函数并强制 Vitest 单测（错误分支也要测）。
- **CI/CD**：GitHub Actions，matrix 构建 `macos-latest`（aarch64 + x86_64）与 `windows-latest`（NSIS 安装包）；打 tag（`v*`）触发构建、生成 updater 的 `latest.json`、发布到 GitHub Releases。个人项目先不做签名（接受 Mac 右键打开 / Win SmartScreen 提示），README 写明。
- **里程碑**（业余时间预估）：
  1. **M1（~1 周）**：Tauri + React 骨架，三栏 Workbench + Tab 系统 + Registry 懒加载，用 JSON 格式化打通全链路。
  2. **M2（~1 周）**：设置面板（schema 渲染 + store 持久化）+ 命令面板 + 左栏收缩。
  3. **M3（~2 周）**：其余 7 个工具（base64、URL 编解码、时间戳、UUID、哈希、JWT 解析、正则测试器——最后一个顺带验证"异形布局逃逸"）。
  4. **M4（~1 周）**：CI 发布链路、updater、双端冒烟、README，发 v0.1。

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| WebView2 / WKWebView 渲染差异（滚动条、字体） | 全部用系统字体栈；CI 产物在双端各做一轮冒烟清单 |
| macOS 未签名被 Gatekeeper 拦 | README 指引"右键→打开"；口碑起来后再考虑 $99/年 证书 |
| 中文输入法在 CodeMirror 的兼容问题 | CM6 对 IME 支持良好，但 JSON 工具要专门做输入法冒烟 |
| 文案硬编码的国际化返工成本 | 已知悉并接受（用户决策）；缓解：文案强制集中在各工具 texts.ts，未来可机器化提取 |
| GitHub Releases 国内访问不稳 | README 提供镜像说明；updater 失败静默降级 |
