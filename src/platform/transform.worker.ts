import { implLoaders } from "../tools/loaders";
import type { TransformResult } from "./types";

/// <reference lib="webworker" />
const ctx = self as unknown as Worker;

// 只引用 loaders 映射（纯转换逻辑），不经过 registry——避免 react/lucide 进入 worker 包
ctx.onmessage = async (e: MessageEvent<{ id: number; toolId: string; input: string; settings: Record<string, string | number | boolean> }>) => {
  const { id, toolId, input, settings } = e.data;
  const load = implLoaders[toolId];
  if (!load) {
    ctx.postMessage({ id, result: { error: { message: `未知工具: ${toolId}` } } } satisfies {
      id: number;
      result: TransformResult;
    });
    return;
  }
  try {
    const tool = await load();
    if (!tool.transform) {
      ctx.postMessage({ id, result: {} });
      return;
    }
    const result = await tool.transform(input, settings);
    ctx.postMessage({ id, result });
  } catch (err) {
    ctx.postMessage({
      id,
      result: { error: { message: err instanceof Error ? err.message : String(err) } },
    });
  }
};
