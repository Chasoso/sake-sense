function publicRecord(item, fields) {
  return Object.fromEntries(
    fields.filter((field) => item[field] !== undefined).map((field) => [field, item[field]]),
  );
}

export function toPublicProduct(item) {
  return publicRecord(item, [
    "id",
    "name",
    "breweryId",
    "breweryName",
    "region",
    "descriptionSummary",
    "availabilityStatus",
    "currentAvailabilityStatus",
    "primarySourceId",
    "sourceUrl",
    "sourceName",
    "sourceReviewedAt",
    "imageSourcePageUrl",
    "imageSourceUrl",
    "imageUsageStatus",
    "provenanceNotes",
    "reviewNotes",
    "status",
  ]);
}

export function toPublicBrewery(item) {
  return publicRecord(item, ["id", "name", "displayName", "region", "officialUrl", "status"]);
}

export function toPublicSource(item) {
  return publicRecord(item, [
    "id",
    "sourceName",
    "title",
    "url",
    "sourceType",
    "reviewedAt",
    "category",
    "status",
  ]);
}

export function toPublicEvidence(item) {
  return publicRecord(item, [
    "id",
    "productId",
    "termId",
    "sourceId",
    "sourceWording",
    "sourceUrl",
    "evidenceStatus",
    "rationale",
    "status",
  ]);
}

export function toAdminRecord(item) {
  return item;
}
