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
 *
 * 生命周期约定（修 bug）：
 * - effect 卸载或依赖变化时，必须收回在途请求的定时器与监听，否则过期请求的
 *   2s 定时器会在之后到点，terminate 掉被后续请求复用的 Worker → 假「已中止」；
 * - 组件真正卸载时销毁 Worker，避免 LRU 卸载 Tab 造成 Worker 泄漏。
 */
export function useRegexMatches(pattern: string, flags: string, input: string): RegexState {
  const [state, setState] = useState<RegexState>({ matches: [], error: null, running: false });
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  /** 当前在途请求的收尾函数：清定时器 + 摘监听。effect 重跑/卸载时必然调用。 */
  const settleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
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

      let timer: ReturnType<typeof setTimeout> | undefined;

      // 函数声明（块级提升）——settle 与两个监听互相引用，声明顺序无关
      function settle() {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
        if (settleRef.current === settle) settleRef.current = null;
      }

      function onMessage(e: MessageEvent<{ id: number; matches?: RegexMatch[]; error?: string }>) {
        if (e.data.id !== id) return; // 非本次请求：交给对应请求的 settle 收尾
        settle();
        if (cancelled) return;
        setState({ matches: e.data.matches ?? [], error: e.data.error ?? null, running: false });
      }

      function onError() {
        settle();
        if (cancelled) return;
        workerRef.current?.terminate();
        workerRef.current = null;
        setState({ matches: [], error: "匹配引擎异常，已重置", running: false });
      }

      timer = setTimeout(() => {
        // 病态正则（灾难性回溯）的唯一可靠解法：杀掉 Worker 重建，UI 不卡死
        settle();
        if (cancelled) return;
        workerRef.current?.terminate();
        workerRef.current = null;
        setState({
          matches: [],
          error: `执行超过 ${MATCH_TIMEOUT_MS / 1000}s 已中止——疑似灾难性回溯，请检查量词嵌套`,
          running: false,
        });
      }, MATCH_TIMEOUT_MS);

      settleRef.current = settle;
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.postMessage({ id, pattern, flags, input });
    }, MATCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
      // 收回在途请求：清掉它的 2s 定时器与监听（不销毁 Worker，留给后续请求复用）
      settleRef.current?.();
      settleRef.current = null;
    };
  }, [pattern, flags, input]);

  // 组件卸载才销毁 Worker——LRU 卸载 Tab 时若不清，Worker 会永久泄漏
  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  return state;
}
