// Rust 侧刻意最小化（DESIGN §1）：只装配官方插件与原生菜单。
// 自定义命令按需再写——工具逻辑全部在前端完成。
//
// 菜单的关键决策：不使用默认菜单里的 Close Window（⌘W），而是自定义
// "关闭标签页" ⌘W 菜单项并向前端发事件——否则按 Chrome 心智按 ⌘W
// 会把整个窗口关掉，叠加"会话不持久化"即丢失全部输入。
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let close_tab = MenuItemBuilder::with_id("close-active-tab", "关闭标签页")
                .accelerator("CmdOrCtrl+W")
                .build(app)?;
            let edit_menu = SubmenuBuilder::new(app, "编辑")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let window_menu = SubmenuBuilder::new(app, "窗口")
                .minimize()
                .fullscreen()
                .separator()
                .item(&close_tab)
                .build()?;

            let mut menu = MenuBuilder::new(app);
            // macOS 必须有应用子菜单，⌘Q/隐藏等系统角色才可用
            #[cfg(target_os = "macos")]
            {
                let prefs = MenuItemBuilder::with_id("open-global-settings", "设置…")
                    .accelerator("CmdOrCtrl+,")
                    .build(app)?;
                let app_menu = SubmenuBuilder::new(app, "DevTools")
                    .about(None)
                    .separator()
                    .item(&prefs)
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;
                menu = menu.item(&app_menu);
            }
            app.set_menu(menu.item(&edit_menu).item(&window_menu).build()?)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().0 == "close-active-tab" {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.emit("close-active-tab", ());
                }
            }
            if event.id().0 == "open-global-settings" {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.emit("open-global-settings", ());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
