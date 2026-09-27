import { expect, test } from "@playwright/test";

type Point = { x: number; y: number };
type SyntheticSample = {
  family: string;
  variantId: string;
  points: Point[];
  intervalsMs: number[];
  finishOffset?: Point;
};

const shortSharp: SyntheticSample[] = [50, 60, 70, 80, 90, 100].map((length, index) => ({
  family: "short-sharp",
  variantId: `short-sharp-${index + 1}`,
  points: [
    { x: 80, y: 70 + (index % 2) * 8 },
    { x: 80 + length / 2, y: 70 + (index % 2) * 8 },
    { x: 80 + length, y: 70 + (index % 2) * 8 },
  ],
  intervalsMs: [60, 60],
  finishOffset: { x: 4, y: 0 },
}));

const slowLong: SyntheticSample[] = [90, 100, 110, 120, 130, 140].map((length, index) => ({
  family: "slow-long",
  variantId: `slow-long-${index + 1}`,
  points: Array.from({ length: 6 }, (_, pointIndex) => ({
    x: 40 + (length * pointIndex) / 5,
    y: 55 + (index % 3) * 8,
  })),
  intervalsMs: [320, 320, 320, 320, 640],
}));

const broadSpreading: SyntheticSample[] = [130, 140, 150, 160, 170, 180].map((length, index) => ({
  family: "broad-spreading",
  variantId: `broad-spreading-${index + 1}`,
  points: Array.from({ length: 6 }, (_, pointIndex) => ({
    x: 30 + (length * pointIndex) / 5,
    y: 48 + ((pointIndex + index) % 2) * 10,
  })),
  intervalsMs: [180, 180, 180, 180, 180],
}));

const compact: SyntheticSample[] = [20, 22, 25, 28, 32, 35].map((length, index) => ({
  family: "compact",
  variantId: `compact-${index + 1}`,
  points: [
    { x: 145, y: 78 },
    { x: 145 + length / 2, y: 78 },
    { x: 145 + length, y: 78 },
  ],
  intervalsMs: [120, 120],
}));

const repeatedTurns: SyntheticSample[] = [20, 24, 28, 32, 36, 40].map((amplitude, index) => ({
  family: "repeated-turns",
  variantId: `repeated-turns-${index + 1}`,
  points: Array.from({ length: 8 }, (_, pointIndex) => ({
    x: 80 + (pointIndex % 2 === 0 ? pointIndex * 22 : (pointIndex - 1) * 22 - 12),
    y: 80 + (pointIndex % 2 === 0 ? -amplitude : amplitude),
  })),
  intervalsMs: [100, 100, 100, 100, 100, 100, 100],
}));

const smoothCurve: SyntheticSample[] = [0, 1, 2, 3, 4, 5].map((index) => ({
  family: "smooth-curve",
  variantId: `smooth-curve-${index + 1}`,
  points: Array.from({ length: 7 }, (_, pointIndex) => ({
    // Keep the path comfortably inside the smooth-flow speed boundary and
    // below the broad-spreading spread boundary under CI pointer timing.
    x: 55 + pointIndex * 20,
    y: 82 + Math.round(Math.sin((pointIndex / 6) * Math.PI) * (20 + index * 2)),
  })),
  intervalsMs: [120, 120, 120, 120, 120, 450],
}));

const samples = [shortSharp, slowLong, broadSpreading, compact, repeatedTurns, smoothCurve].flat();

async function drawSample(page: import("@playwright/test").Page, sample: SyntheticSample) {
  const pad = page.locator("svg.gesture-pad");
  await expect(pad).toBeVisible();
  const box = await pad.boundingBox();
  if (!box) throw new Error("gesture pad has no layout box");

  const toScreen = (point: Point) => ({
    x: box.x + (point.x / 320) * box.width,
    y: box.y + (point.y / 160) * box.height,
  });
  const first = toScreen(sample.points[0]);
  const pointerEvent = (type: string, point: { x: number; y: number }) =>
    pad.dispatchEvent(type, {
      bubbles: true,
      clientX: point.x,
      clientY: point.y,
      pointerId: 1,
      buttons: 1,
      isPrimary: true,
    });
  await pointerEvent("pointerdown", first);
  for (let index = 1; index < sample.points.length; index += 1) {
    await page.waitForTimeout(sample.intervalsMs[index - 1]);
    const point = toScreen(sample.points[index]);
    await pointerEvent("pointermove", point);
  }
  const lastPoint = sample.points.at(-1) ?? first;
  const finishPoint = {
    x: lastPoint.x + (sample.finishOffset?.x ?? 0),
    y: lastPoint.y + (sample.finishOffset?.y ?? 0),
  };
  await pointerEvent("pointerup", toScreen(finishPoint));
  await expect(page.locator(".gesture-actions .button--primary")).toBeEnabled();
  await page.locator(".gesture-actions .button--primary").click();
  const diagnostics = page.getByTestId("gesture-calibration-diagnostics");
  await expect(diagnostics).toHaveText(/durationMs/);
  return JSON.parse((await diagnostics.textContent()) ?? "{}") as {
    features: Record<string, number | boolean>;
    matchedCaseIds: string[];
    resultKind: string;
    expressionIds: string[];
    candidateTermIds: string[];
  };
}

