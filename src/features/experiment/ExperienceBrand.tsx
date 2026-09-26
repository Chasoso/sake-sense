import logoHorizontal from "../../assets/brand/logo-horizontal.png";

export function ExperienceBrand({ onHome }: { onHome?: () => void } = {}) {
  const logo = (
    <img
      className="experience-screen__brand-logo"
      src={logoHorizontal}
      alt={onHome ? "" : "Sake Sense"}
    />
  );

  if (!onHome) return logo;

  return (
    <button
      className="experience-screen__brand-button"
      type="button"
      onClick={onHome}
      aria-label="トップへ戻る"
    >
      {logo}
    </button>
  );
}
