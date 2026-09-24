import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, Plus, Save } from "lucide-react";
import {
  completeAdminLogin,
  getAdminSession,
  logoutAdmin,
  startAdminLogin,
  type AdminSession,
} from "./admin-auth";

type AdminCollection = "products" | "breweries" | "sources" | "evidence";
type RecordItem = Record<string, unknown> & { id?: string; status?: string; updatedAt?: string };
const FORM_FIELDS: Record<AdminCollection, readonly string[]> = {
  products: [
    "name",
    "breweryId",
    "region",
    "descriptionSummary",
    "availabilityStatus",
    "primarySourceId",
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

function apiBase(): string {
  return ((import.meta.env.VITE_SAKE_DATA_API_BASE_URL as string | undefined) ?? "").replace(
    /\/$/,
    "",
  );
}

function AdminLogin({
  callback,
  onAuthenticated,
}: {
  callback: boolean;
  onAuthenticated: (session: AdminSession) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!callback) return;
    void completeAdminLogin()
      .then((session) => {
        onAuthenticated(session);
        window.history.replaceState({}, "", "/admin");
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Login failed"),
      );
  }, [callback, onAuthenticated]);
  return (
    <main className="admin-page">
      <h1>Sake Sense 管理画面</h1>
      <p>管理者アカウントでログインしてください。</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button button--primary"
        type="button"
        onClick={() =>
          void startAdminLogin().catch((reason: unknown) =>
            setError(reason instanceof Error ? reason.message : "Login unavailable"),
          )
        }
      >
        Cognitoでログイン
      </button>
    </main>
  );
}

function AdminCollectionPage({
  collection,
  token,
  onLogout,
  detailId,
}: {
  collection: AdminCollection;
  token: string;
  onLogout: () => void;
  detailId?: string;
}) {
  const [items, setItems] = useState<RecordItem[]>([]);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const label =
    collection === "products"
      ? "商品"
      : collection === "breweries"
        ? "酒蔵"
        : collection === "sources"
          ? "出典"
          : "商品エビデンス";
  const load = useCallback(async () => {
    const response = await fetch(`${apiBase()}/admin/${collection}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`読み込みに失敗しました (${response.status})`);
    const body = (await response.json()) as { items: RecordItem[] };
    setItems(body.items);
    if (detailId) {
      const detailResponse = await fetch(`${apiBase()}/admin/${collection}/${detailId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (detailResponse.ok) setSelected((await detailResponse.json()) as RecordItem);
    }
  }, [collection, detailId, token]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : "読み込みに失敗しました"),
    );
  }, [load]);
  const filtered = useMemo(
    () => items.filter((item) => JSON.stringify(item).toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  const save = async () => {
    if (!selected) return;
    const hasId = Boolean(selected.id);
    const response = await fetch(
      `${apiBase()}/admin/${collection}${hasId ? `/${encodeURIComponent(selected.id as string)}` : ""}`,
      {
        method: hasId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(selected),
      },
    );
    if (!response.ok) {
      setError(`保存に失敗しました (${response.status})`);
      return;
    }
    await load();
    setSelected(null);
  };
  return (
    <main className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="eyebrow">Sake Sense Admin</p>
          <h1>{label}管理</h1>
        </div>
        <button className="icon-text-button" type="button" aria-label="Log out" onClick={onLogout}>
          <LogOut size={16} />
          ログアウト
        </button>
      </header>
      <nav className="admin-page__nav" aria-label="Admin sections">
        {(["products", "breweries", "sources", "evidence"] as const).map((section) => (
          <a key={section} href={`/admin/${section}`}>
            {section}
          </a>
        ))}
      </nav>
      <div className="admin-page__toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="検索"
          aria-label="検索"
        />
        <button
          className="button button--secondary"
          type="button"
          aria-label="Create new record"
          onClick={() => setSelected({ status: "draft" })}
        >
          <Plus size={16} />
          新規作成
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-page__content">
        <section className="admin-list">
          {filtered.map((item) => (
            <button
              className="admin-list__item"
              type="button"
              key={String(item.id)}
              onClick={() => setSelected(item)}
            >
              <strong>{String(item.name ?? item.sourceName ?? item.termId ?? item.id)}</strong>
              {collection === "products" && (
                <>
                  <span>{String(item.breweryName ?? item.breweryId ?? "-")}</span>
                  <span>{String(item.availabilityStatus ?? "-")}</span>
                </>
              )}
              <span>
                {String(item.status ?? "-")} · {String(item.updatedAt ?? "-")}
              </span>
            </button>
          ))}
        </section>
        {selected && (
          <section className="admin-editor">
            <label>
              ID
              <input value={String(selected.id ?? "")} disabled onChange={() => undefined} />
            </label>
            {FORM_FIELDS[collection].map((field) => (
              <label key={field}>
                {field}
                <input
                  value={String(selected[field] ?? "")}
                  onChange={(event) => setSelected({ ...selected, [field]: event.target.value })}
                />
              </label>
            ))}
            <button
              className="button button--primary"
              type="button"
              aria-label="Save record"
              onClick={() => void save()}
            >
              <Save size={16} />
              保存
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

export function AdminApp() {
  const [session, setSession] = useState<AdminSession | null>(getAdminSession);
  const path = window.location.pathname;
  if (!session)
    return <AdminLogin callback={path === "/admin/callback"} onAuthenticated={setSession} />;
  const collection = path.startsWith("/admin/breweries")
    ? "breweries"
    : path.startsWith("/admin/sources")
      ? "sources"
      : path.startsWith("/admin/evidence")
        ? "evidence"
        : "products";
  return (
    <AdminCollectionPage
      collection={collection}
      token={session.accessToken}
      detailId={path.split("/")[3]}
      onLogout={() => {
        logoutAdmin();
        setSession(null);
      }}
    />
  );
}
