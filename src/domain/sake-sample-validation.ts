type TermReference = {
  termId: string;
  sourceWording: string;
  evidenceStatus: string;
  rationale: string;
  sourceUrl: string;
};

type SakeProduct = {
  id: string;
  breweryId: string;
  sourceUrl: string;
  sourceName: string;
  sourceReviewedAt: string;
  termReferences: TermReference[];
  availabilityStatus: string;
  currentAvailabilityStatus?: string;
  imageSourcePageUrl: string;
  imageSourceUrl?: string;
  imageUsageStatus: string;
  provenanceNotes: string;
};

type SakeSample = { products: SakeProduct[] };
type Brewery = {
  id: string;
  name: string;
  coverageStatus: string;
  coverageSourceUrl: string;
};
type BreweryBaseline = { memberBreweries: Brewery[] };
export type DictionaryEntry = { id: string; vocabularyStatus: string };

const renderableEvidence = new Set(["direct", "accepted-variant"]);
const currentAvailabilityStatuses = new Set(["confirmed", "unconfirmed", "unavailable"]);
const evidenceStatuses = new Set(["direct", "accepted-variant", "weak", "rejected"]);

export function isRenderableProductTermReference(
  reference: TermReference,
  product: Pick<
    SakeProduct,
    "availabilityStatus" | "currentAvailabilityStatus" | "provenanceNotes"
  >,
  dictionary: Map<string, DictionaryEntry>,
): boolean {
  return (
    dictionary.get(reference.termId)?.vocabularyStatus === "selectable" &&
    renderableEvidence.has(reference.evidenceStatus) &&
    (product.availabilityStatus === "regular" ||
      (product.availabilityStatus === "seasonal" &&
        product.currentAvailabilityStatus === "confirmed")) &&
    Boolean(product.provenanceNotes) &&
    Boolean(reference.sourceWording) &&
    Boolean(reference.rationale) &&
    Boolean(reference.sourceUrl)
  );
}

export function isNormalImageRenderable(
  product: Pick<SakeProduct, "imageUsageStatus" | "imageSourceUrl">,
): boolean {
  return product.imageUsageStatus === "allowed" && Boolean(product.imageSourceUrl);
}

export function findSakeSampleValidationErrors(
  sample: SakeSample,
  dictionaryEntries: readonly DictionaryEntry[],
  baseline: BreweryBaseline,
): string[] {
  const errors: string[] = [];
  const productIds = new Set<string>();
  const breweryIds = new Set<string>();
  const dictionary = new Map(dictionaryEntries.map((entry) => [entry.id, entry]));
  const baselineIds = new Set(baseline.memberBreweries.map((brewery) => brewery.id));

  if (baseline.memberBreweries.length !== 32)
    errors.push(`Expected 32 member breweries, got ${baseline.memberBreweries.length}`);
  for (const brewery of baseline.memberBreweries) {
    if (breweryIds.has(brewery.id)) errors.push(`Duplicate brewery ID: ${brewery.id}`);
    breweryIds.add(brewery.id);
    if (
      !brewery.name ||
      !brewery.coverageSourceUrl ||
      brewery.coverageSourceUrl.includes("example.com")
    )
      errors.push(`Missing coverage provenance for brewery ${brewery.id}`);
    if (
      ![
        "covered",
        "source-found-but-no-selectable-term",
        "insufficient-source",
        "temporarily-unavailable",
      ].includes(brewery.coverageStatus)
    )
      errors.push(`Invalid brewery coverage status: ${brewery.id}`);
  }

  for (const product of sample.products) {
    if (productIds.has(product.id)) errors.push(`Duplicate sake product ID: ${product.id}`);
    productIds.add(product.id);
    if (!baselineIds.has(product.breweryId))
      errors.push(`Unknown brewery ${product.breweryId} in ${product.id}`);
    if (!product.sourceUrl || product.sourceUrl.includes("example.com"))
      errors.push(`Invalid product source URL in ${product.id}`);
    if (!product.sourceName || !product.sourceReviewedAt || !product.provenanceNotes)
      errors.push(`Missing provenance in ${product.id}`);
    if (!["regular", "seasonal", "discontinued", "unknown"].includes(product.availabilityStatus))
      errors.push(`Invalid availability status in ${product.id}`);
    if (
      product.currentAvailabilityStatus !== undefined &&
      !currentAvailabilityStatuses.has(product.currentAvailabilityStatus)
    )
      errors.push(`Invalid current availability status in ${product.id}`);
    if (
      product.availabilityStatus === "seasonal" &&
      product.currentAvailabilityStatus === undefined
    )
      errors.push(`Missing current availability status for seasonal product ${product.id}`);
    if (
      (product.availabilityStatus === "discontinued" || product.availabilityStatus === "unknown") &&
      product.currentAvailabilityStatus === "confirmed"
    )
      errors.push(`Unavailable product cannot be current-confirmed in ${product.id}`);
    if (!["allowed", "needs-review", "not-allowed", "unknown"].includes(product.imageUsageStatus))
      errors.push(`Invalid image usage status in ${product.id}`);
    if (!product.imageSourcePageUrl || product.imageSourcePageUrl.includes("example.com"))
      errors.push(`Invalid image source page URL in ${product.id}`);
    for (const reference of product.termReferences) {
      const dictionaryEntry = dictionary.get(reference.termId);
      if (!dictionaryEntry)
        errors.push(`Unknown dictionary term ${reference.termId} in ${product.id}`);
      if (!evidenceStatuses.has(reference.evidenceStatus))
        errors.push(`Invalid evidence status in ${product.id}`);
      if (!reference.sourceWording || !reference.rationale || !reference.sourceUrl) {
        errors.push(`Missing term reference provenance in ${product.id} for ${reference.termId}`);
      } else if (reference.sourceUrl.includes("example.com")) {
        errors.push(`Invalid term evidence URL in ${product.id}`);
      }
      if (
        reference.sourceWording === "まろやか" &&
        reference.termId === "marui" &&
        reference.evidenceStatus !== "rejected"
      )
        errors.push(`Rejected wording まろやか cannot support marui in ${product.id}`);
      if (
        (reference.evidenceStatus === "weak" || reference.evidenceStatus === "rejected") &&
        isRenderableProductTermReference(reference, product, dictionary)
      )
        errors.push(`Weak or rejected evidence cannot render in ${product.id}`);
    }
  }

  for (const brewery of baseline.memberBreweries) {
    if (!sample.products.some((product) => product.breweryId === brewery.id))
      errors.push(`Missing researched product for brewery ${brewery.id}`);
  }
  return errors;
}
