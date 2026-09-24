import { canonicalUrl, stableId } from "./ids.mjs";

const VALID_STATUSES = new Set(["draft", "published", "archived"]);

function sourceKey(url) {
  const canonical = canonicalUrl(url);
  return canonical ? `url:${canonical}` : null;
}

export function migrateCuratedData({ breweries, products, dictionary = { entries: [] } }) {
  const now = new Date().toISOString();
  const report = { skipped: [], duplicates: [], invalid: [] };
  const breweryIds = new Set();
  const termIds = new Set((dictionary.entries ?? []).map((entry) => entry.id));
  const sourceByKey = new Map();
  const evidence = [];
  const migratedBreweries = [];
  const migratedProducts = [];

  for (const brewery of breweries.memberBreweries ?? []) {
    if (!brewery.id || !brewery.name) {
      report.invalid.push(`brewery:${brewery.id ?? "<missing>"}: missing id or name`);
      continue;
    }
    if (breweryIds.has(brewery.id)) {
      report.duplicates.push(`brewery:${brewery.id}`);
      continue;
    }
    const source = canonicalUrl(brewery.coverageSourceUrl);
    if (!source) {
      report.invalid.push(`brewery:${brewery.id}: invalid coverageSourceUrl`);
      continue;
    }
    breweryIds.add(brewery.id);
    migratedBreweries.push({
      id: brewery.id,
      name: brewery.name,
      displayName: brewery.name,
      region: brewery.association,
      officialUrl: source,
      coverageStatus: brewery.coverageStatus,
      coverageNotes: brewery.coverageNotes,
      status: "published",
      createdAt: now,
      updatedAt: now,
      audit: { source: "curated-json", migratedAt: now },
    });
  }

  function ensureSource({ url, name, type, reviewedAt, title, category = "product" }) {
    const canonical = canonicalUrl(url);
    if (!canonical) {
      report.invalid.push(`source:${url ?? "<missing>"}: invalid URL`);
      return null;
    }
    const key = sourceKey(canonical);
    const existing = sourceByKey.get(key);
    if (existing) {
      if (existing.category !== category && existing.category !== "shared")
        existing.category = "shared";
      return existing;
    }
    const source = {
      id: stableId("source", canonical),
      sourceName: name || "Curated source",
      title,
      url: canonical,
      sourceType: type || "public",
      category,
      reviewedAt,
      status: "published",
      createdAt: now,
      updatedAt: now,
      audit: { source: "curated-json", migratedAt: now },
    };
    sourceByKey.set(key, source);
    return source;
  }

  for (const entry of dictionary.entries ?? []) {
    for (const provenance of entry.provenance ?? []) {
      ensureSource({
        url: provenance.url,
        name: provenance.sourceName,
        type: provenance.sourceType,
        reviewedAt: provenance.accessedOn,
        title: entry.displayTerm,
        category: "terminology",
      });
    }
  }

  for (const product of products.products ?? []) {
    if (!product.id || !product.breweryId || !breweryIds.has(product.breweryId)) {
      report.invalid.push(`product:${product.id ?? "<missing>"}: missing or unknown brewery`);
      continue;
    }
    const source = ensureSource({
      url: product.sourceUrl,
      name: product.sourceName,
      type: product.sourceType,
      reviewedAt: product.sourceReviewedAt,
    });
    if (!source) continue;
    migratedProducts.push({
      id: product.id,
      name: product.name,
      breweryId: product.breweryId,
      breweryName: product.breweryName,
      region: product.region,
      descriptionSummary: product.descriptionSummary,
      availabilityStatus: product.availabilityStatus,
      currentAvailabilityStatus: product.currentAvailabilityStatus,
      primarySourceId: source.id,
      sourceUrl: product.sourceUrl,
      sourceName: product.sourceName,
      sourceReviewedAt: product.sourceReviewedAt,
      imageSourcePageUrl: product.imageSourcePageUrl,
      imageSourceUrl: product.imageSourceUrl,
      imageUsageStatus: product.imageUsageStatus,
      provenanceNotes: product.provenanceNotes,
      reviewNotes: product.reviewNotes,
      status: "published",
      createdAt: now,
      updatedAt: now,
      audit: { source: "curated-json", migratedAt: now },
    });
    for (const reference of product.termReferences ?? []) {
      if (!termIds.has(reference.termId)) {
        report.invalid.push(`evidence:${product.id}:${reference.termId}: unknown term`);
        continue;
      }
      const referenceSource = ensureSource({
        url: reference.sourceUrl,
        name: product.sourceName,
        type: "term-reference",
        reviewedAt: product.sourceReviewedAt,
      });
      if (!referenceSource || !reference.sourceWording || !reference.evidenceStatus) {
        report.invalid.push(`evidence:${product.id}:${reference.termId}: incomplete provenance`);
        continue;
      }
      evidence.push({
        id: stableId("evidence", `${product.id}:${reference.termId}:${referenceSource.id}`),
        productId: product.id,
        termId: reference.termId,
        sourceId: referenceSource.id,
        sourceWording: reference.sourceWording,
        sourceUrl: reference.sourceUrl,
        evidenceStatus: reference.evidenceStatus,
        rationale: reference.rationale,
        status: "published",
        createdAt: now,
        updatedAt: now,
        audit: { source: "curated-json", migratedAt: now },
      });
    }
  }

  return {
    breweries: migratedBreweries,
    products: migratedProducts,
    sources: [...sourceByKey.values()],
    evidence,
    report: {
      breweryCount: migratedBreweries.length,
      productCount: migratedProducts.length,
      sourceCount: sourceByKey.size,
      evidenceCount: evidence.length,
      invalidCount: report.invalid.length,
      skippedCount: report.skipped.length,
      duplicateCount: report.duplicates.length,
      invalid: report.invalid,
      skipped: report.skipped,
      duplicates: report.duplicates,
    },
  };
}

export function validateMigrationResult(result) {
  const errors = [];
  const tables = ["breweries", "products", "sources", "evidence"];
  for (const table of tables) {
    if (!Array.isArray(result?.[table])) errors.push(`${table} must be an array`);
  }
  const breweryIds = new Set((result?.breweries ?? []).map((item) => item.id));
  const sourceIds = new Set((result?.sources ?? []).map((item) => item.id));
  const productIds = new Set((result?.products ?? []).map((item) => item.id));
  for (const product of result?.products ?? []) {
    if (!breweryIds.has(product.breweryId))
      errors.push(`product ${product.id} references missing brewery`);
    if (!sourceIds.has(product.primarySourceId))
      errors.push(`product ${product.id} references missing source`);
  }
  for (const item of result?.evidence ?? []) {
    if (!productIds.has(item.productId))
      errors.push(`evidence ${item.id} references missing product`);
    if (!sourceIds.has(item.sourceId)) errors.push(`evidence ${item.id} references missing source`);
    if (!item.sourceWording) errors.push(`evidence ${item.id} is missing source wording`);
    if (!item.evidenceStatus) errors.push(`evidence ${item.id} is missing evidence status`);
  }
  for (const collection of tables) {
    for (const item of result?.[collection] ?? []) {
      if (!VALID_STATUSES.has(item.status))
        errors.push(`${collection}/${item.id} has invalid status`);
      if (!item.createdAt || !item.updatedAt)
        errors.push(`${collection}/${item.id} is missing timestamps`);
    }
  }
  return errors;
}
