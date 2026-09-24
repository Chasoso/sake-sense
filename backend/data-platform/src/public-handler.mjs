import { createDynamoRepository } from "./repository.mjs";
import { toPublicBrewery, toPublicEvidence, toPublicProduct, toPublicSource } from "./dto.mjs";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    "access-control-allow-origin": process.env.ALLOWED_ORIGIN ?? "*",
  },
  body: JSON.stringify(body),
});

export function createPublicHandler(repository) {
  return async (event) => {
    try {
      const path = event.rawPath ?? event.requestContext?.http?.path ?? "/";
      const parts = path.split("/").filter(Boolean);
      if (parts[0] !== "api") return json(404, { error: "not_found" });
      const collection = parts[1];
      if (collection === "products" && parts[2] && parts[3] === "evidence") {
        const items = await repository.listEvidenceForProduct(parts[2], { publishedOnly: true });
        return json(200, { items: items.map(toPublicEvidence) });
      }
      const table = { products: "products", breweries: "breweries", sources: "sources" }[
        collection
      ];
      if (!table) return json(404, { error: "not_found" });
      if (parts[2]) {
        const item = await repository.get(table, parts[2], { publishedOnly: true });
        if (!item) return json(404, { error: "not_found" });
        const mapper =
          table === "products"
            ? toPublicProduct
            : table === "breweries"
              ? toPublicBrewery
              : toPublicSource;
        return json(200, mapper(item));
      }
      const items = await repository.list(table, { publishedOnly: true });
      const mapper =
        table === "products"
          ? toPublicProduct
          : table === "breweries"
            ? toPublicBrewery
            : toPublicSource;
      return json(200, { items: items.map(mapper) });
    } catch (error) {
      console.error("public data API failure", error instanceof Error ? error.message : "unknown");
      return json(500, { error: "internal_error" });
    }
  };
}

export const handler = createPublicHandler(createDynamoRepository());
