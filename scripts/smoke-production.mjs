const required = [
  "SMOKE_APP_URL",
  "SMOKE_PUBLIC_API_URL",
  "SMOKE_ADMIN_API_URL",
  "SMOKE_ALLOWED_ORIGIN",
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing smoke configuration: ${name}`);
}

function url(value, label) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error(`${label} must use https`);
  return parsed;
}

const appUrl = url(process.env.SMOKE_APP_URL, "SMOKE_APP_URL");
const publicApiUrl = url(process.env.SMOKE_PUBLIC_API_URL, "SMOKE_PUBLIC_API_URL");
const adminApiUrl = url(process.env.SMOKE_ADMIN_API_URL, "SMOKE_ADMIN_API_URL");
const allowedOrigin = url(process.env.SMOKE_ALLOWED_ORIGIN, "SMOKE_ALLOWED_ORIGIN").origin;

async function request(target, options = {}) {
  const response = await fetch(target, options);
  if (!response.ok)
    throw new Error(`${options.method ?? "GET"} ${target} returned ${response.status}`);
  return response;
}

function headerTokens(response, name) {
  return (response.headers.get(name) ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

await request(appUrl);
await request(new URL("/api/products", publicApiUrl));

const preflight = await request(new URL("/admin/products", adminApiUrl), {
  method: "OPTIONS",
  headers: {
    Origin: allowedOrigin,
    "Access-Control-Request-Method": "GET",
    "Access-Control-Request-Headers": "authorization",
  },
});
if (preflight.headers.get("access-control-allow-origin") !== allowedOrigin) {
  throw new Error("Admin preflight did not return the configured allow-origin");
}
if (!headerTokens(preflight, "access-control-allow-methods").includes("get")) {
  throw new Error("Admin preflight did not allow GET");
}
if (!headerTokens(preflight, "access-control-allow-headers").includes("authorization")) {
  throw new Error("Admin preflight did not allow authorization header");
}

const unauthenticated = await fetch(new URL("/admin/products", adminApiUrl));
if (![401, 403].includes(unauthenticated.status)) {
  throw new Error(`Unauthenticated admin request returned ${unauthenticated.status}`);
}

console.log("Production smoke passed: frontend, public API, admin CORS, and admin protection.");
