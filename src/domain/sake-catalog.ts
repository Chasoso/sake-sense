import fixtureData from "./data/ishikawa-sake-sample.v0.1.json";

export type RuntimeSakeProduct = (typeof fixtureData.products)[number];
export type RuntimeSakeEvidence = RuntimeSakeProduct["termReferences"][number];

let products: RuntimeSakeProduct[] = [...fixtureData.products];

export function getSakeProducts(): readonly RuntimeSakeProduct[] {
  return products;
}

export function setSakeProducts(next: readonly RuntimeSakeProduct[]): void {
  products = [...next];
}

export function resetSakeProducts(): void {
  products = [...fixtureData.products];
}
