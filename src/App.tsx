import { useEffect } from "react";
import { Command } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SideNav } from "./components/SideNav";
import { TabBar } from "./components/TabBar";
import { ToolHost } from "./components/ToolHost";
import { SettingsPanel } from "./components/SettingsPanel";
import { CommandPalette } from "./components/CommandPalette";
import { GlobalSettingsDialog } from "./components/GlobalSettingsDialog";
import { useSettings } from "./platform/stores/settings";
import { useTabs } from "./platform/stores/tabs";
import { useUi } from "./platform/stores/ui";
import { getTool } from "./platform/registry";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export default function App() {
  useAppBootstrap();
  useGlobalShortcuts();
  useWindowLifecycle();
  useResizeFreeze();

  return (
    <div className="relative z-10 flex h-full">
      <SideNav />
      <main className="flex min-w-0 flex-1 flex-col">
        <TabBar />
        <ToolHost />
        <StatusBar />
      </main>
      <SettingsPanel />
      <CommandPalette />
      <GlobalSettingsDialog />
      <ConfirmExitDialog />
    </div>
  );
}

/** 启动水合：设置与外观的持久化状态必须在任何交互前加载 */
function useAppBootstrap() {
  useEffect(() => {
    void useSettings.getState().hydrate();
    void useUi.getState().hydrate();
  }, []);
}

/** 全局快捷键：⌘K 命令面板 / ⌘, 全局设置（macOS 走原生菜单）/ Ctrl+W 关 Tab（macOS 走原生菜单）/ Ctrl+Tab 切换 / ⌘1-9 直达 / Esc 收设置面板 */
function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 中文输入法组合期间不拦截任何按键
      if (e.isComposing || e.keyCode === 229) return;

      const mod = e.metaKey || e.ctrlKey;
      const tabs = useTabs.getState();
      const ui = useUi.getState();

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.setPaletteOpen(!ui.paletteOpen);
        return;
      }
      if (mod && e.key === ",") {
        // macOS 桌面端由原生菜单「设置…」处理（发 open-global-settings 事件），避免双触发
        if (isMac && isTauri) return;
        e.preventDefault();
        ui.setGlobalSettingsOpen(true);
        return;
      }
      // 命令面板打开时，其余快捷键交给面板自己处理
      if (ui.paletteOpen) return;

      if (mod && e.key.toLowerCase() === "w") {
        // macOS 的 ⌘W 由原生菜单项处理（发 close-active-tab 事件），避免双触发
        if (isMac) return;
        e.preventDefault();
        if (tabs.activeId) tabs.closeTab(tabs.activeId);
        return;
      }
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        tabs.cycleTab(e.shiftKey ? -1 : 1);
        return;
      }
      if (mod && /^[1-9]$/.test(e.key)) {
        const target = tabs.tabs[Number(e.key) - 1];
        if (target) {
          e.preventDefault();
          tabs.activate(target.id);
        }
        return;
      }
      if (e.key === "Escape" && ui.settingsOpen) {
        ui.toggleSettings();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** 桌面窗口生命周期：监听原生菜单的"关闭标签页"、关闭窗口前确认有内容的 Tab */
function useWindowLifecycle() {
  useEffect(() => {
    if (!isTauri) return;
    const win = getCurrentWindow();
    const unlisteners: Array<() => void> = [];

    void win.listen<null>("close-active-tab", () => {
      const tabs = useTabs.getState();
      if (tabs.activeId) tabs.closeTab(tabs.activeId);
    }).then((fn) => unlisteners.push(fn));

    void win.listen<null>("open-global-settings", () => {
      useUi.setState({ globalSettingsOpen: true });
    }).then((fn) => unlisteners.push(fn));

    void win.onCloseRequested((event) => {
      // 已决策不持久化会话：有内容时给出最后的安全网
      const hasContent = useTabs.getState().tabs.some((t) => t.input !== "");
      if (hasContent) {
        event.preventDefault();
        useUi.setState({ exitConfirmOpen: true });
      }
    }).then((fn) => unlisteners.push(fn));

    return () => unlisteners.forEach((fn) => fn());
  }, []);
}

/** 拖拽缩放进行中冻结所有过渡/动画：WKWebView 逐帧重排下，过渡只会放大「走位」感 */
function useResizeFreeze() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      document.body.classList.add("resizing");
      clearTimeout(timer);
      timer = setTimeout(() => document.body.classList.remove("resizing"), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
      document.body.classList.remove("resizing");
    };
  }, []);
}

/** 退出确认：非空 Tab 存在时拦截关窗 */
function ConfirmExitDialog() {
  const open = useUi((s) => s.exitConfirmOpen);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] backdrop-blur-[3px]">
      <div className="card w-[360px] max-w-[90vw] rounded-2xl p-5 shadow-[var(--shadow-dialog)]">
        <h2 className="text-base font-semibold text-text">确定退出 DevTools？</h2>
        <p className="mt-2 text-xs leading-5 text-muted">
          有标签页包含未处理完的内容。应用不保存会话，退出后这些内容将丢失。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => useUi.setState({ exitConfirmOpen: false })} className="btn btn-ghost">
            取消
          </button>
          <button onClick={() => void getCurrentWindow().destroy()} className="btn btn-danger">
            放弃内容并退出
          </button>
        </div>
      </div>
    </div>
  );
}

/** 底部状态条：仪器面板的最后一排指示灯。 */
function StatusBar() {
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const activeToolId = tabs.find((t) => t.id === activeId)?.toolId;
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 px-3 text-2xs text-faint">
      <span className="text-accent/70">◆</span>
      <span>{activeToolId ? getTool(activeToolId)?.meta.name : "就绪"}</span>
      <span className="text-line-strong">|</span>
      <span>{tabs.length} 个标签页</span>
      <button
        className="ml-auto flex items-center gap-1.5 transition-colors hover:text-muted"
        onClick={() => setPaletteOpen(true)}
      >
        <Command size={9} />
        <span className="kbd">K</span>
        <span>命令面板</span>
      </button>
    </footer>
  );
}
