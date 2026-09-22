import { describe, expect, it } from "vitest";
import { buildZipArguments, SEMANTIC_BRIDGE_PACKAGE_FILES } from "./package-semantic-bridge.mjs";

describe("semantic bridge Lambda package manifest", () => {
  it("contains only the bundled runtime entrypoint", () => {
    expect(SEMANTIC_BRIDGE_PACKAGE_FILES).toEqual(["index.js"]);
    expect(buildZipArguments("artifact.zip")).toEqual(["-q", "-X", "artifact.zip", "index.js"]);
  });
});
