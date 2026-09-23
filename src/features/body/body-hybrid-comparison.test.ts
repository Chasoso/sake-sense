import { describe, expect, it } from "vitest";
import { BODY_HYBRID_HALO_VARIANTS, BODY_HYBRID_CONTOUR_STYLE } from "./body-pose-guidance";
import {
  CONTOUR_SIMPLIFY_TOLERANCE,
  CONTOUR_TEMPORAL_ALPHA,
  CONTOUR_PRESENTATION_VARIANTS,
  prepareContourForPresentationVariant,
} from "./segmentation-mask-spike";
import { createBodyHybridComparisonVariants } from "./body-hybrid-comparison";

describe("body hybrid development comparison variants", () => {
  it("creates the requested 3 by 4 matrix without mutating production defaults", () => {
    const variants = createBodyHybridComparisonVariants();
    expect(BODY_HYBRID_HALO_VARIANTS).toHaveLength(3);
    expect(CONTOUR_PRESENTATION_VARIANTS).toHaveLength(4);
    expect(variants).toHaveLength(12);
    expect(new Set(variants.map((variant) => variant.id)).size).toBe(12);
    expect(BODY_HYBRID_HALO_VARIANTS.map((variant) => variant.outerGlowOpacity)).toEqual([
      0.24, 0.32, 0.42,
    ]);
    expect(CONTOUR_PRESENTATION_VARIANTS.map((variant) => variant.simplifyTolerance)).toEqual([
      0.8, 0.6, 0.4, 0.6,
    ]);
    expect(BODY_HYBRID_CONTOUR_STYLE.outerGlowOpacity).toBe(0.32);
    expect(BODY_HYBRID_CONTOUR_STYLE.outerGlowWidthScale).toBe(3.2);
    expect(BODY_HYBRID_CONTOUR_STYLE.glowBlurPx).toBe(10);
    expect(BODY_HYBRID_CONTOUR_STYLE.outerCoreOpacity).toBe(0.7);
    expect(BODY_HYBRID_CONTOUR_STYLE.outerCoreWidthScale).toBe(0.8);
    expect(CONTOUR_SIMPLIFY_TOLERANCE).toBe(0.6);
    expect(CONTOUR_TEMPORAL_ALPHA).toBe(0.6);
  });

  it("passes contour variant parameters into the existing pipeline", () => {
    const source = Array.from({ length: 8 }, (_, index) => ({
      x: index % 4,
      y: Math.floor(index / 4),
    }));
    const current = prepareContourForPresentationVariant(source, CONTOUR_PRESENTATION_VARIANTS[0]);
    const detailed = prepareContourForPresentationVariant(source, CONTOUR_PRESENTATION_VARIANTS[2]);
    expect(current).not.toBe(source);
    expect(detailed).not.toBe(source);
    expect(CONTOUR_PRESENTATION_VARIANTS[0].simplifyTolerance).toBe(0.8);
    expect(CONTOUR_PRESENTATION_VARIANTS[2].simplifyTolerance).toBe(0.4);
  });
});
