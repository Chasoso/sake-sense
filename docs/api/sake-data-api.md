# Sake data API contract

The API is served by the independent data-platform HTTP API. `VITE_SAKE_DATA_API_BASE_URL` is deployment configuration; no production URL is hardcoded.

Public unauthenticated routes:

- `GET /api/products`
- `GET /api/products/{productId}`
- `GET /api/breweries`
- `GET /api/breweries/{breweryId}`
- `GET /api/sources`
- `GET /api/products/{productId}/evidence`

Only `published` records are returned. Responses are DTOs, not DynamoDB items. Missing detail records return `404 {"error":"not_found"}`; malformed or unexpected server failures return a sanitized `500`.

Admin routes are under `/admin/{products|breweries|sources|evidence}` and require a Cognito access token with membership in the `admin` group. The handler validates explicit fields and never accepts arbitrary DynamoDB attributes. Publication is rejected when references, URL/date fields, source wording, evidence status, or lifecycle constraints are invalid.
