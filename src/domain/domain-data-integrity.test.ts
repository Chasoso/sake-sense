import { describe, expect, it } from "vitest";
import { mvpDomainData, validateDomainDataIntegrity } from "./domain-data-integrity";

describe("MVP domain-data integrity", () => {
  it("accepts reviewed partial and unmapped domain paths", () => {
    expect(validateDomainDataIntegrity()).toEqual([]);
  });

  it("reports contextual errors for duplicate IDs and cross-layer references", () => {
    const invalid = structuredClone(mvpDomainData);
    invalid.dictionary.entries.push(invalid.dictionary.entries[0]);
    invalid.expressions.expressions.push(invalid.expressions.expressions[0]);
    invalid.expressions.expressions[0].candidateTermIds = ["missing-term"];
    invalid.supportCases.cases.push(invalid.supportCases.cases[0]);
    invalid.supportCases.cases[1].expressionIds = ["missing-expression"];
    invalid.supportCases.cases[2].resultKind = "interpretation-state";
    invalid.supportCases.cases[2].interpretationStateId = "missing-state";
    const productWithReference = invalid.sakeSample.products.find(
      (product) => product.termReferences.length > 0,
    )!;
    productWithReference.id = invalid.sakeSample.products[1].id;
    productWithReference.breweryId = "missing-brewery";
    productWithReference.termReferences[0].termId = "missing-term";

    const errors = validateDomainDataIntegrity(invalid);

    expect(errors).toEqual(
      expect.arrayContaining([
        "Duplicate dictionary entry ID: atoaji",
        "Duplicate sensory expression ID: lingering-after-feel",
        "Unknown candidate term missing-term in lingering-after-feel",
        "Duplicate sensory support case ID: body-short-abrupt-clean-fade",
        "Unknown support expression missing-expression in body-lingering-gradual-soft-settle",
        "Unknown interpretation state in body-expanding-spreading-outward",
        `Duplicate sake product ID: ${mvpDomainData.sakeSample.products[1].id}`,
        `Unknown brewery missing-brewery in ${mvpDomainData.sakeSample.products[1].id}`,
        `Unknown dictionary term missing-term in ${mvpDomainData.sakeSample.products[1].id}`,
      ]),
    );
  });

  it("does not allow a support case to bypass expressions with a direct term field", () => {
    const invalid = structuredClone(mvpDomainData);
    (invalid.supportCases.cases[0] as Record<string, unknown>).termId = "kire";
    expect(validateDomainDataIntegrity(invalid)).toContain(
      "Direct term shortcut is not allowed in support case body-short-abrupt-clean-fade",
    );
  });
});
