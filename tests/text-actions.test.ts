import { describe, expect, it } from "vitest";
import {
  TEXT_ACTIONS,
  dedupeLines,
  getTextAction,
  numberLines,
  removeEmptyLines,
  sortLines,
  trimLines,
} from "../src/platform/textActions";

describe("通用文本操作：行语义", () => {
  it("排序行：升序 / 降序，保留结尾换行", () => {
    const text = "b\nc\na\n";
    expect(sortLines(text, "asc")).toBe("a\nb\nc\n");
    expect(sortLines(text, "desc")).toBe("c\nb\na\n");
  });

  it("排序不把结尾空行排到队首（保留原文换行结尾）", () => {
    expect(sortLines("b\na", "asc")).toBe("a\nb");
    expect(sortLines("b\na\n", "asc")).toBe("a\nb\n");
  });

  it("去重保留首次出现的顺序", () => {
    expect(dedupeLines("b\na\nb\nc\na")).toBe("b\na\nc");
  });

  it("去空行把纯空白行也去掉", () => {
    expect(removeEmptyLines("a\n\n  \nb")).toBe("a\nb");
  });

  it("trim 每行（空白行保留为空行）", () => {
    expect(trimLines("  a  \n   \n b")).toBe("a\n\nb");
  });

  it("加行号按位数右对齐", () => {
    expect(numberLines("a\nb\nc")).toBe("1  a\n2  b\n3  c");
    expect(numberLines("a\nb\nc\nd\ne\nf\ng\nh\ni\nj")).toContain("10  j");
  });

  it("CRLF 视作行尾", () => {
    expect(sortLines("b\r\na", "asc")).toBe("a\nb");
  });

  it("空输入不炸", () => {
    for (const action of TEXT_ACTIONS) {
      expect(action.apply("")).toBe("");
    }
  });
});

describe("文本操作登记", () => {
  it("id 唯一且可按 id 取回", () => {
    const ids = TEXT_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getTextAction("dedupe")?.label).toBe("去重行");
    expect(getTextAction("nope")).toBeUndefined();
  });
});
