import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const ALLOWED_ACTIONS = new Set(["Add", "Modify"]);
const SAFE_REPLACEMENTS = new Set([false, "False", "Never"]);
const BLOCKED_REPLACEMENTS = new Set([true, "True", "Conditional"]);

function isExplicitlyAllowedRemoval(change) {
  return (
    change.Action === "Remove" &&
    change.LogicalResourceId === "AdminOptionsRoute" &&
    change.ResourceType === "AWS::ApiGatewayV2::Route"
  );
}

function safeChangeSummary(resourceChange = {}) {
  return {
    LogicalResourceId: resourceChange.LogicalResourceId ?? "unknown",
    ResourceType: resourceChange.ResourceType ?? "unknown",
    Action: resourceChange.Action ?? "unknown",
    Replacement: resourceChange.Replacement ?? "unknown",
  };
}

function isNoChangeStatus(changeSet) {
  if (
    changeSet?.Status === "CREATE_COMPLETE" &&
    Array.isArray(changeSet.Changes) &&
    changeSet.Changes.length === 0
  ) {
    return true;
  }

  return (
    changeSet?.Status === "FAILED" &&
    typeof changeSet.StatusReason === "string" &&
    /(?:didn't|did not) contain changes|no updates are to be performed/i.test(
      changeSet.StatusReason,
    )
  );
}

export function evaluateChangeSet(changeSet) {
  if (isNoChangeStatus(changeSet)) {
    return { status: "no-change", changes: [] };
  }

  if (!Array.isArray(changeSet?.Changes)) {
    return {
      status: "blocked",
      reason: "missing_or_invalid_changes",
      changes: [],
    };
  }

  const changes = changeSet.Changes.map((entry) => safeChangeSummary(entry?.ResourceChange));
  for (const change of changes) {
    if (change.Action === "Remove") {
      if (isExplicitlyAllowedRemoval(change)) continue;
      return {
        status: "blocked",
        reason: "unsupported_action:Remove",
        changes,
      };
    }

    if (!ALLOWED_ACTIONS.has(change.Action)) {
      return {
        status: "blocked",
        reason: `unsupported_action:${change.Action}`,
        changes,
      };
    }

    if (change.Action === "Modify" && !SAFE_REPLACEMENTS.has(change.Replacement)) {
      return {
        status: "blocked",
        reason: BLOCKED_REPLACEMENTS.has(change.Replacement)
          ? `resource_replacement:${change.Replacement}`
          : `unsupported_replacement:${change.Replacement}`,
        changes,
      };
    }

    if (change.Action === "Add" && change.Replacement !== "unknown") {
      if (BLOCKED_REPLACEMENTS.has(change.Replacement)) {
        return {
          status: "blocked",
          reason: `resource_replacement:${change.Replacement}`,
          changes,
        };
      }
      if (!SAFE_REPLACEMENTS.has(change.Replacement)) {
        return {
          status: "blocked",
          reason: `unsupported_replacement:${change.Replacement}`,
          changes,
        };
      }
    }
  }

  return { status: "allowed", changes };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("change set JSON path is required");
  }

  let changeSet;
  try {
    changeSet = JSON.parse(await readFile(inputPath, "utf8"));
  } catch {
    process.stdout.write(
      JSON.stringify({ status: "blocked", reason: "malformed_change_set_metadata", changes: [] }) +
        "\n",
    );
    process.exitCode = 1;
    return;
  }

  const result = evaluateChangeSet(changeSet);
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exitCode = result.status === "allowed" ? 0 : result.status === "no-change" ? 2 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
