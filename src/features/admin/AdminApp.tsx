import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, Plus, Save, Search } from "lucide-react";
import {
  completeAdminLogin,
  getAdminSession,
  logoutAdmin,
  startAdminLogin,
  type AdminSession,
} from "./admin-auth";
import { displayName, relationLabel, selectOptions, statusLabel } from "./admin-presentation";

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

function StatusBadge({
  value,
  kind,
}: {
  value: unknown;
  kind: "status" | "availability" | "evidence";
}) {
  const normalized = String(value ?? "unknown");
  return (
    <span className={`admin-badge admin-badge--${kind}-${normalized}`}>
      {statusLabel(normalized)}
    </span>
  );
}

function AdminTabs({ collection }: { collection: AdminCollection }) {
  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      {(Object.keys(COLLECTION_LABELS) as AdminCollection[]).map((section) => (
        <a
          className={`admin-tabs__tab${collection === section ? " admin-tabs__tab--active" : ""}`}
          key={section}
          href={`/admin/${section}`}
          aria-current={collection === section ? "page" : undefined}
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
  breweries,
  selectedId,
  onSelect,
}: {
  items: readonly RecordItem[];
  breweries: readonly RecordItem[];
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
              <td>{relationLabel(breweries, item.breweryId)}</td>
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
  const breweryOptions = selectOptions(breweries);
  const sourceOptions = selectOptions(sources).map((option) => {
    const source = sources.find((item) => String(item.id) === option.value);
    return {
      ...option,
      label: `${option.label}${source?.title ? ` - ${String(source.title)}` : ""}`,
    };
  });
  const statusOptions = ["draft", "published", "archived"].map((value) => ({
    value,
    label: statusLabel(value),
  }));
  const availabilityOptions = ["regular", "seasonal", "unknown"].map((value) => ({
    value,
    label: statusLabel(value),
  }));
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

const lifecycleOptions = ["draft", "published", "archived"].map((value) => ({
  value,
  label: statusLabel(value),
}));

function CollectionTable({
  collection,
  items,
  products,
  sources,
  selectedId,
  onSelect,
}: {
  collection: AdminCollection;
  items: readonly RecordItem[];
  products: readonly RecordItem[];
  sources: readonly RecordItem[];
  selectedId?: string;
  onSelect: (item: RecordItem) => void;
}) {
  const columns =
    collection === "breweries"
      ? ["酒蔵名", "表示名", "地域", "公開状態", "更新日時"]
      : collection === "sources"
        ? ["出典名", "タイトル", "出典種別", "確認日", "公開状態", "更新日時"]
        : ["商品", "用語", "出典", "Evidence状態", "公開状態", "更新日時"];
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <caption className="sr-only">{COLLECTION_LABELS[collection]}一覧</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th scope="col" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const cells =
              collection === "breweries"
                ? [
                    displayName({ name: item.name, id: item.id }),
                    String(item.displayName ?? "-"),
                    String(item.region ?? "-"),
                    <StatusBadge key="status" value={item.status} kind="status" />,
                    String(item.updatedAt ?? "-"),
                  ]
                : collection === "sources"
                  ? [
                      String(item.sourceName ?? "-"),
                      String(item.title ?? "-"),
                      String(item.sourceType ?? "-"),
                      String(item.reviewedAt ?? "-"),
                      <StatusBadge key="status" value={item.status} kind="status" />,
                      String(item.updatedAt ?? "-"),
                    ]
                  : [
                      relationLabel(products, item.productId),
                      String(item.termId ?? "-"),
                      relationLabel(sources, item.sourceId),
                      <StatusBadge key="evidence" value={item.evidenceStatus} kind="evidence" />,
                      <StatusBadge key="status" value={item.status} kind="status" />,
                      String(item.updatedAt ?? "-"),
                    ];
            return (
              <tr
                className={
                  selectedId === String(item.id) ? "admin-table__row--selected" : undefined
                }
                key={String(item.id)}
              >
                <td>
                  <button
                    className="admin-table__select"
                    type="button"
                    onClick={() => onSelect(item)}
                  >
                    {cells[0]}
                  </button>
                </td>
                {cells.slice(1).map((cell, index) => (
                  <td key={`${String(item.id)}-${index}`}>{cell}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {items.length === 0 && <p className="admin-empty">該当する記録がありません。</p>}
    </div>
  );
}

function CollectionEditor({
  collection,
  selected,
  products,
  sources,
  onChange,
  onSave,
}: {
  collection: "breweries" | "sources" | "evidence";
  selected: RecordItem;
  products: readonly RecordItem[];
  sources: readonly RecordItem[];
  onChange: (field: string, value: string) => void;
  onSave: () => void;
}) {
  const heading = selected.id
    ? `${COLLECTION_LABELS[collection]}を編集`
    : `新しい${COLLECTION_LABELS[collection]}`;
  const productOptions = selectOptions(products);
  const sourceOptions = selectOptions(sources);
  const editor =
    collection === "breweries" ? (
      <>
        <AdminSection title="基本情報">
          <Field field="id" value={String(selected.id ?? "（保存時に発行）")} disabled />
          <Field
            field="name"
            value={String(selected.name ?? "")}
            onChange={(value) => onChange("name", value)}
          />
          <Field
            field="displayName"
            value={String(selected.displayName ?? "")}
            onChange={(value) => onChange("displayName", value)}
          />
        </AdminSection>
        <AdminSection title="地域">
          <Field
            field="region"
            value={String(selected.region ?? "")}
            onChange={(value) => onChange("region", value)}
          />
        </AdminSection>
        <AdminSection title="公式情報">
          <Field
            field="officialUrl"
            value={String(selected.officialUrl ?? "")}
            onChange={(value) => onChange("officialUrl", value)}
          />
        </AdminSection>
        <AdminSection title="公開設定">
          <SelectField
            field="status"
            value={String(selected.status ?? "draft")}
            options={lifecycleOptions}
            onChange={(value) => onChange("status", value)}
          />
        </AdminSection>
      </>
    ) : collection === "sources" ? (
      <>
        <AdminSection title="基本情報">
          <Field field="id" value={String(selected.id ?? "（保存時に発行）")} disabled />
          <Field
            field="sourceName"
            value={String(selected.sourceName ?? "")}
            onChange={(value) => onChange("sourceName", value)}
          />
          <Field
            field="title"
            value={String(selected.title ?? "")}
            onChange={(value) => onChange("title", value)}
          />
        </AdminSection>
        <AdminSection title="URL・種別">
          <Field
            field="url"
            value={String(selected.url ?? "")}
            onChange={(value) => onChange("url", value)}
          />
          <Field
            field="sourceType"
            value={String(selected.sourceType ?? "")}
            onChange={(value) => onChange("sourceType", value)}
          />
        </AdminSection>
        <AdminSection title="確認情報">
          <Field
            field="reviewedAt"
            value={String(selected.reviewedAt ?? "")}
            onChange={(value) => onChange("reviewedAt", value)}
          />
        </AdminSection>
        <AdminSection title="公開設定">
          <SelectField
            field="status"
            value={String(selected.status ?? "draft")}
            options={lifecycleOptions}
            onChange={(value) => onChange("status", value)}
          />
        </AdminSection>
      </>
    ) : (
      <>
        <AdminSection title="基本情報">
          <Field field="id" value={String(selected.id ?? "（保存時に発行）")} disabled />
          <SelectField
            field="productId"
            value={String(selected.productId ?? "")}
            options={productOptions}
            onChange={(value) => onChange("productId", value)}
          />
          <Field
            field="termId"
            value={String(selected.termId ?? "")}
            onChange={(value) => onChange("termId", value)}
          />
          <SelectField
            field="sourceId"
            value={String(selected.sourceId ?? "")}
            options={sourceOptions}
            onChange={(value) => onChange("sourceId", value)}
          />
        </AdminSection>
        <AdminSection title="Evidence内容">
          <Field
            field="sourceWording"
            value={String(selected.sourceWording ?? "")}
            multiline
            onChange={(value) => onChange("sourceWording", value)}
          />
          <SelectField
            field="evidenceStatus"
            value={String(selected.evidenceStatus ?? "")}
            options={["direct", "accepted-variant", "weak", "rejected"].map((value) => ({
              value,
              label: statusLabel(value),
            }))}
            onChange={(value) => onChange("evidenceStatus", value)}
          />
          <Field
            field="rationale"
            value={String(selected.rationale ?? "")}
            multiline
            onChange={(value) => onChange("rationale", value)}
          />
        </AdminSection>
        <AdminSection title="公開設定">
          <SelectField
            field="status"
            value={String(selected.status ?? "draft")}
            options={lifecycleOptions}
            onChange={(value) => onChange("status", value)}
          />
        </AdminSection>
      </>
    );
  return (
    <section className="admin-editor">
      <div className="admin-editor__heading">
        <div>
          <p className="eyebrow">{COLLECTION_LABELS[collection]} editor</p>
          <h2>{heading}</h2>
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
      {editor}
    </section>
  );
}

export function GenericEditor({
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
  const [products, setProducts] = useState<RecordItem[]>([]);
  const [breweries, setBreweries] = useState<RecordItem[]>([]);
  const [sources, setSources] = useState<RecordItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const loadOptions = useCallback(
    async (optionCollection: "products" | "breweries" | "sources") => {
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
    const optionCollections =
      collection === "products"
        ? (["breweries", "sources"] as const)
        : collection === "evidence"
          ? (["products", "sources"] as const)
          : ([] as const);
    const optionResults = await Promise.all(optionCollections.map(loadOptions));
    for (const [index, optionCollection] of optionCollections.entries()) {
      const result = optionResults[index];
      if (optionCollection === "products") setProducts(result);
      if (optionCollection === "breweries") setBreweries(result);
      if (optionCollection === "sources") setSources(result);
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
            <ProductTable
              items={filtered}
              breweries={breweries}
              selectedId={selected?.id}
              onSelect={setSelected}
            />
          ) : (
            <CollectionTable
              collection={collection}
              items={filtered}
              products={products}
              sources={sources}
              selectedId={selected?.id}
              onSelect={setSelected}
            />
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
            <CollectionEditor
              collection={collection}
              selected={selected}
              products={products}
              sources={sources}
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
