// api/src/lib/storage.js
//
// ── NEEDS FROM YOU ─────────────────────────────────────────────────────
// Set an Azure Function App setting called AZURE_STORAGE_CONNECTION_STRING.
// Get the value from: Azure Portal → your storage account → "Access keys"
// → Connection string. Add it in Function App → Configuration → New
// application setting. Never put it in this file or commit it to the repo.
// ─────────────────────────────────────────────────────────────────────

const { TableClient } = require("@azure/data-tables");

function getTableClient(tableName) {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      "AZURE_STORAGE_CONNECTION_STRING is not set. Add it in Function App > Configuration."
    );
  }
  return TableClient.fromConnectionString(connectionString, tableName);
}

module.exports = { getTableClient };
