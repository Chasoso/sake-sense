import { describe, expect, it } from "vitest";
import { analyzeBodyMovement } from "../../domain/body";
import { motionFixtures } from "./fixtures";
import { createRealCaptureDiagnostics } from "./real-capture-diagnostics";

describe("real capture motion diagnostics", () => {
  it("reports capture metadata and frame-rate estimate", () => {
    const frames = motionFixtures[0].frames;
    const diagnostic = createRealCaptureDiagnostics(frames, 15, 2);
    expect(diagnostic.capture.frameCount).toBe(frames.length);
    expect(diagnostic.capture.validFrameCount).toBe(frames.length);
    expect(diagnostic.capture.invalidFrameCount).toBe(2);
    expect(diagnostic.capture.approximateFrameRate).toBeGreaterThan(0);
  });

  it("serializes only derived diagnostics, never landmark arrays", () => {
    const serialized = JSON.stringify(createRealCaptureDiagnostics(motionFixtures[0].frames));
    expect(serialized).not.toContain("landmarks");
    expect(serialized).not.toContain("rawVideo");
    expect(serialized).not.toContain("rawAudio");
    expect(serialized).toContain("leftWrist");
  });

  it("creates all four representations from the same captured sequence", () => {
    const frames = motionFixtures[4].frames;
    const diagnostic = createRealCaptureDiagnostics(frames);
    expect(diagnostic.current).toBeDefined();
    expect(diagnostic.coarse).toBeDefined();
    expect(diagnostic.extended).toBeDefined();
    expect(diagnostic.signature).toBeDefined();
    expect(diagnostic.summary.coarse).toEqual(diagnostic.coarse);
    expect(diagnostic.summary.signature.phases).toEqual(diagnostic.signature.phases);
  });

  it("reports joint, region, speed, and direction diagnostics", () => {
    const frames = motionFixtures[11].frames;
    const diagnostic = createRealCaptureDiagnostics(frames);
    const analysis = analyzeBodyMovement(frames);
    expect(diagnostic.jointMovement.topMovingJoints.length).toBeGreaterThan(0);
    expect(diagnostic.regionActivity.leftArm.activityRatio).toBeGreaterThan(0);
    expect(diagnostic.speed.currentFastThreshold).toBeGreaterThan(0);
    expect(diagnostic.directionDebug.selectedSource).toBeDefined();
    expect(diagnostic.current.activeJointCount).toBe(analysis.features.activeJointCount);
    expect(diagnostic.jointMovement.activeJointsByCurrentThreshold).toHaveLength(
      analysis.activeJointIndices.length,
    );
    expect(diagnostic.directionDebug.result).toBe(analysis.features.motionShape.dominantDirection);
    expect(diagnostic.shapeDebug.expansion.expansion).toBe(analysis.features.motionShape.expansion);
    expect(diagnostic.shapeDebug.repetition.repetition).toBe(
      analysis.features.motionShape.repetition,
    );
    expect(diagnostic.shapeDebug.participation.participation).toBe(
      analysis.features.motionShape.participation,
    );
    expect(diagnostic.speed.hasSustainedFastMovement).toBe(analysis.hasSustainedFastMovement);
    expect(diagnostic.current.endingBehavior).toBe(analysis.endingBehavior);
  });
});
