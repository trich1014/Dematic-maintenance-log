// api/src/functions/entries.js
//
// GET    /api/entries/{table}        (table = "fixlog" or "recurringproblems")
// POST   /api/entries/{table}
// DELETE /api/entries/{table}/{id}
//
// Single-company version — no tenant header, no subscription check.
// This is what the React app (MaintenanceLog.jsx) calls for real storage
// instead of the FL:/RP: chat commands.

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

    const entriesTable = await getTableClient(table);

    if (request.method === "GET") {
      const results = [];
      const entities = entriesTable.listEntities({
        queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` },
      });
      for await (const e of entities) results.push(e);
      return { status: 200, jsonBody: results };
    }

    // POST — create a new entry (used both for logging a new RP and for
    // writing the fixed copy into fixlog when an RP is closed out)
    const body = await request.json().catch(() => null);
    if (!body || !body.equipment || !body.problem) {
      return { status: 400, jsonBody: { error: "equipment and problem are required" } };
    }

    const entry = {
      partitionKey: PARTITION_KEY,
      // Reuse the id passed in from the client (e.g. the RP's original id
      // when moving it into fixlog) so the two tables can be correlated;
      // fall back to a generated one if none was given.
      rowKey: body.id ? String(body.id) : `${Date.now()}`,
      equipment: body.equipment,
      problem: body.problem,
      tech: body.tech || "—",
      opened: body.opened || new Date().toISOString(),
      ...(body.fix ? { fix: body.fix } : {}),
      ...(body.resolved ? { resolved: body.resolved } : {}),
      ...(body.critical ? { critical: true } : {}),
    };
    await entriesTable.upsertEntity(entry, "Replace");
    return { status: 201, jsonBody: entry };
  },
});

// DELETE /api/entries/{table}/{id} — used to remove an RP once it has been
// written into fixlog, so it doesn't stay listed as open.
app.http("entryById", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "entries/{table}/{id}",
  handler: async (request, context) => {
    const { table, id } = request.params;
    if (!ALLOWED_TABLES.includes(table)) {
      return { status: 400, jsonBody: { error: `table must be one of: ${ALLOWED_TABLES.join(", ")}` } };
    }

    const entriesTable = await getTableClient(table);
    try {
      await entriesTable.deleteEntity(PARTITION_KEY, String(id));
    } catch (err) {
      if (err.statusCode === 404) {
        return { status: 404, jsonBody: { error: "entry not found" } };
      }
      throw err;
    }
    return { status: 204 };
  },
});
