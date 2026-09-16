import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import dictionary from "./data/sensory-dictionary.v0.1.json";
import { findDictionaryErrors } from "./dictionary-validation";
import schema from "../../schemas/sensory-dictionary.schema.json";

describe("MVP sensory dictionary", () => {
  it("matches the schema and keeps stable unique IDs", () => {
    const validate = new Ajv({ allErrors: true, formats: { uri: true, date: true } }).compile(
      schema,
    );
    expect(validate(dictionary), JSON.stringify(validate.errors)).toBe(true);
    expect(findDictionaryErrors(dictionary)).toEqual([]);
  });

  it("uses the reviewed selectable and reference-only sets", () => {
    expect(
      dictionary.entries
        .filter((entry) => entry.vocabularyStatus === "selectable")
        .map((entry) => entry.id),
    ).toEqual(["atoaji", "kire", "nameraka", "marui"]);
    expect(
      dictionary.entries
        .filter((entry) => entry.vocabularyStatus === "reference-only")
        .map((entry) => entry.id),
    ).toEqual(["sanmi", "umami", "amami", "tanrei", "nojun"]);
  });

  it("keeps the source-aligned distinctions and aftertaste relation", () => {
    const byId = new Map(dictionary.entries.map((entry) => [entry.id, entry]));
    expect(byId.get("kire")).toMatchObject({
      displayTerm: "きれ",
      parentTermId: "atoaji",
      sourceCategory: "aftertaste",
    });
    expect(byId.get("marui")?.sourceCategory).toBe("mouthfeel-stimulus");
    expect(byId.get("nameraka")?.sourceCategory).toBe("mouthfeel-texture");
    expect(byId.get("amami")?.vocabularyStatus).toBe("reference-only");
  });

  it("rejects invalid statuses, duplicate IDs, and unknown parents", () => {
    const invalidStatus = structuredClone(dictionary);
    invalidStatus.entries[0].vocabularyStatus = "mapped";
    const validate = new Ajv({ allErrors: true, formats: { uri: true, date: true } }).compile(
      schema,
    );
    expect(validate(invalidStatus)).toBe(false);
    const invalidRelations = structuredClone(dictionary);
    invalidRelations.entries.push(invalidRelations.entries[0]);
    invalidRelations.entries[1].parentTermId = "missing";
    expect(findDictionaryErrors(invalidRelations)).toEqual(
      expect.arrayContaining([
        "Duplicate dictionary entry ID: atoaji",
        "Unknown parent term missing in kire",
      ]),
    );
  });
});
