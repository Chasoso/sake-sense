import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SourcesPage } from "./SourcesPage";

describe("SourcesPage", () => {
  it("keeps verification details without rendering redundant metadata", () => {
    const markup = renderToStaticMarkup(<SourcesPage onBack={() => undefined} />);

    expect(markup).not.toContain("種類");
    expect(markup).not.toContain("同じ出典はまとめて表示しています。");
    expect(markup).toContain("確認日");
    expect(markup).toContain("出典ページを開く");
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noreferrer noopener"');
  });
});
