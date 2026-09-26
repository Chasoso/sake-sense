import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExperienceBrand } from "./ExperienceBrand";

describe("ExperienceBrand", () => {
  it("renders a keyboard-accessible home button when a callback is provided", () => {
    const markup = renderToStaticMarkup(<ExperienceBrand onHome={() => undefined} />);

    expect(markup).toContain("<button");
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-label="トップへ戻る"');
    expect(markup).toContain('alt=""');
    expect(markup).toContain("experience-screen__brand-logo");
  });

  it("preserves the noninteractive image form without a callback", () => {
    const markup = renderToStaticMarkup(<ExperienceBrand />);

    expect(markup).not.toContain("experience-screen__brand-button");
    expect(markup).toContain('alt="Sake Sense"');
  });
});
