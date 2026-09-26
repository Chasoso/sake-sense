import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, Plus, Save, Search } from "lucide-react";
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

const COLLECTION_LABELS: Record<AdminCollection, string> = {
  products: "商品",
  breweries: "酒蔵",
  sources: "出典",
  evidence: "Evidence",
};

const FIELD_LABELS: Record<string, string> = {
  name: "商品名",
  breweryId: "酒蔵",
  region: "地域",
  descriptionSummary: "説明サマリー",
  availabilityStatus: "流通状況",
  primarySourceId: "一次出典",
  status: "公開状態",
  displayName: "表示名",
  officialUrl: "公式URL",
  sourceName: "出典名",
  title: "タイトル",
  url: "URL",
  reviewedAt: "確認日",
  sourceType: "出典種別",
  productId: "商品",
  termId: "用語",
  sourceId: "出典",
  sourceWording: "出典の表現",
  evidenceStatus: "Evidence状態",
  rationale: "理由",
};

function apiBase(): string {
  return ((import.meta.env.VITE_SAKE_DATA_API_BASE_URL as string | undefined) ?? "").replace(
    /\/$/,
    "",
  );
}

function displayName(item: RecordItem, fallback = "-"): string {
  return String(
    item.displayName ?? item.name ?? item.sourceName ?? item.title ?? item.id ?? fallback,
  );
}

function statusLabel(value: string): string {
  return (
    (
      {
        published: "公開中",
        draft: "下書き",
        archived: "アーカイブ",
        regular: "通常",
        seasonal: "季節限定",
        unknown: "不明",
      } as Record<string, string>
    )[value] ?? value
  );
}

function StatusBadge({ value, kind }: { value: unknown; kind: "status" | "availability" }) {
  const normalized = String(value ?? "unknown");
  return (
    <span className={`admin-badge admin-badge--${kind}-${normalized}`}>
      {statusLabel(normalized)}
      <span className="admin-badge__value">{normalized}</span>
    </span>
  );
}

function AdminTabs({ collection }: { collection: AdminCollection }) {
  return (
    <nav className="admin-tabs" aria-label="Admin sections" role="tablist">
      {(Object.keys(COLLECTION_LABELS) as AdminCollection[]).map((section) => (
        <a
          className={`admin-tabs__tab${collection === section ? " admin-tabs__tab--active" : ""}`}
          key={section}
          href={`/admin/${section}`}
          aria-current={collection === section ? "page" : undefined}
          role="tab"
        >
          {COLLECTION_LABELS[section]}
        </a>
      ))}
    </nav>
  );
}

function AdminSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="admin-section-card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Field({
  field,
  value,
  children,
  onChange,
  multiline = false,
  disabled = false,
}: {
  field: string;
  value?: string;
  children?: React.ReactNode;
  onChange?: (value: string) => void;
  multiline?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="admin-field">
      <span>{FIELD_LABELS[field] ?? field}</span>
      {children ??
        (multiline ? (
          <textarea
            aria-label={field}
            value={value ?? ""}
            disabled={disabled}
            onChange={(event) => onChange?.(event.target.value)}
          />
        ) : (
          <input
            aria-label={field}
            value={value ?? ""}
            disabled={disabled}
            onChange={(event) => onChange?.(event.target.value)}
          />
        ))}
    </label>
  );
}

function SelectField({
  field,
  value,
  options,
  onChange,
}: {
  field: string;
  value?: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Field field={field}>
      <select
        aria-label={field}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">選択してください</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
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
        setError(reason instanceof Error ? reason.message : "ログインに失敗しました"),
      );
  }, [callback, onAuthenticated]);
  return (
    <main className="admin-page">
      <h1>Sake Sense Admin</h1>
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
            setError(reason instanceof Error ? reason.message : "ログインを開始できません"),
          )
        }
      >
        Cognitoでログイン
      </button>
    </main>
  );
}

