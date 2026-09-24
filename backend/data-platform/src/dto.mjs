function publicRecord(item) {
  const record = { ...item };
  delete record.audit;
  delete record.createdAt;
  delete record.updatedAt;
  return record;
}

export function toPublicProduct(item) {
  return publicRecord(item);
}

export function toPublicBrewery(item) {
  return publicRecord(item);
}

export function toPublicSource(item) {
  return publicRecord(item);
}

export function toPublicEvidence(item) {
  return publicRecord(item);
}

export function toAdminRecord(item) {
  return item;
}
