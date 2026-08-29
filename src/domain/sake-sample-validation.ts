type SakeProduct = {
  id: string;
  sourceUrl: string;
  termReferences: Array<{ termId: string }>;
  provenance: Array<{ url: string }>;
};

type SakeSample = { products: SakeProduct[] };

export function findSakeSampleValidationErrors(
  sample: SakeSample,
  dictionaryTermIds: Set<string>,
): string[] {
  const errors: string[] = [];
  const productIds = new Set<string>();
  for (const product of sample.products) {
    if (productIds.has(product.id)) errors.push(`Duplicate sake product ID: ${product.id}`);
    productIds.add(product.id);
    if (!product.sourceUrl || product.sourceUrl.includes("example.com")) {
      errors.push(`Invalid product source URL in ${product.id}`);
    }
    if (!product.provenance.length) errors.push(`Missing provenance in ${product.id}`);
    for (const reference of product.termReferences) {
      if (!dictionaryTermIds.has(reference.termId)) {
        errors.push(`Unknown dictionary term ${reference.termId} in ${product.id}`);
      }
    }
    for (const source of product.provenance) {
      if (!source.url || source.url.includes("example.com")) {
        errors.push(`Invalid provenance URL in ${product.id}`);
      }
    }
  }
  return errors;
}
