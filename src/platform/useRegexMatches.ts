import { useEffect, useRef, useState } from "react";
import type { RegexMatch } from "./regexTypes";

const MATCH_DEBOUNCE_MS = 250;
const MATCH_TIMEOUT_MS = 2000;

interface RegexState {
  matches: RegexMatch[];
  error: string | null;
  running: boolean;
}

/**
 * 正则匹配的执行通道：worker 内跑 matchAll，超时即 terminate 并重建。
 * 每个 hook 实例持有独立 Worker，请求按自增 id 过滤过期结果。
 */
export function useRegexMatches(pattern: string, flags: string, input: string): RegexState {
  const [state, setState] = useState<RegexState>({ matches: [], error: null, running: false });
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const debounce = setTimeout(() => {
      if (!pattern) {
        setState({ matches: [], error: null, running: false });
        return;
      }
      setState((s) => ({ ...s, running: true }));
      const id = ++idRef.current;
      const worker = (workerRef.current ??= new Worker(new URL("./regex.worker.ts", import.meta.url), {
        type: "module",
      }));

      const cleanup = () => {
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
      };
      const onMessage = (e: MessageEvent<{ id: number; matches?: RegexMatch[]; error?: string }>) => {
        if (e.data.id !== id || !alive) return;
        cleanup();
        setState({ matches: e.data.matches ?? [], error: e.data.error ?? null, running: false });
      };
      const onError = () => {
        if (!alive) return;
        cleanup();
        workerRef.current?.terminate();
        workerRef.current = null;
        setState({ matches: [], error: "匹配引擎异常，已重置", running: false });
      };
      const timer = setTimeout(() => {
        // 病态正则（灾难性回溯）的唯一可靠解法：杀掉 Worker 重建，UI 不卡死
        cleanup();
        workerRef.current?.terminate();
        workerRef.current = null;
        setState({
          matches: [],
          error: `执行超过 ${MATCH_TIMEOUT_MS / 1000}s 已中止——疑似灾难性回溯，请检查量词嵌套`,
          running: false,
        });
      }, MATCH_TIMEOUT_MS);

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.postMessage({ id, pattern, flags, input });
    }, MATCH_DEBOUNCE_MS);

    return () => {
      alive = false;
      clearTimeout(debounce);
    };
  }, [pattern, flags, input]);

  return state;
}
