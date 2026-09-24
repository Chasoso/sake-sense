const STORAGE_KEY = "sake-sense-admin-session";

type AdminSession = { accessToken: string; idToken?: string; expiresAt: number };

function randomString(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function getAdminConfig() {
  const domain = (import.meta.env.VITE_COGNITO_DOMAIN as string | undefined)?.trim();
  const clientId = (import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined)?.trim();
  const redirectUri =
    (import.meta.env.VITE_COGNITO_REDIRECT_URI as string | undefined)?.trim() ||
    `${window.location.origin}/admin/callback`;
  const logoutUri =
    (import.meta.env.VITE_COGNITO_LOGOUT_URI as string | undefined)?.trim() ||
    `${window.location.origin}/admin/login`;
  return { domain, clientId, redirectUri, logoutUri };
}

export async function startAdminLogin(): Promise<void> {
  const config = getAdminConfig();
  if (!config.domain || !config.clientId) throw new Error("Cognito admin configuration is missing");
  const state = randomString();
  const verifier = randomString();
  const challenge = await sha256(verifier);
  sessionStorage.setItem("sake-sense-admin-pkce", JSON.stringify({ state, verifier }));
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "openid email",
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  window.location.assign(`${config.domain.replace(/\/$/, "")}/oauth2/authorize?${params}`);
}

export async function completeAdminLogin(): Promise<AdminSession> {
  const config = getAdminConfig();
  const code = new URLSearchParams(window.location.search).get("code");
  const stored = JSON.parse(sessionStorage.getItem("sake-sense-admin-pkce") ?? "null") as {
    state: string;
    verifier: string;
  } | null;
  if (!code || !stored || stored.state !== new URLSearchParams(window.location.search).get("state"))
    throw new Error("Invalid Cognito callback state");
  const response = await fetch(`${config.domain?.replace(/\/$/, "")}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId ?? "",
      code,
      redirect_uri: config.redirectUri,
      code_verifier: stored.verifier,
    }),
  });
  if (!response.ok) throw new Error("Cognito login failed");
  const token = (await response.json()) as {
    access_token: string;
    id_token?: string;
    expires_in?: number;
  };
  const session = {
    accessToken: token.access_token,
    idToken: token.id_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  sessionStorage.removeItem("sake-sense-admin-pkce");
  return session;
}

export function getAdminSession(): AdminSession | null {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as AdminSession | null;
    if (!session || session.expiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function logoutAdmin(): void {
  localStorage.removeItem(STORAGE_KEY);
  const { domain, clientId, logoutUri } = getAdminConfig();
  if (domain && clientId) {
    const params = new URLSearchParams({ client_id: clientId, logout_uri: logoutUri });
    window.location.assign(`${domain.replace(/\/$/, "")}/logout?${params}`);
  } else {
    window.history.pushState({}, "", "/admin/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