test("calibrates deterministic Gesture families through the real pointer path", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-mode="gesture"]').click();
  const results = [];
  for (const [index, sample] of samples.entries()) {
    if (index > 0) await page.locator(".text-button").click();
    results.push({ sample, diagnostics: await drawSample(page, sample) });
  }

  const byFamily = new Map<string, typeof results>();
  for (const result of results) {
    const familyResults = byFamily.get(result.sample.family) ?? [];
    familyResults.push(result);
    byFamily.set(result.sample.family, familyResults);
  }

  const candidateDistribution = new Map<string, number>();
  const expressionDistribution = new Map<string, number>();
  const resultKindDistribution = new Map<string, number>();
  const supportCaseCoverage = new Map<string, number>();
  for (const { diagnostics } of results) {
    const candidate = diagnostics.candidateTermIds.join(",") || "unmapped";
    candidateDistribution.set(candidate, (candidateDistribution.get(candidate) ?? 0) + 1);
    const expression = diagnostics.expressionIds.join(",") || "unmapped";
    expressionDistribution.set(expression, (expressionDistribution.get(expression) ?? 0) + 1);
    resultKindDistribution.set(
      diagnostics.resultKind,
      (resultKindDistribution.get(diagnostics.resultKind) ?? 0) + 1,
    );
    for (const caseId of diagnostics.matchedCaseIds) {
      supportCaseCoverage.set(caseId, (supportCaseCoverage.get(caseId) ?? 0) + 1);
    }
  }

  const summary = [...byFamily.entries()].map(([family, familyResults]) => {
    const mapped = familyResults.filter(({ diagnostics }) => diagnostics.resultKind !== "unmapped");
    const resultCounts = new Map<string, number>();
    for (const { diagnostics } of familyResults) {
      const result = diagnostics.candidateTermIds.join(",") || diagnostics.resultKind;
      resultCounts.set(result, (resultCounts.get(result) ?? 0) + 1);
    }
    const dominant = [...resultCounts.entries()].sort((left, right) => right[1] - left[1])[0];
    return {
      family,
      samples: familyResults.length,
      mapped: mapped.length,
      unmapped: familyResults.length - mapped.length,
      dominantResult: dominant?.[0] ?? "none",
    };
  });

  console.log(
    JSON.stringify(
      {
        summary,
        records: results.map(({ sample, diagnostics }) => ({
          family: sample.family,
          variantId: sample.variantId,
          ...diagnostics,
        })),
        candidateDistribution: Object.fromEntries(candidateDistribution),
        expressionDistribution: Object.fromEntries(expressionDistribution),
        resultKindDistribution: Object.fromEntries(resultKindDistribution),
        supportCaseCoverage: Object.fromEntries(supportCaseCoverage),
      },
      null,
      2,
    ),
  );

  expect(new Set(summary.map((entry) => entry.family)).size).toBe(6);
  expect(summary.every((entry) => entry.samples === 6)).toBe(true);
  expect(
    new Set(results.map(({ diagnostics }) => diagnostics.features.durationMs)).size,
  ).toBeGreaterThan(2);
  expect(
    new Set(results.map(({ diagnostics }) => diagnostics.features.spread)).size,
  ).toBeGreaterThan(2);
  expect(
    new Set(results.map(({ diagnostics }) => diagnostics.features.horizontalDirectionChanges)).size,
  ).toBeGreaterThan(1);
  expect(supportCaseCoverage.get("gesture-short-fast-abrupt-clean-fade")).toBeGreaterThan(0);
  expect(supportCaseCoverage.get("gesture-slow-long-lingering-after-feel")).toBeGreaterThan(0);
  expect(supportCaseCoverage.get("gesture-broad-spreading-rounded-enveloping")).toBeGreaterThan(0);
  expect(
    supportCaseCoverage.get("gesture-repeated-direction-changes-wavering") ?? 0,
  ).toBeGreaterThan(0);
  expect(supportCaseCoverage.get("gesture-smooth-continuous-flow")).toBeGreaterThan(0);
  expect(candidateDistribution.get("nameraka") ?? 0).toBeGreaterThan(0);

  const dominantCandidateCount = Math.max(...candidateDistribution.values());
  // The recalibrated screen-coordinate suite produced 17 unmapped, 6 kire,
  // 5 marui, 4 atoaji, and 4 nameraka results. A 75% ceiling remains a
  // deliberately broad pathological-collapse guard, not a class-balance target.
  expect(dominantCandidateCount / results.length).toBeLessThan(0.75);
  expect((candidateDistribution.get("unmapped") ?? 0) / results.length).toBeLessThan(0.75);
});
