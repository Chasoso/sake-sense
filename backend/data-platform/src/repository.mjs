import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE_ENV = {
  breweries: "BREWERIES_TABLE_NAME",
  products: "PRODUCTS_TABLE_NAME",
  sources: "SOURCES_TABLE_NAME",
  evidence: "PRODUCT_EVIDENCE_TABLE_NAME",
};

export function createDynamoRepository({ client = new DynamoDBClient({}), tableNames = {} } = {}) {
  const documentClient = DynamoDBDocumentClient.from(client);
  const table = (name) => tableNames[name] || process.env[TABLE_ENV[name]];
  const requireTable = (name) => {
    const value = table(name);
    if (!value) throw new Error(`Missing table configuration for ${name}`);
    return value;
  };
  return {
    async list(name, { publishedOnly = false } = {}) {
      const input = { TableName: requireTable(name) };
      const result = await documentClient.send(new ScanCommand(input));
      return (result.Items ?? []).filter((item) => !publishedOnly || item.status === "published");
    },
    async get(name, id, { publishedOnly = false } = {}) {
      const items = await this.list(name, { publishedOnly });
      return items.find((item) => item.id === id) ?? null;
    },
    async listEvidenceForProduct(productId, { publishedOnly = false } = {}) {
      const result = await documentClient.send(
        new QueryCommand({
          TableName: requireTable("evidence"),
          IndexName: "productId-index",
          KeyConditionExpression: "productId = :productId",
          ExpressionAttributeValues: { ":productId": productId },
        }),
      );
      return (result.Items ?? []).filter((item) => !publishedOnly || item.status === "published");
    },
    async put(name, item) {
      await documentClient.send(new PutCommand({ TableName: requireTable(name), Item: item }));
      return item;
    },
    async remove(name, id) {
      await documentClient.send(new DeleteCommand({ TableName: requireTable(name), Key: { id } }));
    },
  };
}

export function createMemoryRepository(initial = {}) {
  const state = new Map(Object.entries(initial).map(([name, items]) => [name, [...items]]));
  const list = async (name, { publishedOnly = false } = {}) =>
    (state.get(name) ?? []).filter((item) => !publishedOnly || item.status === "published");
  return {
    list,
    async get(name, id, options) {
      return (await list(name, options)).find((item) => item.id === id) ?? null;
    },
    async listEvidenceForProduct(productId, options) {
      return (await list("evidence", options)).filter((item) => item.productId === productId);
    },
    async put(name, item) {
      const items = state.get(name) ?? [];
      const index = items.findIndex((entry) => entry.id === item.id);
      if (index >= 0) items[index] = item;
      else items.push(item);
      state.set(name, items);
      return item;
    },
    async remove(name, id) {
      state.set(
        name,
        (state.get(name) ?? []).filter((item) => item.id !== id),
      );
    },
  };
}
