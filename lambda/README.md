# Lambda functions

Backend for the document upload flow. Node.js 22.x, arm64, ESM. Each function is a
single `index.mjs`; the Lambda handler setting is `index.handler`.

| Function        | Trigger                                                     | Env vars                            |
| --------------- | ----------------------------------------------------------- | ----------------------------------- |
| `createUpload`  | HTTP API `POST /documents` (Cognito JWT authorizer)         | `BUCKET_NAME`, `TABLE_NAME`, `MAX_BYTES` |
| `listDocuments` | HTTP API `GET /documents`, `DELETE /documents/{id}`         | `TABLE_NAME`, `BUCKET_NAME`         |
| `markUploaded`  | S3 `s3:ObjectCreated:*`, key prefix `users/`                | `TABLE_NAME`                        |

## Dependencies

Everything these functions import is either a Node built-in (`node:crypto`) or part of
the AWS SDK for JavaScript v3, which the Lambda Node.js 22.x runtime ships in
`/var/runtime/node_modules`. The runtime bundle is the full `@aws-sdk/*` publish set,
so `@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb` and
`@aws-sdk/s3-presigned-post` are all present and the functions deploy as a bare
`index.mjs` with no `node_modules`.

AWS still recommends packaging your own copy so the SDK version is pinned and does not
change underneath you on a runtime update. To do that, run this in each function's
directory and zip the result together with `index.mjs`:

```sh
npm install @aws-sdk/client-s3 @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/s3-presigned-post
```

`markUploaded` only needs `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb`.

## Sample events

Paste into the Lambda console test tab:

- `events/createUpload.apigw-v2.json` for `createUpload` (API Gateway v2 payload with a
  Cognito ID-token claim set).
- `events/markUploaded.s3.json` for `markUploaded` (S3 notification whose key contains
  `+`-encoded spaces).

`listDocuments` can be exercised with the first event by changing `routeKey` to
`GET /documents`, or to `DELETE /documents/{id}` plus `"pathParameters": {"id": "..."}`.

## Infrastructure the code assumes

- DynamoDB table with `pk`/`sk` string keys and TTL enabled on `expiresAt`.
- S3 bucket with a CORS rule allowing `POST` from the web app origin; the browser
  uploads straight to S3, so API Gateway CORS does not cover it.
- The presigned POST is signed with `createUpload`'s own credentials, so its role needs
  `s3:PutObject` on `arn:aws:s3:::<bucket>/users/*` plus `dynamodb:PutItem`.
- `listDocuments` role: `dynamodb:Query`, `dynamodb:GetItem`, `dynamodb:DeleteItem`,
  and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/users/*`.
- `markUploaded` role: `dynamodb:UpdateItem`. The S3 notification filter should use
  prefix `users/`; a non-matching key is logged and skipped anyway.
