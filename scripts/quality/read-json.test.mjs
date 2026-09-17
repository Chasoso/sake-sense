import { describe, expect, it } from "vitest";
import { findDuplicateJsonObjectKeys } from "./read-json.mjs";

describe("duplicate JSON key detection", () => {
  it("detects duplicate keys in the same object but permits keys in separate objects", () => {
    expect(findDuplicateJsonObjectKeys('{"a": 1, "a": 2}')).toEqual([
      "Duplicate JSON object key: a",
    ]);
    expect(findDuplicateJsonObjectKeys('{"first": {"a": 1}, "second": {"a": 2}}')).toEqual([]);
  });
});
