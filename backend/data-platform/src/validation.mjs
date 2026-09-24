const LIFECYCLE = new Set(["draft", "published", "archived"]);
const EVIDENCE = new Set(["direct", "accepted-variant", "weak", "rejected"]);

export function validateUrl(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? null : "URL must use http or https";
  } catch {
    return "URL is invalid";
  }
}

export function validateLifecycle(value) {
  return LIFECYCLE.has(value) ? null : "status must be draft, published, or archived";
}

export function validateProductInput(input, { breweries = [], sources = [] } = {}) {
  const errors = [];
  if (!input.name?.trim()) errors.push("name is required");
  if (!breweries.some((item) => item.id === input.breweryId && item.status !== "archived"))
    errors.push("breweryId must reference an active brewery");
  if (input.primarySourceId && !sources.some((item) => item.id === input.primarySourceId))
    errors.push("primarySourceId must reference a source");
  if (input.status && validateLifecycle(input.status)) errors.push(validateLifecycle(input.status));
  if (input.status === "published") {
    if (!input.descriptionSummary?.trim())
      errors.push("published products require descriptionSummary");
    if (!input.availabilityStatus?.trim())
      errors.push("published products require availabilityStatus");
    if (!input.primarySourceId) errors.push("published products require primarySourceId");
  }
  return errors;
}

export function validateBreweryInput(input) {
  const errors = [];
  if (!input.name?.trim()) errors.push("name is required");
  if (input.officialUrl && validateUrl(input.officialUrl))
    errors.push(validateUrl(input.officialUrl));
  if (input.status && validateLifecycle(input.status)) errors.push(validateLifecycle(input.status));
  return errors;
}

export function validateSourceInput(input) {
  const errors = [];
  if (!input.sourceName?.trim()) errors.push("sourceName is required");
  if (validateUrl(input.url)) errors.push(validateUrl(input.url));
  if (!input.reviewedAt || !/^\d{4}-\d{2}-\d{2}$/.test(input.reviewedAt))
    errors.push("reviewedAt must be YYYY-MM-DD");
  if (input.status && validateLifecycle(input.status)) errors.push(validateLifecycle(input.status));
  return errors;
}

export function validateEvidenceInput(input, { products = [], sources = [], terms = [] } = {}) {
  const errors = [];
  const product = products.find((item) => item.id === input.productId);
  const source = sources.find((item) => item.id === input.sourceId);
  const published = input.status === "published";
  if (!product || (published ? product.status !== "published" : product.status === "archived"))
    errors.push(
      published ? "published evidence requires a published product" : "productId is invalid",
    );
  if (!source || (published ? source.status !== "published" : source.status === "archived"))
    errors.push(
      published ? "published evidence requires a published source" : "sourceId is invalid",
    );
  if (!terms.includes(input.termId)) errors.push("termId is invalid");
  if (!input.sourceWording?.trim()) errors.push("sourceWording is required");
  if (!EVIDENCE.has(input.evidenceStatus)) errors.push("evidenceStatus is unsupported");
  if (!input.rationale?.trim()) errors.push("rationale is required");
  if (input.status && validateLifecycle(input.status)) errors.push(validateLifecycle(input.status));
  return errors;
}

export function canPublishEvidence(input, context) {
  return validateEvidenceInput({ ...input, status: "published" }, context).length === 0;
}