function ProductTable({
  items,
  selectedId,
  onSelect,
}: {
  items: readonly RecordItem[];
  selectedId?: string;
  onSelect: (item: RecordItem) => void;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <caption className="sr-only">商品一覧</caption>
        <thead>
          <tr>
            <th scope="col">商品名</th>
            <th scope="col">酒蔵</th>
            <th scope="col">流通状況</th>
            <th scope="col">公開状態</th>
            <th scope="col">更新日時</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              className={selectedId === String(item.id) ? "admin-table__row--selected" : undefined}
              key={String(item.id)}
            >
              <td>
                <button
                  className="admin-table__select"
                  type="button"
                  onClick={() => onSelect(item)}
                >
                  {displayName(item)}
                </button>
              </td>
              <td>{String(item.breweryName ?? item.breweryId ?? "-")}</td>
              <td>
                <StatusBadge value={item.availabilityStatus} kind="availability" />
              </td>
              <td>
                <StatusBadge value={item.status} kind="status" />
              </td>
              <td>{String(item.updatedAt ?? "-")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p className="admin-empty">該当する商品がありません。</p>}
    </div>
  );
}

function ProductEditor({
  selected,
  breweries,
  sources,
  onChange,
  onSave,
}: {
  selected: RecordItem;
  breweries: readonly RecordItem[];
  sources: readonly RecordItem[];
  onChange: (field: string, value: string) => void;
  onSave: () => void;
}) {
  const breweryOptions = breweries.map((item) => ({
    value: String(item.id ?? ""),
    label: displayName(item),
  }));
  const sourceOptions = sources.map((item) => ({
    value: String(item.id ?? ""),
    label: `${displayName(item)}${item.title ? ` - ${String(item.title)}` : ""}`,
  }));
  const statusOptions = [
    { value: "draft", label: "下書き" },
    { value: "published", label: "公開中" },
    { value: "archived", label: "アーカイブ" },
  ];
  const availabilityOptions = [
    { value: "regular", label: "通常" },
    { value: "seasonal", label: "季節限定" },
    { value: "unknown", label: "不明" },
  ];
  return (
    <section className="admin-editor">
      <div className="admin-editor__heading">
        <div>
          <p className="eyebrow">Product editor</p>
          <h2>{selected.name ? `${String(selected.name)}を編集` : "新しい商品"}</h2>
        </div>
        <button
          className="button button--primary"
          type="button"
          aria-label="Save record"
          onClick={onSave}
        >
          <Save size={16} />
          保存
        </button>
      </div>
      <AdminSection title="基本情報">
        <Field field="id" value={String(selected.id ?? "（保存時に発行）")} disabled />
        <Field
          field="name"
          value={String(selected.name ?? "")}
          onChange={(value) => onChange("name", value)}
        />
      </AdminSection>
      <AdminSection title="酒蔵・地域">
        <SelectField
          field="breweryId"
          value={String(selected.breweryId ?? "")}
          options={breweryOptions}
          onChange={(value) => onChange("breweryId", value)}
        />
        <Field
          field="region"
          value={String(selected.region ?? "")}
          onChange={(value) => onChange("region", value)}
        />
      </AdminSection>
      <AdminSection title="説明">
        <Field
          field="descriptionSummary"
          value={String(selected.descriptionSummary ?? "")}
          multiline
          onChange={(value) => onChange("descriptionSummary", value)}
        />
      </AdminSection>
      <AdminSection title="公開設定">
        <div className="admin-field-grid">
          <SelectField
            field="availabilityStatus"
            value={String(selected.availabilityStatus ?? "unknown")}
            options={availabilityOptions}
            onChange={(value) => onChange("availabilityStatus", value)}
          />
          <SelectField
            field="status"
            value={String(selected.status ?? "draft")}
            options={statusOptions}
            onChange={(value) => onChange("status", value)}
          />
        </div>
        <div className="admin-editor__status-preview">
          <span>現在の状態</span>
          <StatusBadge value={selected.status} kind="status" />
          <StatusBadge value={selected.availabilityStatus} kind="availability" />
        </div>
      </AdminSection>
      <AdminSection title="出典">
        <SelectField
          field="primarySourceId"
          value={String(selected.primarySourceId ?? "")}
          options={sourceOptions}
          onChange={(value) => onChange("primarySourceId", value)}
        />
      </AdminSection>
    </section>
  );
}

