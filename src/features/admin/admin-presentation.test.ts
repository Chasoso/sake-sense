import { describe, expect, it } from "vitest";
import { displayName, relationLabel, selectOptions, statusLabel } from "./admin-presentation";

describe("admin presentation helpers", () => {
  it.each([
    ["published", "公開中"],
    ["draft", "下書き"],
    ["archived", "アーカイブ"],
    ["direct", "直接"],
    ["accepted-variant", "承認済み変異"],
    ["weak", "弱い根拠"],
    ["rejected", "却下"],
  ])("maps %s to a user-facing label", (value, label) => {
    expect(statusLabel(value)).toBe(label);
  });

  it("resolves names and safely falls back for missing relations", () => {
    const items = [
      { id: "brewery-1", displayName: "手取酒造" },
      { id: "source-1", name: "公式資料" },
    ];
    expect(displayName(items[0])).toBe("手取酒造");
    expect(relationLabel(items, "brewery-1")).toBe("手取酒造");
    expect(relationLabel(items, "missing")).toBe("missing");
    expect(relationLabel(items, "")).toBe("-");
  });

  it("maps records to stable select options", () => {
    expect(selectOptions([{ id: "p-1", name: "菊鶴" }, { name: "without-id" }])).toEqual([
      { value: "p-1", label: "菊鶴" },
    ]);
  });
});
