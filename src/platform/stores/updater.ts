import { create } from "zustand";

/**
 * 应用更新状态机：启动静默检查 + 全局设置手动检查共用一套状态。
 * Update 对象不可序列化，只留在模块闭包里；store 只放可渲染的状态。
 * 非 Tauri 环境（浏览器/测试）全流程无副作用。
 */
export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "restart-ready"
  | "up-to-date"
  | "error";

interface UpdaterState {
  status: UpdateStatus;
  currentVersion: string;
  /** 发现的新版本号（available 之后才有意义） */
  nextVersion: string;
  /** 新版 release notes（latest.json 的 body） */
  notes: string;
  /** 下载进度：已收字节 / 总字节（total 为 0 表示拿不到长度，走转圈而非百分比） */
  progress: { loaded: number; total: number };
  errorMessage: string;
  /** 本次会话被用户关掉的更新提示条对应版本（不跨重启，重启后还会提醒） */
  dismissedVersion: string | null;
  /** silent：启动静默检查，无更新/出错都不惊动用户 */
  check: (options?: { silent?: boolean }) => Promise<void>;
  /** 下载并安装（不重启），完成后进入 restart-ready，由用户点"重启应用"落实 */
  startInstall: () => Promise<void>;
  restart: () => Promise<void>;
  dismiss: () => void;
}

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type UpdateObject = {
  version: string;
  currentVersion: string;
  body: string;
  downloadAndInstall: (
    onProgress?: (event: { event: string; data: unknown }) => void,
  ) => Promise<void>;
};

/** 当前已发现的可用更新，安装阶段持有（restart-ready 后仍需对象存在才能重启，只是插件要求） */
let pendingUpdate: UpdateObject | null = null;
/** 防抖：静默检查和手动检查并发时，后到的让位于先到的 */
let checking = false;

export const useUpdater = create<UpdaterState>((set, get) => ({
  status: "idle",
  currentVersion: "",
  nextVersion: "",
  notes: "",
  progress: { loaded: 0, total: 0 },
  errorMessage: "",
  dismissedVersion: null,

  async check({ silent = false } = {}) {
    if (!isTauri || checking) return;
    checking = true;
    if (!silent) set({ status: "checking", errorMessage: "" });
    try {
      const [{ check }, { getVersion }] = await Promise.all([
        import("@tauri-apps/plugin-updater"),
        import("@tauri-apps/api/app"),
      ]);
      const currentVersion = await getVersion();
      const update = (await check()) as UpdateObject | null;
      if (!update) {
        pendingUpdate = null;
        // 静默检查无更新不打扰用户；手动检查给出"已是最新"的明确反馈
        set({ status: silent ? "idle" : "up-to-date", currentVersion, nextVersion: "", notes: "" });
        return;
      }
      const dismissed = get().dismissedVersion === update.version;
      pendingUpdate = update;
      set({
        status: dismissed ? "idle" : "available",
        currentVersion,
        nextVersion: update.version,
        notes: update.body ?? "",
      });
    } catch (error) {
      pendingUpdate = null;
      // 静默检查失败保持安静（多半是断网）；手动检查要告诉用户为什么
      set({
        status: silent ? "idle" : "error",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } finally {
      checking = false;
    }
  },

  async startInstall() {
    const update = pendingUpdate;
    if (!update || get().status === "downloading") return;
    set({ status: "downloading", progress: { loaded: 0, total: 0 }, errorMessage: "" });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "started") {
          const total = Number((event.data as { contentLength?: number }).contentLength ?? 0);
          set({ progress: { loaded: 0, total } });
        } else if (event.event === "progress") {
          const chunk = Number((event.data as { chunkLength?: number }).chunkLength ?? 0);
          const { loaded, total } = get().progress;
          set({ progress: { loaded: loaded + chunk, total } });
        }
      });
      set({ status: "restart-ready" });
    } catch (error) {
      set({
        status: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async restart() {
    if (!isTauri) return;
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  },

  // 本次会话不再弹提示条；全局设置里的手动检查不受 dismiss 影响
  dismiss() {
    set({ status: "idle", dismissedVersion: get().nextVersion });
  },
}));

/** 手动检查入口：全局设置页调用（clearDismiss 让重新检查能看到之前忽略的版本） */
export async function checkForUpdateManually(): Promise<void> {
  useUpdater.setState({ dismissedVersion: null });
  await useUpdater.getState().check({ silent: false });
}
