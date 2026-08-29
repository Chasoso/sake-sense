import { describe, expect, it } from "vitest";
import { clientToViewBoxPoint } from "./coordinate";

describe("client to gesture viewBox coordinates", () => {
  it("handles an identity-like matrix", () => {
    expect(
      clientToViewBoxPoint(40, 30, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, { x: 0, y: 0 }),
    ).toEqual({
      x: 40,
      y: 30,
    });
  });

  it("inverts scale and screen offset", () => {
    expect(
      clientToViewBoxPoint(120, 90, { a: 2, b: 0, c: 0, d: 2, e: 20, f: 30 }, { x: 0, y: 0 }),
    ).toEqual({
      x: 50,
      y: 30,
    });
  });

  it("handles an aspect-ratio-preserving transformed drawing area", () => {
    expect(
      clientToViewBoxPoint(260, 130, { a: 1.5, b: 0, c: 0, d: 1.5, e: 20, f: 10 }, { x: 0, y: 0 }),
    ).toEqual({
      x: 160,
      y: 80,
    });
  });

  it("clamps points to the viewBox", () => {
    expect(
      clientToViewBoxPoint(-20, 400, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }, { x: 0, y: 0 }),
    ).toEqual({
      x: 0,
      y: 160,
    });
  });

  it("uses a safe fallback for an unavailable or invalid matrix", () => {
    expect(clientToViewBoxPoint(10, 10, null, { x: 12, y: 14 })).toEqual({ x: 12, y: 14 });
    expect(
      clientToViewBoxPoint(10, 10, { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 }, { x: 12, y: 14 }),
    ).toEqual({
      x: 12,
      y: 14,
    });
  });
});
