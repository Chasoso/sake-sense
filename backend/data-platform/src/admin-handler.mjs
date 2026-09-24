import { createDynamoRepository } from "./repository.mjs";
import { createAdminAuthorizer } from "./auth.mjs";
import { toAdminRecord } from "./dto.mjs";
import {
  validateBreweryInput,
  validateEvidenceInput,
  validateProductInput,
  validateSourceInput,
} from "./validation.mjs";
import dictionary from "../../../src/domain/data/sensory-dictionary.v0.1.json" with { type: "json" };

const json = (statusCode, body) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const tableFor = {
  products: "products",
  breweries: "breweries",
  sources: "sources",
  evidence: "evidence",
};
const validatorFor = {
  products: validateProductInput,
  breweries: validateBreweryInput,
  sources: validateSourceInput,
  evidence: validateEvidenceInput,
};
const editableFields = {
  products: [
    "name",
    "breweryId",
    "region",
    "descriptionSummary",
    "availabilityStatus",
    "primarySourceId",
    "sourceUrl",
    "sourceName",
    "sourceReviewedAt",
    "status",
  ],
  breweries: ["name", "displayName", "region", "officialUrl", "status"],
  sources: ["sourceName", "title", "url", "reviewedAt", "sourceType", "status"],
  evidence: [
    "productId",
    "termId",
    "sourceId",
    "sourceWording",
    "evidenceStatus",
    "rationale",
    "status",
  ],
};

export function createAdminHandler(repository, authorize) {
  return async (event) => {
    const auth = await authorize(event);
    if (!auth.ok) return json(auth.statusCode, { error: auth.message.toLowerCase() });
    const parts = (event.rawPath ?? event.requestContext?.http?.path ?? "/")
      .split("/")
      .filter(Boolean);
    const collection = parts[1];
    const table = tableFor[collection];
    if (!table) return json(404, { error: "not_found" });
    const method = event.requestContext?.http?.method ?? "GET";
    if (method === "GET") {
      if (parts[2]) {
        const item = await repository.get(table, parts[2]);
        return item ? json(200, toAdminRecord(item)) : json(404, { error: "not_found" });
      }
      const items = await repository.list(table);
      return json(200, { items: items.map(toAdminRecord) });
    }
    if (method === "POST" && parts[2]) return json(400, { error: "create_uses_collection_route" });
    if (method !== "POST" && method !== "PATCH") return json(405, { error: "method_not_allowed" });
    let input;
    try {
      input = JSON.parse(event.body ?? "{}");
    } catch {
      return json(400, { error: "invalid_json" });
    }
    if (method === "PATCH" && (!parts[2] || parts[2] === "new"))
      return json(400, { error: "update_requires_id" });
    const id = method === "POST" ? crypto.randomUUID() : parts[2];
    const existing = await repository.get(table, id);
    const patch = Object.fromEntries(
      editableFields[collection]
        .filter((field) => Object.prototype.hasOwnProperty.call(input, field))
        .map((field) => [field, input[field]]),
    );
    const candidate = { ...existing, ...patch, id };
    const context = {
      breweries: await repository.list("breweries"),
      products: await repository.list("products"),
      sources: await repository.list("sources"),
      terms: (dictionary.entries ?? []).map((entry) => entry.id),
    };
    const errors = validatorFor[collection](candidate, context);
    if (errors.length) return json(422, { error: "validation_error", details: errors });
    if (collection === "breweries" && candidate.status === "archived") {
      const publishedProducts = context.products.filter(
        (product) => product.status === "published" && product.breweryId === id,
      );
      if (publishedProducts.length)
        return json(409, {
          error: "brewery_has_published_products",
          productIds: publishedProducts.map((product) => product.id),
        });
    }
    const now = new Date().toISOString();
    const item = {
      ...existing,
      ...patch,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      audit: { ...(existing?.audit ?? {}), updatedBy: auth.claims.sub },
    };
    await repository.put(table, item);
    return json(existing ? 200 : 201, toAdminRecord(item));
  };
}

export const handler = createAdminHandler(createDynamoRepository(), createAdminAuthorizer());
