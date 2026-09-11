import { useState, useEffect, useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  DMS Maintenance Log — department prototype                    */
/*  Live data via /api/entries/{recurringproblems|fixlog}             */
/* ------------------------------------------------------------------ */

const now = () => new Date();
const fmt = (d) =>
  d.toLocaleString("en-US", {
    month: "numeric", day: "numeric", year: "2-digit",
    hour: "numeric", minute: "2-digit", hour12: true,
  });

// Fallback demo data — only used if the API can't be reached at all.
const seedDate = (daysAgo, h = 22, m = 30) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d;
};
const SEED = [
  { id: 1, status: "fixed", equipment: "Station 6 GTP", problem: "Repeated jams", fix: "Bad O-ring on roller — diagnosed, repair coordinated with first shift", tech: "Tony", opened: seedDate(20, 21, 15), resolved: seedDate(19, 6, 40) },
  { id: 2, status: "fixed", equipment: "GTP 5 & 6", problem: "Recurring ECC motor faults", fix: "Roller swap → ECC swap → resolved via ECC resets + MDR box power cycle", tech: "Tony", opened: seedDate(14, 19, 5), resolved: seedDate(13, 2, 20) },
  { id: 5, status: "open", equipment: "CRT label machine", problem: "Intermittent double/triple labels", tech: "Tony", opened: seedDate(1, 23, 30) },
  { id: 6, status: "open", equipment: "Top conveyor (leaving DMS)", problem: "Recurring jams", tech: "Tony", opened: seedDate(1, 23, 40) },
];

const TABS = ["Open", "Fix Log", "All", "Report"];

const normalize = (list, status) =>
  list.map((e) => ({
    id: e.rowKey,
    status,
    equipment: e.equipment,
    problem: e.problem,
    tech: e.tech,
    opened: new Date(e.opened),
    ...(e.fix ? { fix: e.fix } : {}),
    ...(e.resolved ? { resolved: new Date(e.resolved) } : {}),
    ...(e.critical ? { critical: true } : {}),
  }));

