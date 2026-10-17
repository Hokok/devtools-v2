import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DependencyList } from "react";
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
    const timer = setTimeout(() => {
      const t0 = performance.now(); // 计时从真正开始跑 transform 起算，不含防抖等待
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

/**
 * 防抖计算任意纯函数（异形工具的实时重计算用，如 JSON 比对/提取）。
 * 首帧同步算一次，避免空态闪烁；此后依赖变化只在停顿 delayMs 后才重算，
 * 计算期间返回上一次结果（stale-while-recompute），UI 不闪、不逐键卡顿。
 *
 * 注意：不接受超长输入的病态计算（此处是线性转换，无灾难性回溯风险）；
 * 基准实测 ~800KB JSON diff ≈ 54ms / extract ≈ 16ms，在 DESIGN §5 的 1MB<300ms 预算内。
 */
export function useDebouncedCompute<T>(compute: () => T, deps: DependencyList, delayMs = 180): T {
  const [value, setValue] = useState<T>(compute);
  const computeRef = useRef(compute);
  computeRef.current = compute;

  useEffect(() => {
    const timer = setTimeout(() => setValue(computeRef.current()), delayMs);
    return () => clearTimeout(timer);
    // deps 由调用方提供，即重算的触发条件
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
