import { getShellStatus } from "../domain/shell";
import { Shell } from "../features/shell/Shell";

export function App() {
  return <Shell status={getShellStatus()} />;
}
