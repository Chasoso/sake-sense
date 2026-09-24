import { useEffect, useState } from "react";
import { ExperimentModes } from "../features/experiment/ExperimentModes";
import {
  UiInventoryHarness,
  type UiInventoryState,
} from "../features/inventory/UiInventoryHarness";
import { setSakeProducts } from "../domain/sake-catalog";
import { createApiSakeDataClient } from "../infrastructure/sake-data-client";
import {
  setProductSourceEntries,
  setProductSourceProducts,
} from "../features/sources/source-aggregation";
import { AdminApp } from "../features/admin/AdminApp";

function getInventoryState(): UiInventoryState | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const state = new URLSearchParams(window.location.search).get("uiInventory");
  const states: UiInventoryState[] = [
    "body-loading",
    "body-ready",
    "body-countdown",
    "body-capturing",
    "body-replay",
    "body-result",
    "body-no-match",
    "body-denied",
    "voice-initial",
    "voice-recording",
    "voice-analyzing",
    "voice-result",
    "voice-no-match",
    "gesture-initial",
    "gesture-drawing",
    "gesture-result",
    "sources",
  ];
  return states.includes(state as UiInventoryState) ? (state as UiInventoryState) : null;
}

export function App() {
  const inventoryState = getInventoryState();
  const apiBaseUrl = (import.meta.env.VITE_SAKE_DATA_API_BASE_URL as string | undefined)?.trim();
  const [dataState, setDataState] = useState<"ready" | "loading" | "empty" | "error">(
    apiBaseUrl ? "loading" : "ready",
  );

  useEffect(() => {
    if (!apiBaseUrl) return;
    let active = true;
    const client = createApiSakeDataClient(apiBaseUrl);
    void client
      .loadCatalog()
      .then(({ products, sources, breweries }) => {
        if (!active) return;
        setSakeProducts(products);
        setProductSourceProducts(products);
        setProductSourceEntries(sources.map((source) => ({ ...source, key: source.id })));
        setDataState(
          products.length === 0 || sources.length === 0 || breweries.length === 0
            ? "empty"
            : "ready",
        );
      })
      .catch(() => {
        if (active) setDataState("error");
      });
    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  if (inventoryState) return <UiInventoryHarness state={inventoryState} />;
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin"))
    return <AdminApp />;
  if (dataState === "loading")
    return (
      <main className="experience-screen">
        <p role="status">情報を読み込んでいます。</p>
      </main>
    );
  if (dataState === "error")
    return (
      <main className="experience-screen">
        <p className="form-error" role="alert">
          情報を読み込めませんでした。時間をおいてもう一度お試しください。
        </p>
      </main>
    );
  if (dataState === "empty")
    return (
      <main className="experience-screen">
        <p role="status">Sake data is currently unavailable.</p>
      </main>
    );
  return <ExperimentModes />;
}
