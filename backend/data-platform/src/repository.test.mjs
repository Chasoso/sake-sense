import { describe, expect, it } from "vitest";
import { createDynamoRepository } from "./repository.mjs";

describe("Dynamo repository access patterns", () => {
  it("uses GetItem for detail reads", async () => {
    const calls = [];
    const client = {
      send: async (command) => {
        calls.push(command);
        return { Item: { id: "p1", status: "published" } };
      },
    };
    const repository = createDynamoRepository({
      documentClient: client,
      tableNames: { products: "products" },
    });
    await expect(repository.get("products", "p1", { publishedOnly: true })).resolves.toEqual({
      id: "p1",
      status: "published",
    });
    expect(calls[0].constructor.name).toBe("GetCommand");
  });

  it("follows paginated scans and filters published records", async () => {
    let count = 0;
    const client = {
      send: async () => {
        count += 1;
        return count === 1
          ? { Items: [{ id: "draft", status: "draft" }], LastEvaluatedKey: { id: "draft" } }
          : { Items: [{ id: "published", status: "published" }] };
      },
    };
    const repository = createDynamoRepository({
      documentClient: client,
      tableNames: { products: "products" },
    });
    await expect(repository.list("products", { publishedOnly: true })).resolves.toEqual([
      { id: "published", status: "published" },
    ]);
    expect(count).toBe(2);
  });
});
