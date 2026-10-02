import type { LoadedTool, ToolSettings, TransformResult } from "./types";

/**
 * 转换执行器。小输入主线程同步跑（零开销）；超过阈值的输入自动切
 * Web Worker。Worker 通道有完整的故障治理：
 * - 单次请求 10s 超时 → terminate 并向用户报错（不回退同步，避免冻结 UI）
 * - 脚本初始化/运行失败 → 本请求回退主线程同步执行
 * - 连续失败 3 次后会话内禁用 Worker，全部走主线程
 */

const WORKER_THRESHOLD = 256 * 1024;
const WORKER_TIMEOUT_MS = 10_000;
const MAX_WORKER_FAILURES = 3;

/** worker 基础设施故障的哨兵值：区别于 transform 自身返回的错误 */
const WORKER_DOWN = "\u0000WORKER_DOWN";

let worker: Worker | null = null;
let workerFailures = 0;
let nextRequestId = 0;
const pending = new Map<
  number,
  { resolve: (result: TransformResult) => void; timer: ReturnType<typeof setTimeout> }
>();

function failAllPending(message: string) {
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
    entry.resolve({ error: { message } });
  }
  pending.clear();
}

function retireWorker() {
  worker?.terminate();
  worker = null;
  workerFailures += 1;
}

function getWorker(): Worker | null {
  if (worker) return worker;
  if (workerFailures >= MAX_WORKER_FAILURES) return null;
  try {
    worker = new Worker(new URL("./transform.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; result: TransformResult }>) => {
      const { id, result } = e.data;
      const entry = pending.get(id);
      if (entry) {
        pending.delete(id);
        clearTimeout(entry.timer);
        entry.resolve(result);
      }
    };
    worker.onerror = () => {
      retireWorker();
      failAllPending(WORKER_DOWN);
    };
  } catch {
    worker = null;
    workerFailures = MAX_WORKER_FAILURES;
  }
  return worker;
}

function runInWorker(
  toolId: string,
  input: string,
  settings: ToolSettings,
): Promise<TransformResult> {
  const w = getWorker();
  if (!w) return Promise.resolve({ error: { message: WORKER_DOWN } });
  const id = ++nextRequestId;
  return new Promise<TransformResult>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      retireWorker();
      resolve({
        error: { message: "转换超过 10s 已中止——输入可能触发了病态计算" },
      });
    }, WORKER_TIMEOUT_MS);
    pending.set(id, { resolve, timer });
    w?.postMessage({ id, toolId, input, settings });
  });
}

export async function runTransform(
  tool: LoadedTool,
  input: string,
  settings: ToolSettings,
): Promise<TransformResult> {
  if (!tool.transform) return {};
  if (input.length > WORKER_THRESHOLD && workerFailures < MAX_WORKER_FAILURES) {
    const result = await runInWorker(tool.id, input, settings);
    // 基础设施故障才回退主线程；超时是真错误，绝不能在主线程重试（会冻结 UI）
    if (result.error?.message !== WORKER_DOWN) return result;
  }
  return await tool.transform(input, settings);
}