function GenericEditor({
  collection,
  selected,
  onChange,
  onSave,
}: {
  collection: AdminCollection;
  selected: RecordItem;
  onChange: (field: string, value: string) => void;
  onSave: () => void;
}) {
  return (
    <section className="admin-editor">
      <div className="admin-editor__heading">
        <h2>
          {selected.id
            ? `${COLLECTION_LABELS[collection]}を編集`
            : `新しい${COLLECTION_LABELS[collection]}`}
        </h2>
        <button
          className="button button--primary"
          type="button"
          aria-label="Save record"
          onClick={onSave}
        >
          <Save size={16} />
          保存
        </button>
      </div>
      <AdminSection title="基本情報">
        <Field field="id" value={String(selected.id ?? "（保存時に発行）")} disabled />
        {FORM_FIELDS[collection].map((field) => (
          <Field
            field={field}
            key={field}
            value={String(selected[field] ?? "")}
            onChange={(value) => onChange(field, value)}
          />
        ))}
      </AdminSection>
    </section>
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
  const [breweries, setBreweries] = useState<RecordItem[]>([]);
  const [sources, setSources] = useState<RecordItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const loadOptions = useCallback(
    async (optionCollection: "breweries" | "sources") => {
      try {
        const response = await fetch(`${apiBase()}/admin/${optionCollection}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return [];
        return ((await response.json()) as { items?: RecordItem[] }).items ?? [];
      } catch {
        return [];
      }
    },
    [token],
  );
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
    if (collection === "products") {
      const [nextBreweries, nextSources] = await Promise.all([
        loadOptions("breweries"),
        loadOptions("sources"),
      ]);
      setBreweries(nextBreweries);
      setSources(nextSources);
    }
  }, [collection, detailId, loadOptions, token]);
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
    const saved = (await response.json()) as RecordItem;
    await load();
    setSelected(saved);
  };
  const updateSelected = (field: string, value: string) =>
    setSelected((current) => (current ? { ...current, [field]: value } : current));
  return (
    <main className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="eyebrow">Sake Sense Admin</p>
          <h1>{COLLECTION_LABELS[collection]}管理</h1>
        </div>
        <button className="icon-text-button" type="button" aria-label="Log out" onClick={onLogout}>
          <LogOut size={16} />
          ログアウト
        </button>
      </header>
      <AdminTabs collection={collection} />
      <div className="admin-page__toolbar">
        <label className="admin-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">商品を検索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="検索"
            aria-label="検索"
          />
        </label>
        <button
          className="button button--secondary"
          type="button"
          aria-label="Create new record"
          onClick={() =>
            setSelected(
              collection === "products"
                ? { status: "draft", availabilityStatus: "unknown" }
                : { status: "draft" },
            )
          }
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
      <div
        className={`admin-page__content${collection === "products" ? " admin-page__content--products" : ""}`}
      >
        <section className="admin-list">
          <h2>{COLLECTION_LABELS[collection]}一覧</h2>
          {collection === "products" ? (
            <ProductTable items={filtered} selectedId={selected?.id} onSelect={setSelected} />
          ) : (
            <div className="admin-list__legacy">
              {filtered.map((item) => (
                <button
                  className={`admin-list__item${selected?.id === item.id ? " admin-list__item--selected" : ""}`}
                  type="button"
                  key={String(item.id)}
                  onClick={() => setSelected(item)}
                >
                  <strong>{displayName(item)}</strong>
                  <span>{String(item.status ?? "-")}</span>
                </button>
              ))}
            </div>
          )}
        </section>
        {selected &&
          (collection === "products" ? (
            <ProductEditor
              selected={selected}
              breweries={breweries}
              sources={sources}
              onChange={updateSelected}
              onSave={() => void save()}
            />
          ) : (
            <GenericEditor
              collection={collection}
              selected={selected}
              onChange={updateSelected}
              onSave={() => void save()}
            />
          ))}
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
