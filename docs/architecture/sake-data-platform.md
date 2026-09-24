# Sake data platform

The editable sake master data platform is an independent stack from the existing static website and semantic bridge. The stack is intentionally on-demand and multi-table:

| Table           | Key  | Indexes           | Public lifecycle |
| --------------- | ---- | ----------------- | ---------------- |
| Breweries       | `id` | none              | `published` only |
| Products        | `id` | none              | `published` only |
| Sources         | `id` | none              | `published` only |
| ProductEvidence | `id` | `productId-index` | `published` only |

All records carry `status` (`draft`, `published`, or `archived`), `createdAt`, `updatedAt`, and an audit object. References are validated by the write boundary: products reference active breweries and sources, and evidence references active products, terms, and sources. The sensory dictionary remains a curated application definition and is not moved to DynamoDB.

The public Lambda returns explicit DTOs and removes audit/timestamp internals. The admin Lambda accepts mapped fields only and is behind the HTTP API JWT authorizer plus a server-side `admin` group check. Public routes are read-only; admin routes are authenticated and write-capable. Detail reads use DynamoDB `GetItem`; list reads currently use paginated `Scan` because this curated dataset is small, and evidence uses the product GSI with pagination.

Infrastructure is defined in `infra/aws/data-admin.yaml`. It is a separate stack and does not alter the existing static-hosting or semantic-bridge stacks.
