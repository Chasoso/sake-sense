import { readFileSync } from "node:fs";

function skipWhitespace(source, index) {
  while (/\s/.test(source[index] ?? "")) index += 1;
  return index;
}

function scanString(source, index) {
  const start = index;
  index += 1;
  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
    } else if (source[index] === '"') {
      return { end: index + 1, value: JSON.parse(source.slice(start, index + 1)) };
    } else {
      index += 1;
    }
  }
  throw new Error("Unterminated JSON string");
}

/** Finds duplicate keys before JSON.parse() silently overwrites earlier values. */
export function findDuplicateJsonObjectKeys(source) {
  const errors = [];

  function scanValue(index) {
    index = skipWhitespace(source, index);
    if (source[index] === "{") return scanObject(index);
    if (source[index] === "[") return scanArray(index);
    if (source[index] === '"') return scanString(source, index).end;
    while (index < source.length && !",]} \t\r\n".includes(source[index])) index += 1;
    return index;
  }

  function scanObject(index) {
    const keys = new Set();
    index = skipWhitespace(source, index + 1);
    if (source[index] === "}") return index + 1;
    while (index < source.length) {
      index = skipWhitespace(source, index);
      if (source[index] !== '"') throw new Error("Expected JSON object key");
      const key = scanString(source, index);
      if (keys.has(key.value)) errors.push(`Duplicate JSON object key: ${key.value}`);
      keys.add(key.value);
      index = skipWhitespace(source, key.end);
      if (source[index] !== ":") throw new Error("Expected JSON object separator");
      index = scanValue(index + 1);
      index = skipWhitespace(source, index);
      if (source[index] === "}") return index + 1;
      if (source[index] !== ",") throw new Error("Expected JSON object delimiter");
      index += 1;
    }
    throw new Error("Unterminated JSON object");
  }

  function scanArray(index) {
    index = skipWhitespace(source, index + 1);
    if (source[index] === "]") return index + 1;
    while (index < source.length) {
      index = scanValue(index);
      index = skipWhitespace(source, index);
      if (source[index] === "]") return index + 1;
      if (source[index] !== ",") throw new Error("Expected JSON array delimiter");
      index += 1;
    }
    throw new Error("Unterminated JSON array");
  }

  scanValue(0);
  return errors;
}

export function readJson(path) {
  const source = readFileSync(path, "utf8");
  const duplicateKeyErrors = findDuplicateJsonObjectKeys(source);
  if (duplicateKeyErrors.length) throw new Error(`${path}: ${duplicateKeyErrors.join(", ")}`);
  return JSON.parse(source);
}
