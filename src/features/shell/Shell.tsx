import type { ShellStatus } from "../../domain/shell";

type ShellProps = {
  status: ShellStatus;
};

export function Shell({ status }: ShellProps) {
  return (
    <main className="shell" aria-labelledby="shell-title">
      <div className="shell__card">
        <p className="shell__eyebrow">Local development shell</p>
        <h1 id="shell-title">{status.name}</h1>
        <p className="shell__message">{status.message}</p>
        <p className="shell__note">
          Product experiments will take shape here. This placeholder intentionally
          keeps the final experience open.
        </p>
      </div>
    </main>
  );
}
