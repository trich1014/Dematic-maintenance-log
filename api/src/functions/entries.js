// api/src/functions/entries.js
//
// GET  /api/entries/{table}   (table = "fixlog" or "recurringproblems")
// POST /api/entries/{table}
//
// Single-company version — no tenant header, no subscription check.
// This is what your React app calls once it has real storage instead of
// the FL:/RP: chat commands.

const { app } = require("@azure/functions");
const { getTableClient } = require("../lib/storage");

const ALLOWED_TABLES = ["fixlog", "recurringproblems"];
const PARTITION_KEY = "entry"; // single partition is fine at this scale

app.http("entries", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "entries/{table}",
  handler: async (request, context) => {
    const table = request.params.table;
    if (!ALLOWED_TABLES.includes(table)) {
      return { status: 400, jsonBody: { error: `table must be one of: ${ALLOWED_TABLES.join(", ")}` } };
    }

    const entriesTable = getTableClient(table);

    if (request.method === "GET") {
      const results = [];
      const entities = entriesTable.listEntities({
        queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` },
      });
      for await (const e of entities) results.push(e);
      return { status: 200, jsonBody: results };
    }

    // POST — create a new entry
    const body = await request.json().catch(() => null);
    if (!body || !body.description) {
      return { status: 400, jsonBody: { error: "description is required" } };
    }

    const entry = {
      partitionKey: PARTITION_KEY,
      rowKey: `${Date.now()}`, // simple, sortable, unique-enough at this scale
      description: body.description,
      loggedAt: new Date().toISOString(),
    };
    await entriesTable.createEntity(entry);
    return { status: 201, jsonBody: entry };
  },
});
