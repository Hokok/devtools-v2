import { Download, RotateCcw, X } from "lucide-react";
import { useUpdater } from "../platform/stores/updater";

/**
 * 更新提示条：右下角浮动卡片，仅在有更新时出现。
 * 三态——available（可装）、downloading（进度）、restart-ready（重启生效）。
 * 静默检查发现的新版本走这里；全局设置里的手动检查同样驱动这个状态机。
 */
export function UpdateBanner() {
  const status = useUpdater((s) => s.status);
  const nextVersion = useUpdater((s) => s.nextVersion);
  const notes = useUpdater((s) => s.notes);
  const progress = useUpdater((s) => s.progress);
  const errorMessage = useUpdater((s) => s.errorMessage);
  const startInstall = useUpdater((s) => s.startInstall);
  const restart = useUpdater((s) => s.restart);
  const dismiss = useUpdater((s) => s.dismiss);

  const active = status === "available" || status === "downloading" || status === "restart-ready";
  if (!active) return null;

  const percent = progress.total > 0 ? Math.floor((progress.loaded / progress.total) * 100) : -1;

  return (
    <div
      role="status"
      aria-label="应用更新"
      className="card fixed right-4 bottom-10 z-50 w-[300px] rounded-2xl p-4 shadow-[var(--shadow-dialog)]"
      style={{ animation: "palette-pop 150ms ease-out" }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">新版本 v{nextVersion}</h3>
        {status === "available" && (
          <button className="icon-btn -mt-0.5 h-6 w-6" aria-label="暂不提醒" onClick={dismiss}>
            <X size={13} />
          </button>
        )}
      </div>

      {notes ? (
        <p className="mt-1 line-clamp-3 text-2xs leading-4 whitespace-pre-line text-muted">{notes}</p>
      ) : null}

      {status === "available" && <Actions onInstall={() => void startInstall()} />}

      {status === "downloading" && (
        <div className="mt-3">
          <div
            role="progressbar"
            aria-label="下载进度"
            aria-valuenow={Math.max(percent, 0)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-full bg-raise"
          >
            {percent >= 0 ? (
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
            ) : (
              <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-accent" />
            )}
          </div>
          <p className="mt-1.5 text-2xs text-faint">
            {percent >= 0
              ? `正在下载 ${percent}%…`
              : `正在下载 ${(progress.loaded / 1024 / 1024).toFixed(1)} MB…`}
          </p>
        </div>
      )}

      {status === "restart-ready" && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-2xs leading-4 text-faint">下载完成，重启后即更新到新版本。</p>
          <button className="btn btn-primary shrink-0" onClick={() => void restart()}>
            <RotateCcw size={12} />
            重启应用
          </button>
        </div>
      )}

      {errorMessage && <p className="mt-2 text-2xs leading-4 text-danger">{errorMessage}</p>}

      <style>{`@keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
}

function Actions({ onInstall }: { onInstall: () => void }) {
  return (
    <button className="btn btn-primary mt-3 w-full" onClick={onInstall}>
      <Download size={12} />
      立即更新
    </button>
  );
}
