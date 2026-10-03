import { describe, expect, it } from "vitest";
import { CSV_BOM, extractJson, resolvePath } from "../src/tools/json-extract/extract";

const SAMPLE = JSON.stringify({
  code: 0,
  data: {
    list: [
      { id: 1, name: "张三", tags: ["vip"], addr: { city: "上海", zip: "200000" } },
      { id: 2, name: "李四", tags: [], addr: { city: "北京", zip: "100000" } },
    ],
  },
});

describe("resolvePath", () => {
  it("点路径 + 数字下标", () => {
    const root = { a: { b: [{ c: 7 }] } };
    expect(resolvePath(root, "a.b[0].c")).toEqual({ ok: true, value: 7 });
    expect(resolvePath(root, "")).toEqual({ ok: true, value: root });
    expect(resolvePath([9], "[0]")).toEqual({ ok: true, value: 9 });
  });

  it("语法错误与未命中", () => {
    expect(resolvePath({}, "a[").ok).toBe(false);
    expect(resolvePath({}, "a[x]").ok).toBe(false);
    expect(resolvePath({}, "a.b")).toEqual({ ok: false, message: expect.stringContaining("不存在") });
  });
});

describe("extractJson", () => {
  it("路径定位 + 投影：新 JSON 保留嵌套结构，keys 为并集（首现顺序）", () => {
    const r = extractJson(SAMPLE, "data.list", ["id", "name"]);
    expect(r.keys).toEqual(["id", "name", "tags", "addr"]);
    expect(r.json).toBe(
      `[
  {
    "id": 1,
    "name": "张三"
  },
  {
    "id": 2,
    "name": "李四"
  }
]`,
    );
    expect(r.rowCount).toBe(2);
  });

  it("未选列：只出 keys，不出 json/csv", () => {
    const r = extractJson(SAMPLE, "data.list", []);
    expect(r.keys.length).toBe(4);
    expect(r.json).toBeUndefined();
    expect(r.csv).toBeUndefined();
  });

  it("CSV：对象拍平为点路径列，数组值序列化并转义", () => {
    const r = extractJson(SAMPLE, "data.list", ["id", "addr", "tags"]);
    expect(r.columns).toEqual(["id", "addr.city", "addr.zip", "tags"]);
    expect(r.csv).toBe(
      'id,addr.city,addr.zip,tags\r\n1,上海,200000,"[""vip""]"\r\n2,北京,100000,[]',
    );
    expect(r.csv).not.toContain(CSV_BOM);
    // 表格预览用的是未转义文本
    expect(r.rows).toEqual([
      ["1", "上海", "200000", '["vip"]'],
      ["2", "北京", "100000", "[]"],
    ]);
  });

  it("null → 空单元格；缺失 key 的 JSON 省略字段、CSV 留空", () => {
    const input = JSON.stringify([{ id: 1, name: null }, { id: 2, age: 3 }]);
    const r = extractJson(input, "", ["id", "name", "age"]);
    expect(r.csv).toBe("id,name,age\r\n1,,\r\n2,,3");
    expect(r.json).toBe(
      `[
  {
    "id": 1,
    "name": null
  },
  {
    "id": 2,
    "age": 3
  }
]`,
    );
  });

  it("勾了但全行缺失的 key 保留为空列", () => {
    const r = extractJson(JSON.stringify([{ a: 1 }]), "", ["a", "zzz"]);
    expect(r.columns).toEqual(["a", "zzz"]);
    expect(r.csv).toBe("a,zzz\r\n1,");
  });

  it("手动点路径列：投影与 CSV 按行深层取值", () => {
    const r = extractJson(SAMPLE, "data.list", ["addr.city"]);
    expect(r.json).toBe(
      '[\n  {\n    "addr.city": "上海"\n  },\n  {\n    "addr.city": "北京"\n  }\n]',
    );
    expect(r.csv).toBe("addr.city\r\n上海\r\n北京");
  });

  it("值数组模式：单列输出 [v1,v2,…]，CSV 单列含表头", () => {
    const r = extractJson(SAMPLE, "data.list", ["id"], true);
    expect(r.json).toBe("[\n  1,\n  2\n]");
    expect(r.csv).toBe("id\r\n1\r\n2");
    expect(r.columns).toEqual(["id"]);
    expect(r.rows).toEqual([["1"], ["2"]]);
  });

  it("值数组：缺失取 null，CSV 留空", () => {
    const r = extractJson(JSON.stringify([{ a: 1 }, { b: 2 }]), "", ["a"], true);
    expect(r.json).toBe("[\n  1,\n  null\n]");
    expect(r.csv).toBe("a\r\n1\r\n");
  });

  it("值数组 + 点路径：抽嵌套字段与下标", () => {
    expect(extractJson(SAMPLE, "data.list", ["addr.city"], true).json).toBe(
      '[\n  "上海",\n  "北京"\n]',
    );
    expect(extractJson(SAMPLE, "data.list", ["tags[0]"], true).json).toBe(
      '[\n  "vip",\n  null\n]',
    );
  });

  it("单对象：投影输出对象本身，CSV 单行", () => {
    const r = extractJson('{"x":1,"y":"a, b"}', "", ["x", "y"]);
    expect(r.json).toBe('{\n  "x": 1,\n  "y": "a, b"\n}');
    expect(r.rowCount).toBe(1);
    expect(r.csv).toBe('x,y\r\n1,"a, b"');
  });

  it("RFC4180：引号翻倍、逗号/换行进引号", () => {
    const r = extractJson(JSON.stringify([{ s: 'a,"b"\nc' }]), "", ["s"]);
    expect(r.csv).toBe('s\r\n"a,""b""\nc"');
  });

  it("路径错误与形状错误", () => {
    expect(extractJson(SAMPLE, "data.users", ["id"]).pathError).toContain("不存在");
    expect(extractJson(SAMPLE, "code", ["code"]).pathError).toContain("需为对象或对象数组");
    expect(extractJson(JSON.stringify([[1]]), "", ["x"]).pathError).toContain("不是对象");
  });

  it("空输入静默；CSV 导出时才加 BOM", () => {
    expect(extractJson("   ", "", [])).toEqual({ keys: [] });
    expect(CSV_BOM).toBe("\uFEFF");
  });
});
