import { describe, expect, it } from "vitest";
import { evaluateChangeSet } from "./check-cloudformation-change-set.mjs";

const change = (
  Action,
  Replacement = "False",
  LogicalResourceId = "SemanticBridgeFunction",
  ResourceType = "AWS::Lambda::Function",
) => ({
  ResourceChange: {
    LogicalResourceId,
    ResourceType,
    Action,
    Replacement,
  },
});

describe("CloudFormation change set safety gate", () => {
  it.each([
    ["Modify", "False"],
    ["Modify", "Never"],
    ["Add", "False"],
    ["Add", undefined],
  ])("allows safe %s changes", (action, replacement) => {
    expect(evaluateChangeSet({ Changes: [change(action, replacement)] }).status).toBe("allowed");
  });

  it("allows removal of the explicitly reviewed admin OPTIONS route", () => {
    expect(
      evaluateChangeSet({
        Changes: [change("Remove", "False", "AdminOptionsRoute", "AWS::ApiGatewayV2::Route")],
      }).status,
    ).toBe("allowed");
  });

  it.each([
    ["Remove", "False", "DynamoDBTable", "AWS::DynamoDB::Table"],
    ["Remove", "False", "AdminUserPool", "AWS::Cognito::UserPool"],
    ["Remove", "False", "PublicReadFunction", "AWS::Lambda::Function"],
    ["Remove", "False", "LambdaRole", "AWS::IAM::Role"],
    ["Add", "True"],
    ["Add", "Conditional"],
    ["Modify", "True"],
    ["Modify", "Conditional"],
    ["Modify", "FutureValue"],
    ["Replace", "False"],
  ])(
    "blocks unsafe or unknown %s changes",
    (action, replacement, logicalResourceId, resourceType) => {
      const result = evaluateChangeSet({
        Changes: [change(action, replacement, logicalResourceId, resourceType)],
      });
      expect(result.status).toBe("blocked");
      expect(result.changes).toEqual([
        expect.objectContaining({ Action: action, Replacement: replacement ?? "unknown" }),
      ]);
    },
  );

  it("fails closed when changes are malformed", () => {
    expect(evaluateChangeSet({ Changes: [{}] }).status).toBe("blocked");
    expect(evaluateChangeSet({}).status).toBe("blocked");
  });

  it("treats CloudFormation no-change results as a successful no-op", () => {
    expect(
      evaluateChangeSet({
        Status: "FAILED",
        StatusReason: "The submitted information didn't contain changes.",
      }),
    ).toEqual({ status: "no-change", changes: [] });
    expect(evaluateChangeSet({ Status: "CREATE_COMPLETE", Changes: [] })).toEqual({
      status: "no-change",
      changes: [],
    });
  });
});
