import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const { TABLE_NAME, BUCKET_NAME } = process.env;
const PENDING_MAX_AGE_MS = 60 * 60 * 1000;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return json(401, { message: "Unauthorized" });
  const pk = `USER#${sub}`;

  if (event.routeKey === "GET /documents") {
    const items = [];
    let ExclusiveStartKey;
    // A Query page is capped at 1 MB, so keep paging until the partition is exhausted.
    do {
      const page = await ddb.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
          ExpressionAttributeValues: { ":pk": pk, ":prefix": "DOC#" },
          ExclusiveStartKey,
        }),
      );
      items.push(...(page.Items ?? []));
      ExclusiveStartKey = page.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    const cutoff = Date.now() - PENDING_MAX_AGE_MS;
    const documents = items
      // TTL deletion can lag hours behind expiresAt, so stale pending rows are hidden here too.
      .filter((item) => !(item.status === "pending" && Date.parse(item.createdAt) < cutoff))
      // createdAt is always toISOString() output, so plain string order is chronological.
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .map(({ docId, filename, contentType, sizeBytes, status, createdAt }) => ({
        docId,
        filename,
        contentType,
        sizeBytes,
        status,
        createdAt,
      }));

    return json(200, { documents });
  }

  if (event.routeKey === "DELETE /documents/{id}") {
    const id = event.pathParameters?.id;
    if (!id) return json(400, { message: "id is required" });
    const sk = `DOC#${id}`;

    // Reading with the caller's own pk IS the ownership check: a document that
    // belongs to another user can never come back from this lookup.
    const { Item } = await ddb.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { pk, sk } }),
    );
    if (!Item) return json(404, { message: "Not found" });

    // S3 first. If the row delete then fails, the row still points at a missing
    // object and the user can retry. The reverse order can leave a billable
    // object that nothing references. DeleteObject still returns 204 when the
    // upload never happened, so pending rows delete cleanly too.
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: Item.s3Key }));
    await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { pk, sk } }));

    return { statusCode: 204 };
  }

  return json(404, { message: `Unsupported route: ${event.routeKey}` });
};
