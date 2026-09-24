import { ExperimentModes } from "../features/experiment/ExperimentModes";
import {
  UiInventoryHarness,
  type UiInventoryState,
} from "../features/inventory/UiInventoryHarness";

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
  if (inventoryState) return <UiInventoryHarness state={inventoryState} />;
  return <ExperimentModes />;
}
