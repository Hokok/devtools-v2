# DevTools 性能分析 + Bug 排查方案

> 面向 `devtools-v2`（Tauri 2 + React 19 桌面工具箱）的一次全仓性能/Bug 审阅与整改。
> 分支：`fix/perf-and-bugs`。术语见 [../CONTEXT.md](../CONTEXT.md)，性能预算见 [DESIGN.md](./DESIGN.md) §5。

## 0. 基线（整改前实测）

| 项 | 结果 |
|---|---|
| `pnpm install --frozen-lockfile` | 成功 |
| `pnpm test`（vitest） | 8 files / **66 tests 全通过**，~126ms |
| `pnpm exec tsc --noEmit` | 无错误 |
| 基准：~800KB JSON `diffJson` | **≈54ms** |
| 基准：~800KB JSON `extractJson` | **≈16ms** |

结论：Bug 均不在既有测试覆盖内；diff/extract 单次成本远低于 §5 的「1MB < 300ms」预算，
真正的性能缺陷是**逐键同步重算**（每次编辑都重跑），而非单次耗时。

---

## 1. 正确性 Bug 与修复

| ID | 位置 | 症状 | 修复 |
|---|---|---|---|
| B1 | `src/platform/useRegexMatches.ts` | ① 组件卸载不销毁 Worker（LRU 卸载 Tab → Worker 泄漏，StrictMode 双挂载翻倍）；② 过期请求跳过 `cleanup()`，其 2s 定时器残留并在之后 `terminate` 掉被复用 Worker → 假「执行超过 2s 已中止」 | effect 卸载/依赖变化时统一收回在途请求（清定时器 + 摘监听）；空依赖 effect 里在组件卸载时 `terminate` Worker |
| B2 | `src/tools/json-diff/JsonDiff.tsx` | 右侧内容存在组件局部 `useState`，开满 >20 个 Tab 被 LRU 卸载后**整段 JSON 丢失**，违反 `tabs.ts` 的「卸载不丢」契约 | Tab 增加 `auxInput` 字段与 `setAuxInput`，经 `ToolComponentProps` 注入异形工具 |
| B3 | `src/tools/json-extract/extract.ts`、`src/tools/json-diff/diff.ts` | `key in obj` / 直接属性读取会命中原型链，`constructor`/`toString` 等列名假命中，CSV 输出 `function Object() {…}` 之类垃圾 | 一律改 `Object.prototype.hasOwnProperty`（含 `resolvePath` 的对象分支） |
| B4 | `src/platform/hooks.ts` | `t0` 在防抖 `setTimeout` 之前取，耗时展示至少含 180/350ms 防抖，指标失真 | `t0` 移入定时器回调、`runTransform` 之前 |
| B5 | `src/platform/stores/tabs.ts` | DESIGN 声明的「Tab 上限 20」实际只约束挂载数（`MAX_MOUNTED_TABS`），Tab 数量无硬上限 | **不引入硬上限**（关闭 Tab 属产品决策，且与「会话保活输入」的既有决策冲突）；改为消除其带来的渲染退化（见 P2） |

## 2. 性能问题与修复

| ID | 位置 | 问题 | 修复 |
|---|---|---|---|
| P1 | `JsonDiff.tsx`、`JsonExtract.tsx` | 逐键同步重算 diff/extract，大文本击键卡顿 | 新增 `useDebouncedCompute`（首帧同步一次、此后停顿 180/350ms 才重算、计算期返回上次结果），两处接入 |
| P2 | `tabs.ts` + `ToolHost.tsx` | `shouldMount` 对每个 Tab 都排序整个数组 → 每次渲染 O(N²·logN) | 改为 `mountedTabIds` 一次性算出挂载集合（单次排序），`ToolHost` 用 `useMemo` 只算一次 |
| P3 | `CodeEditor.tsx` | 每次 `value` 变化都 `doc.toString()` 全量拷贝后比较 | 记录「本编辑器最近产出的值」，受控回流时直接短路，击键路径不再拷贝 |
| P4 | `TabBar.tsx` | `instanceNo` 每个 Tab 都 `filter` 一遍 → O(N²) | 按工具预聚合（`useMemo`），序号查表 |
| P5 | `tools/hash/md5.ts` | 每次调用重建 64 项 `S`/`K` 表 | 提到模块级常量 |
| P6 | `platform/format.ts` | `fmtMs` 两个分支返回相同字符串（死代码） | 删除冗余分支 |

### 关于 P1 为何不进 Worker

DESIGN §5 规定 >256KB 走 Worker。接入 Worker 需要异步化异形工具的返回（`DiffResult`/`ExtractResult`），
会牵动 JsonDiff 的同步高亮/清单渲染。基准实测 ~800KB 单次仅 54ms（预算 300ms），
逐键卡顿的根因是「每键都算」而非单次耗时，防抖即可消除。故本轮采用防抖；
若后续出现 >1MB 的实际输入需求，再按 §5 引入 Worker（届时 `diff.ts`/`extract.ts` 已是纯函数，可直接进 Worker）。

## 3. 验证

- 新增回归测试：`tests/tabs.test.ts`（B2 的 `auxInput`、P2 的 `mountedTabIds` 预算与临界值）、
  `tests/json-extract.test.ts`（B3 的 `constructor` / `toString` 假命中）。
- 结果：`pnpm test` → **9 files / 73 tests 全通过**；`pnpm exec tsc --noEmit` → 无错误。

## 4. 未覆盖 / 后续

- **B1 的 hook 级测试**：项目未安装 jsdom / testing-library，`useRegexMatches` 的卸载-销毁与
  过期定时器收回暂以代码约束 + 手动冒烟验证；如需单测需引入 jsdom（`// @vitest-environment jsdom`）。
- **JsonExtract 的局部 UI 态**（`tab` json/csv、`draft`）：属瞬态交互，卸载后重置无碍，未提升为 Tab 持久态。
- **硬性 Tab 数量上限（B5）**：留待产品决策。
