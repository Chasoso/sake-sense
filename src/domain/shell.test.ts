import { describe, expect, it } from "vitest";
import { getShellStatus } from "./shell";

describe("getShellStatus", () => {
  it("returns a neutral local development status", () => {
    expect(getShellStatus()).toEqual({
      name: "Sake Sense",
      message: "The local development environment is ready.",
    });
  });
});