export default function MaintenanceLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState("Open");
  const [form, setForm] = useState({ equipment: "", problem: "", tech: "" });
  const [resolving, setResolving] = useState(null); // entry id being closed
  const [fixNote, setFixNote] = useState("");
  const [flash, setFlash] = useState("");

  const ping = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2600);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rpRes, flRes] = await Promise.all([
          fetch("/api/entries/recurringproblems"),
          fetch("/api/entries/fixlog"),
        ]);
        if (!rpRes.ok || !flRes.ok) throw new Error("API request failed");
        const rp = await rpRes.json();
        const fl = await flRes.json();
        if (!cancelled) {
          setEntries([...normalize(rp, "open"), ...normalize(fl, "fixed")]);
        }
      } catch (err) {
        console.error("Failed to load entries from API", err);
        if (!cancelled) {
          setEntries(SEED);
          setOffline(true);
          ping("⚠ Couldn't reach the server — showing demo data only");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const open = useMemo(() => entries.filter((e) => e.status === "open"), [entries]);
  const fixed = useMemo(() => entries.filter((e) => e.status === "fixed"), [entries]);

  const logProblem = async () => {
    if (!form.equipment.trim() || !form.problem.trim()) {
      ping("close command — equipment and problem are required");
      return;
    }
    const entry = {
      id: Date.now(),
      status: "open",
      equipment: form.equipment.trim(),
      problem: form.problem.trim(),
      tech: form.tech.trim() || "—",
      opened: now(),
    };
    setEntries([entry, ...entries]);
    setForm({ equipment: "", problem: "", tech: form.tech });
    ping(`Logged — RP #${entry.id} · ${fmt(entry.opened)}`);
    setTab("Open");

    if (offline) return;
    try {
      const res = await fetch("/api/entries/recurringproblems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry.id,
          equipment: entry.equipment,
          problem: entry.problem,
          tech: entry.tech,
          opened: entry.opened.toISOString(),
        }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch (err) {
      console.error(err);
      ping("⚠ Saved locally only — couldn't reach the server");
    }
  };

  const closeOut = async (id) => {
    if (!fixNote.trim()) {
      ping("close command — describe the fix before closing");
      return;
    }
    const target = entries.find((e) => e.id === id);
    if (!target) return;

    const resolvedAt = now();
    const fixedEntry = { ...target, status: "fixed", fix: fixNote.trim(), resolved: resolvedAt };

    setEntries(entries.map((e) => (e.id === id ? fixedEntry : e)));
    setResolving(null);
    setFixNote("");
    ping(`Moved to Fix Log · ${fmt(resolvedAt)}`);

    if (offline) return;
    try {
      const postRes = await fetch("/api/entries/fixlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: fixedEntry.id,
          equipment: fixedEntry.equipment,
          problem: fixedEntry.problem,
          tech: fixedEntry.tech,
          opened: fixedEntry.opened.toISOString(),
          fix: fixedEntry.fix,
          resolved: resolvedAt.toISOString(),
          ...(fixedEntry.critical ? { critical: true } : {}),
        }),
      });
      if (!postRes.ok) throw new Error("fixlog save failed");

      const delRes = await fetch(`/api/entries/recurringproblems/${id}`, { method: "DELETE" });
      if (!delRes.ok && delRes.status !== 404) throw new Error("recurringproblems delete failed");
    } catch (err) {
      console.error(err);
      ping("⚠ Moved locally only — couldn't sync with the server");
    }
  };

  const badge = (e) =>
    e.status === "open" ? (
      <span className="text-xs font-bold tracking-widest px-2 py-0.5 rounded-sm bg-amber-400 text-zinc-900">OPEN</span>
    ) : (
      <span className="text-xs font-bold tracking-widest px-2 py-0.5 rounded-sm bg-emerald-500 text-zinc-900">FIXED</span>
    );

  const Card = ({ e }) => (
    <div className={`border-l-4 ${e.status === "open" ? "border-amber-400" : "border-emerald-500"} bg-zinc-800/80 rounded-r-md px-4 py-3`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {badge(e)}
            <span className="font-semibold text-zinc-100">{e.equipment}</span>
            {e.critical && (
              <span className="text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded-sm bg-red-500/20 text-red-300 border border-red-500/40">CRITICAL PATH</span>
            )}
          </div>
          <p className="text-sm text-zinc-300 mt-1">{e.problem}</p>
          {e.fix && (
            <p className="text-sm text-emerald-300/90 mt-1">
              <span className="text-emerald-500 font-mono text-xs mr-1">FIX ▸</span>{e.fix}
            </p>
          )}
        </div>
        {e.status === "open" && resolving !== e.id && (
          <button
            onClick={() => { setResolving(e.id); setFixNote(""); }}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded border border-emerald-500/60 text-emerald-300 hover:bg-emerald-500 hover:text-zinc-900 transition-colors"
          >
            Close out
          </button>
        )}
      </div>

      {resolving === e.id && (
        <div className="mt-3 flex gap-2">
          <input
            autoFocus
            value={fixNote}
            onChange={(ev) => setFixNote(ev.target.value)}
            onKeyDown={(ev) => ev.key === "Enter" && closeOut(e.id)}
            placeholder="What was the fix? (root cause + action)"
            className="flex-1 bg-zinc-900 border border-zinc-600 rounded px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-400"
          />
          <button onClick={() => closeOut(e.id)} className="text-xs font-semibold px-3 rounded bg-emerald-500 text-zinc-900 hover:bg-emerald-400">Log fix</button>
          <button onClick={() => setResolving(null)} className="text-xs px-2 rounded border border-zinc-600 text-zinc-400 hover:text-zinc-200">Cancel</button>
        </div>
      )}

      <div className="mt-2 font-mono text-[11px] text-zinc-500 flex flex-wrap gap-x-4">
        <span>OPENED {fmt(e.opened)}</span>
        {e.resolved && <span className="text-emerald-500/80">RESOLVED {fmt(e.resolved)}</span>}
        <span>TECH: {e.tech}</span>
        <span>#{String(e.id).padStart(3, "0")}</span>
      </div>
    </div>
  );

  const Report = () => (
    <div className="bg-zinc-100 text-zinc-900 rounded-md p-6 print:p-0">
      <div className="flex items-baseline justify-between border-b-2 border-zinc-900 pb-2 mb-4">
        <h2 className="text-xl font-bold">DMS Maintenance Report</h2>
        <span className="font-mono text-xs">{fmt(now())}</span>
      </div>
      <p className="text-sm mb-4">
        {fixed.length} resolved · {open.length} open · {entries.length} total entries
      </p>
      <h3 className="font-bold text-sm tracking-wide mb-1">SECTION 1 — RESOLVED</h3>
      <table className="w-full text-sm mb-5">
        <tbody>
          {fixed.map((e) => (
            <tr key={e.id} className="border-b border-zinc-300 align-top">
              <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">{e.equipment}</td>
              <td className="py-1.5 pr-2">{e.problem} — <span className="italic">{e.fix}</span></td>
              <td className="py-1.5 font-mono text-xs whitespace-nowrap">{fmt(e.resolved)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="font-bold text-sm tracking-wide mb-1">SECTION 2 — OPEN</h3>
      <table className="w-full text-sm">
        <tbody>
          {open.map((e) => (
            <tr key={e.id} className="border-b border-zinc-300 align-top">
              <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">{e.equipment}</td>
              <td className="py-1.5 pr-2">{e.problem}</td>
              <td className="py-1.5 font-mono text-xs whitespace-nowrap">{fmt(e.opened)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => window.print()}
        className="mt-5 text-sm font-semibold px-4 py-2 rounded bg-zinc-900 text-zinc-100 hover:bg-zinc-700 print:hidden"
      >
        Print / save as PDF
      </button>
    </div>
  );

  const listFor = tab === "Open" ? open : tab === "Fix Log" ? fixed : entries;

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 font-sans">
      <header className="border-b border-zinc-700 bg-zinc-950">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-wide">DMS · MAINTENANCE LOG</h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              {offline ? "OFFLINE — DEMO DATA (server unreachable)" : "LIVE — SAVED TO AZURE"}
            </p>
          </div>
          <div className="flex gap-4 font-mono text-center">
            <div>
              <div className="text-2xl font-bold text-amber-400">{open.length}</div>
              <div className="text-[10px] tracking-widest text-zinc-500">OPEN</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-500">{fixed.length}</div>
              <div className="text-[10px] tracking-widest text-zinc-500">FIXED</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <section className="bg-zinc-800 rounded-md p-4 border border-zinc-700">
          <h2 className="text-xs font-bold tracking-widest text-zinc-400 mb-3">RP: LOG A PROBLEM</h2>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.6fr_0.8fr_auto] gap-2">
            <input
              value={form.equipment}
              onChange={(e) => setForm({ ...form, equipment: e.target.value })}
              placeholder="Equipment / location"
              className="bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
            <input
              value={form.problem}
              onChange={(e) => setForm({ ...form, problem: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && logProblem()}
              placeholder="What's happening?"
              className="bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
            <input
              value={form.tech}
              onChange={(e) => setForm({ ...form, tech: e.target.value })}
              placeholder="Your name"
              className="bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
            <button
              onClick={logProblem}
              className="font-semibold text-sm px-4 py-2 rounded bg-amber-400 text-zinc-900 hover:bg-amber-300"
            >
              Log it
            </button>
          </div>
          <p className="font-mono text-[11px] text-zinc-500 mt-2">Timestamp is applied automatically at the moment of logging.</p>
        </section>

        {flash && (
          <div className="font-mono text-sm text-amber-300 border border-amber-400/40 bg-amber-400/10 rounded px-3 py-2">
            {flash}
          </div>
        )}

        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm font-semibold px-4 py-1.5 rounded-t border-b-2 transition-colors ${
                tab === t
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t}
              {t === "Open" && open.length > 0 && <span className="ml-1.5 text-xs text-amber-400/80">{open.length}</span>}
              {t === "Fix Log" && fixed.length > 0 && <span className="ml-1.5 text-xs text-emerald-400/80">{fixed.length}</span>}
              {t === "All" && entries.length > 0 && <span className="ml-1.5 text-xs text-zinc-400">{entries.length}</span>}
            </button>
          ))}
        </nav>

        {tab === "Report" ? (
          <Report />
        ) : loading ? (
          <p className="text-sm text-zinc-500 py-6 text-center">Loading…</p>
        ) : (
          <section className="space-y-2">
            {listFor.length === 0 ? (
              <p className="text-sm text-zinc-500 py-6 text-center">Nothing here yet — log the first entry above.</p>
            ) : (
              listFor.map((e) => <Card key={e.id} e={e} />)
            )}
          </section>
        )}
      </main>
    </div>
  );
}
