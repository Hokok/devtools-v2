# 采用 Tauri 2 作为桌面壳层

产品硬性要求"低内存占用 + 支持 Win/Mac"。对比 Electron（自带 Chromium，空载 200-400MB、安装包 80-150MB）与 Flutter Desktop（文本编辑类组件生态弱），选择 Tauri 2：复用系统 WebView（Win: WebView2, Mac: WKWebView），空载内存约 60-120MB、安装包 5-10MB。接受的代价：双端 WebView 存在细微渲染差异（工具类应用可容忍），少量原生能力需用 Rust 编写。

## Considered Options

- Electron + Web：生态最成熟、双端渲染完全一致，但内存与包体积与产品目标正面冲突。
- Flutter Desktop：自绘引擎性能好，但代码编辑器/高亮/Diff 等开发者工具核心组件生态薄弱。
- 原生双端（WinUI3 + SwiftUI）：体验最佳，但每个工具要写两遍，维护成本不可持续。
