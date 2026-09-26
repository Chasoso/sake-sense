# Sake data API contract

The API is served by the independent data-platform HTTP API. `VITE_SAKE_DATA_API_BASE_URL` is deployment configuration; no production URL is hardcoded.

Public unauthenticated routes:

- `GET /api/catalog`
- `GET /api/products`
- `GET /api/products/{productId}`
- `GET /api/breweries`
- `GET /api/breweries/{breweryId}`
- `GET /api/sources`
- `GET /api/products/{productId}/evidence`

Only `published` records are returned. Responses are DTOs, not DynamoDB items. Missing detail records return `404 {"error":"not_found"}`; malformed or unexpected server failures return a sanitized `500`. The product evidence endpoint also returns `404` when the parent product is missing or not published, rather than exposing evidence for a non-public parent.

`GET /api/catalog` is the frontend bootstrap endpoint. It returns `{ products, sources, breweries }`; each product includes its published `termReferences`. The associations are assembled inside the Lambda from published evidence, so the browser needs one request for the initial catalog and does not issue per-product evidence requests.

Admin routes are under `/admin/{products|breweries|sources|evidence}` and require a Cognito access token with membership in the `admin` group. `POST /admin/{collection}` creates a server-ID record; `PATCH /admin/{collection}/{id}` updates an existing record; `GET` supports both collection and detail routes. The handler validates explicit fields and never accepts arbitrary DynamoDB attributes. Publication is rejected when references, URL/date fields, source wording, evidence status, or lifecycle constraints are invalid. Published evidence requires both its product and source to be published, and the public evidence route hides evidence when its parent product is not published.

The API permits unauthenticated `OPTIONS /admin/{proxy+}` CORS preflight requests only. Actual admin `GET`, `POST`, and `PATCH` requests remain protected by the Cognito JWT authorizer, with the existing origin, method, and header policy unchanged.
