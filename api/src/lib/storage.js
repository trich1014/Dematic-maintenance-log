// api/src/lib/storage.js
//
// ── NEEDS FROM YOU ─────────────────────────────────────────────────────
// Set an Azure Function App setting called AZURE_STORAGE_CONNECTION_STRING.
// Get the value from: Azure Portal → your storage account → "Access keys"
// → Connection string. Add it in Function App → Configuration → New
// application setting. Never put it in this file or commit it to the repo.
// ─────────────────────────────────────────────────────────────────────

const { TableClient } = require("@azure/data-tables");

async function getTableClient(tableName) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      "AZURE_STORAGE_CONNECTION_STRING is not set. Add it in Function App > Configuration."
    );
  }
  const client = TableClient.fromConnectionString(connectionString, tableName);
  // Auto-create the table on first use so a fresh storage account doesn't
  // need manual setup — ignore "already exists" (409).
  try {
    await client.createTable();
  } catch (err) {
    if (err.statusCode !== 409) throw err;
  }
  return client;
}

module.exports = { getTableClient };
