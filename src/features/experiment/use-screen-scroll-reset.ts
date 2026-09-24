import { useEffect } from "react";

export function useScreenScrollReset(transitionKey: unknown): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [transitionKey]);
}
