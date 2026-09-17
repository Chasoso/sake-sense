# MVP domain-data integrity

The MVP keeps observable input, experimental language, curated terminology, and real-product evidence separate:

```text
observable feature → support case → sensory expression → curated term → product relation → renderability
```

Validation is deterministic and no-network. It checks that the stored metadata is reviewable; it does not prove a source statement is true or turn an experimental interpretation into authoritative semantic truth.

## Entity rules

- Dictionary IDs are unique. Vocabulary statuses are `selectable`, `reference-only`, or `legacy`; only selectable terms are normal candidates. Dictionary definitions and provenance require reviewable source metadata.
- Expression IDs are unique. `expressionStatus` and `termLinkStatus` are independent. Approved links require one or more selectable terms; unmapped expressions have no candidate term. Interpretation states are not expressions.
- Support-case IDs and feature patterns are unique. Their expression IDs and interpretation-state IDs must resolve. Only `active` and `experimental` cases are runtime eligible; `deferred` and `legacy` cases are retained data, not normal runtime input.
- Brewery and product IDs are unique. The member baseline contains exactly 32 breweries, and every baseline brewery has a researched product record. Product term references must resolve to known dictionary terms and retain source wording, rationale, evidence status, and source URL.

## Renderability and provenance

A product may normally render only if it has an explicit selectable-term reference with `direct` or `accepted-variant` evidence, complete relation and product provenance, and permitted availability:

- `regular` is eligible;
- `seasonal` is eligible only with `currentAvailabilityStatus: confirmed`;
- `seasonal` unconfirmed/unavailable, `unknown`, and `discontinued` are not eligible.

Image rendering separately requires both `imageUsageStatus: allowed` and a direct `imageSourceUrl`. A page URL alone is not image reuse permission.

`weak`, `rejected`, reference-only, and legacy terminology remain valid audit data but cannot become normal product matches. The allowed evidence variants remain the existing reviewed data decisions; this validator does not infer new variants.

## Valid partial paths

These are expected and valid:

- `spreading-outward → unmapped`;
- `sustained-fast → unmapped`;
- a candidate expression link that does not become a normal term candidate; and
- a selectable term without any product evidence.

Support cases never store a direct term shortcut. The only normal path is support case → expression → approved expression link → selectable term. Therefore repeated lateral/broad observations cannot become `nojun` or a product match through a shortcut.

## Invalid examples

- an unknown term, expression, interpretation state, brewery, or product reference;
- duplicate IDs or duplicate JSON object keys;
- an approved expression without a candidate term, or an unmapped expression with one;
- missing provenance on a normally renderable product relation;
- weak or rejected evidence rendered as a product match; or
- an unconfirmed seasonal product rendered normally.

Run all schema, cross-file, runtime, test, build, and secret checks with:

```bash
npm run validate
```

The validation command includes a lightweight duplicate-key scan before `JSON.parse()` can silently overwrite a repeated JSON property.
