import { describe, expect, it } from "vitest";
import { simplifyContour, type BinaryMask, type Contour } from "./segmentation-mask-spike";
import {
  findConcavityCandidates,
  generateSeparatorCandidates,
  SEPARATOR_MIN_INSIDE_RATIO,
} from "./segmentation-separators";

function mask(width: number, height: number, fill = 1): BinaryMask {
  return { width, height, data: new Uint8Array(width * height).fill(fill) };
}

const convex: Contour = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

const concave: Contour = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 6, y: 10 },
  { x: 6, y: 6 },
  { x: 4, y: 6 },
  { x: 4, y: 10 },
  { x: 0, y: 10 },
];

describe("segmentation-derived separator spike", () => {
  it("does not classify a convex contour as concave", () => {
    expect(findConcavityCandidates(convex)).toEqual([]);
  });

  it("finds the inward notch in a synthetic concave contour", () => {
    const candidates = findConcavityCandidates(concave);
    expect(candidates.map(({ point }) => point)).toEqual([
      { x: 6, y: 6 },
      { x: 4, y: 6 },
    ]);
  });

  it("is independent of contour winding", () => {
    const forward = findConcavityCandidates(concave).map(({ point }) => point);
    const reversed = findConcavityCandidates([...concave].reverse()).map(({ point }) => point);
    expect(reversed).toEqual(expect.arrayContaining(forward));
    expect(reversed).toHaveLength(forward.length);
  });

  it("keeps the synthetic notch available at the selected pre-smoothing stage", () => {
    const simplified = simplifyContour(concave);
    const snapshot = structuredClone(simplified);
    const first = findConcavityCandidates(simplified);
    expect(first.length).toBeGreaterThan(0);
    expect(findConcavityCandidates(simplified)).toEqual(first);
    expect(simplified).toEqual(snapshot);
  });

  it("ignores a shallow deviation below the named noise threshold", () => {
    const shallow: Contour = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 5.1, y: 10 },
      { x: 5.1, y: 9.2 },
      { x: 4.9, y: 9.2 },
      { x: 4.9, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(findConcavityCandidates(shallow)).toEqual([]);
  });

  it("retains a short separator whose samples remain in the foreground mask", () => {
    const candidates = findConcavityCandidates(concave);
    const separators = generateSeparatorCandidates(concave, mask(11, 11), candidates);
    expect(separators.length).toBeGreaterThan(0);
    expect(separators.every(({ insideRatio }) => insideRatio >= SEPARATOR_MIN_INSIDE_RATIO)).toBe(
      true,
    );
  });

  it("rejects a separator that exits the foreground mask", () => {
    const candidates = findConcavityCandidates(concave);
    expect(generateSeparatorCandidates(concave, mask(11, 11, 0), candidates)).toEqual([]);
  });

  it("rejects an overly long separator", () => {
    const candidates = findConcavityCandidates(concave);
    expect(
      generateSeparatorCandidates(concave, mask(11, 11), candidates, { maxLength: 5 }),
    ).toEqual([]);
  });

  it("is deterministic and does not mutate contour or mask input", () => {
    const contourSnapshot = structuredClone(concave);
    const sourceMask = mask(11, 11);
    const maskSnapshot = [...sourceMask.data];
    const first = generateSeparatorCandidates(concave, sourceMask);
    expect(generateSeparatorCandidates(concave, sourceMask)).toEqual(first);
    expect(concave).toEqual(contourSnapshot);
    expect([...sourceMask.data]).toEqual(maskSnapshot);
  });

  it("remains inspectable without pose data", () => {
    expect(generateSeparatorCandidates(concave, mask(11, 11))).toEqual(
      generateSeparatorCandidates(concave, mask(11, 11)),
    );
  });
});
