import type { RuntimeSakeEvidence, RuntimeSakeProduct } from "../domain/sake-catalog";

export type PublicSakeProduct = Omit<RuntimeSakeProduct, "termReferences"> & {
  termReferences: RuntimeSakeEvidence[];
};
export type PublicSakeSource = {
  id: string;
  sourceName: string;
  title?: string;
  url: string;
  sourceType?: string;
  reviewedAt?: string;
  category?: "terminology" | "product" | "shared";
};
export type PublicSakeBrewery = {
  id: string;
  name: string;
  displayName?: string;
  region?: string;
  officialUrl?: string;
  status?: string;
};

type Collection<T> = { items: T[] };

export type PublicSakeCatalog = {
  products: PublicSakeProduct[];
  sources: PublicSakeSource[];
  breweries: PublicSakeBrewery[];
};

export type SakeDataClient = {
  loadCatalog(): Promise<PublicSakeCatalog>;
  loadProducts(): Promise<PublicSakeProduct[]>;
  loadBreweries(): Promise<PublicSakeBrewery[]>;
  loadSources(): Promise<PublicSakeSource[]>;
};

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function createApiSakeDataClient(baseUrl: string, fetcher = fetch): SakeDataClient {
  async function get<T>(path: string): Promise<T> {
    const response = await fetcher(endpoint(baseUrl, path));
    if (!response.ok) throw new Error(`Sake data API request failed (${response.status})`);
    return (await response.json()) as T;
  }
  const loadCatalog = () => get<PublicSakeCatalog>("/api/catalog");
  return {
    loadCatalog,
    async loadProducts() {
      const { products } = await loadCatalog();
      return products;
    },
    async loadSources() {
      const { items } = await get<Collection<PublicSakeSource>>("/api/sources");
      return items;
    },
    async loadBreweries() {
      const { items } = await get<Collection<PublicSakeBrewery>>("/api/breweries");
      return items;
    },
  };
}
