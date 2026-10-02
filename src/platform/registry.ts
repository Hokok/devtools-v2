import type { LoadedTool, RegisteredTool, ToolImpl, ToolMeta } from "./types";

/**
 * 全应用唯一的工具登记处（ADR-0002）。
 *
 * 铁律：registry 只含元信息 + 懒加载器。工具实现必须经 load() 的
 * 动态 import 进入内存——禁止在这里静态 import 任何工具实现，
 * 否则懒加载失效、主包体积与内存双双失控。
 */

const promises = new Map<string, Promise<LoadedTool>>();

export function defineTool(meta: ToolMeta, load: () => Promise<ToolImpl>): RegisteredTool {
  return {
    meta,
    load() {
      let p = promises.get(meta.id);
      if (!p) {
        p = load().then((impl) => Object.freeze({ ...meta, ...impl }) as LoadedTool);
        promises.set(meta.id, p);
      }
      return p;
    },
  };
}

export const registry: RegisteredTool[] = [];

/** registry 数组在 tools/index.ts 里装配完成后再调用 */
export function registerAll(tools: RegisteredTool[]) {
  registry.push(...tools);
}

export function getTool(id: string): RegisteredTool | undefined {
  return registry.find((t) => t.meta.id === id);
}
