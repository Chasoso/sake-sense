import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import dictionary from "./data/sensory-dictionary.v0.1.json";
import { findDimensionMappingErrors } from "./dictionary-validation";
import schema from "../../schemas/sensory-dictionary.schema.json";

describe("sensory dictionary v0.1", () => {
  it("matches the versioned schema and references known dimensions", () => {
    const validate = new Ajv({ allErrors: true, formats: { uri: true, date: true } }).compile(
      schema,
    );

    expect(validate(dictionary), JSON.stringify(validate.errors)).toBe(true);

    expect(findDimensionMappingErrors(dictionary)).toEqual([]);
  });

  it("rejects a polarity that is not allowed by its dimension", () => {
    const invalid = structuredClone(dictionary);
    invalid.entries[0].dimensions[0].polarity = "round";

    expect(findDimensionMappingErrors(invalid)).toEqual([
      "Invalid polarity round for weight in tanrei",
    ]);
  });

  it("continues to reject duplicate entry IDs", () => {
    const invalid = structuredClone(dictionary);
    invalid.entries.push(invalid.entries[0]);

    expect(findDimensionMappingErrors(invalid)).toContain("Duplicate dictionary entry ID: tanrei");
  });

  it("keeps an intentionally unmapped entry valid", () => {
    const umami = dictionary.entries.find((entry) => entry.id === "umami");

    expect(umami?.mappingStatus).toBe("unmapped");
    expect(umami?.dimensions).toEqual([]);
  });
});
