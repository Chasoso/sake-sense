import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import dictionary from "./data/sensory-dictionary.v0.1.json";
import schema from "../../schemas/sensory-dictionary.schema.json";

describe("sensory dictionary v0.1", () => {
  it("matches the versioned schema and references known dimensions", () => {
    const validate = new Ajv({ allErrors: true, formats: { uri: true, date: true } }).compile(
      schema,
    );

    expect(validate(dictionary), JSON.stringify(validate.errors)).toBe(true);

    const dimensions = new Set(dictionary.dimensions.map((dimension) => dimension.id));
    for (const entry of dictionary.entries) {
      for (const dimension of entry.dimensions) {
        expect(dimensions.has(dimension.dimensionId)).toBe(true);
      }
    }
  });
});
