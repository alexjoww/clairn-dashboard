import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const { TABLE_NAME } = process.env;

export const handler = async (event) => {
  const failures = [];

  for (const record of event.Records ?? []) {
    const rawKey = record.s3?.object?.key ?? "";
    let key;
    try {
      // S3 URL-encodes keys in notifications, with spaces as "+".
      key = decodeURIComponent(rawKey.replace(/\+/g, " "));
    } catch {
      console.warn(`Skipping record with undecodable key: ${rawKey}`);
      continue;
    }

    // Expected shape: users/<sub>/<docId>/<filename>
    const parts = key.split("/");
    const size = record.s3?.object?.size;
    if (
      parts.length !== 4 ||
      parts[0] !== "users" ||
      !parts[1] ||
      !parts[2] ||
      !parts[3] ||
      !Number.isInteger(size)
    ) {
      console.warn(`Skipping record with unexpected shape: key=${key} size=${size}`);
      continue;
    }
    const [, sub, docId] = parts;

    try {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk: `USER#${sub}`, sk: `DOC#${docId}` },
          // "status" is a DynamoDB reserved word, hence the #status alias.
          UpdateExpression: "SET #status = :uploaded, sizeBytes = :size REMOVE expiresAt",
          ConditionExpression: "attribute_exists(pk)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":uploaded": "uploaded", ":size": size },
        }),
      );
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        // No pending row: TTL already removed it, or the object was written
        // outside the upload flow. Nothing to update; do not fail the batch.
        console.warn(`No document record for ${key}; skipping`);
        continue;
      }
      console.error(`Failed to mark ${key} as uploaded`, err);
      failures.push(key);
    }
  }

  // Throw only after every record has had its turn, so a transient error on one
  // record does not starve the rest. S3's async retry then redelivers the whole
  // event, and re-applying the update is idempotent.
  if (failures.length > 0) {
    throw new Error(`Failed to process ${failures.length} record(s): ${failures.join(", ")}`);
  }
};
