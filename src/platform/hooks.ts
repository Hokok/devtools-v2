import { useCallback, useEffect, useMemo, useState } from "react";
import { getTool } from "./registry";
import { runTransform } from "./transformRunner";
import { useSettings } from "./stores/settings";
import type { LoadedTool, ToolSettings, TransformResult } from "./types";

/**
 * 懒加载工具实现体（注册表内缓存 Promise，多 Tab 共享一次加载）。
 * 失败可重试：动态 import 失败不能让 Tab 永远停在加载态。
 */
export function useLoadedTool(toolId: string | null): {
  tool: LoadedTool | undefined;
  error: string | null;
  retry: () => void;
} {
  const [state, setState] = useState<{ tool?: LoadedTool; error?: string }>({});
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!toolId) return;
    let alive = true;
    setState({});
    const reg = getTool(toolId);
    if (!reg) return;
    reg.load()
      .then((t) => {
        if (alive) setState({ tool: t });
      })
      .catch((err: unknown) => {
        if (alive) setState({ error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      alive = false;
    };
  }, [toolId, nonce]);

  return {
    tool: state.tool,
    error: state.error ?? null,
    retry: useCallback(() => setNonce((n) => n + 1), []),
  };
}

/** 工具级全局配置：默认值 + 持久化覆盖合并，update 走防抖落盘。 */
export function useToolSettings(tool: LoadedTool | undefined): {
  settings: ToolSettings;
  update: (patch: ToolSettings) => void;
  reset: () => void;
} {
  const override = useSettings((s) => (tool ? s.byTool[tool.id] : undefined));
  const storeUpdate = useSettings((s) => s.update);
  const storeReset = useSettings((s) => s.reset);

  const settings = useMemo<ToolSettings>(
    () => ({ ...tool?.defaultSettings, ...override }),
    [tool, override],
  );

  const update = useCallback(
    (patch: ToolSettings) => {
      if (tool) storeUpdate(tool.id, patch);
    },
    [tool, storeUpdate],
  );
  const reset = useCallback(() => {
    if (tool) storeReset(tool.id);
  }, [tool, storeReset]);

  return { settings, update, reset };
}

/**
 * 防抖执行 transform（错误同时覆盖「返回 error」与「抛异常」两种形态）。
 * 耗时展示在输出区头部——性能是工具的可见品质。
 * refreshKey：外部驱动的重算信号（时间戳工具空输入时每秒 +1 实现"实时"）。
 */
export function useToolTransform(
  tool: LoadedTool | undefined,
  input: string,
  settings: ToolSettings,
  refreshKey = 0,
): { result: TransformResult; elapsed: number; running: boolean } {
  const [state, setState] = useState<{
    result: TransformResult;
    elapsed: number;
    running: boolean;
  }>({ result: {}, elapsed: 0, running: false });

  useEffect(() => {
    if (!tool?.transform) {
      setState({ result: {}, elapsed: 0, running: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, running: true }));
    const t0 = performance.now();
    const timer = setTimeout(() => {
      runTransform(tool, input, settings)
        .then((result) => {
          if (!cancelled) setState({ result, elapsed: performance.now() - t0, running: false });
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setState({
              result: { error: { message: err instanceof Error ? err.message : String(err) } },
              elapsed: performance.now() - t0,
              running: false,
            });
          }
        });
    }, input.length > 64 * 1024 ? 350 : 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tool, input, settings, refreshKey]);

  return state;
}
