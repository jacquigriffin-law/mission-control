// Lightweight sanity checks for Mission Control's Practice Intelligence shell.
// Run with `node tests/system-map.test.js`.
// The goals are:
//   * every url mentioned by the map or launcher list must belong to the
//     safe-host allowlist,
//   * safe-host lookups must fall back to empty string for anything outside
//     the allowlist,
//   * the map data must not accidentally leak local filesystem paths, credential
//     shaped strings, or email/phone numbers,
//   * the agent-to-section mapping used to make agent cards tappable on mobile
//     resolves each roster member to a known internal section,
//   * index.html actually includes the client-side scripts that power the map
//     and the tap-through mapping.
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const safeHosts = require(path.join(__dirname, "..", "lib", "safe-hosts.js"));
const systemMap = require(path.join(__dirname, "..", "lib", "system-map-data.js"));
const agentSections = require(path.join(__dirname, "..", "lib", "agent-sections.js"));
const liveTasks = require(path.join(__dirname, "..", "api", "_live-tasks.js"));
const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const opsSummaryJs = fs.readFileSync(path.join(__dirname, "..", "ops-summary.js"), "utf8");
const activityData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "activity.json"), "utf8"));
const taskData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "tasks.json"), "utf8"));
const journalData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "journal.json"), "utf8"));
const todoScreenHtml = indexHtml.match(/<section class="screen" id="todo"[\s\S]*?<section class="screen" id="finance"/)?.[0] || "";
const journalScreenHtml = indexHtml.match(/<section class="screen" id="journal"[\s\S]*?<section class="screen" id="documents"/)?.[0] || "";
const documentsScreenHtml = indexHtml.match(/<section class="screen" id="documents"[\s\S]*?<\/section>\s*<\/main>/)?.[0] || "";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

test("safeUrl accepts allowed https hosts", () => {
  Object.keys(safeHosts.SAFE_HOSTS).forEach((host) => {
    const url = `https://${host}`;
    assert.equal(safeHosts.safeUrl(url), `${url}/`, `expected ${url} to be allowed`);
  });
});

test("safeUrl rejects http, unknown hosts, junk", () => {
  assert.equal(safeHosts.safeUrl("http://mission-control-rho-amber.vercel.app"), "");
  assert.equal(safeHosts.safeUrl("https://evil.example.com"), "");
  assert.equal(safeHosts.safeUrl("not a url"), "");
  assert.equal(safeHosts.safeUrl(""), "");
  assert.equal(safeHosts.safeUrl(null), "");
  assert.equal(safeHosts.safeUrl(undefined), "");
});

test("system map sites resolve to safe urls", () => {
  systemMap.sites.forEach((node) => {
    assert.ok(safeHosts.safeUrl(node.url), `map site ${node.id} points at unsafe url ${node.url}`);
  });
});

test("system map launchers resolve to safe urls", () => {
  systemMap.launchers.forEach((group) => {
    group.items.forEach((item) => {
      assert.ok(safeHosts.safeUrl(item.url), `launcher ${item.label} points at unsafe url ${item.url}`);
    });
  });
});

test("system map edges only reference known node ids", () => {
  const ids = new Set([].concat(
    systemMap.hubs.map((node) => node.id),
    systemMap.sites.map((node) => node.id)
  ));
  systemMap.edges.forEach(([a, b]) => {
    assert.ok(ids.has(a), `edge references unknown node ${a}`);
    assert.ok(ids.has(b), `edge references unknown node ${b}`);
  });
});

test("system map hubs only reference known sections", () => {
  const validSections = new Set(["dashboard", "todo", "finance", "matters", "memory", "journal", "documents"]);
  systemMap.hubs.forEach((node) => {
    assert.ok(validSections.has(node.section), `hub ${node.id} points at unknown section ${node.section}`);
  });
});

test("system map data contains no obvious secrets or PII", () => {
  const serialised = JSON.stringify(systemMap);
  // Common shapes we never want to see rendered client-side.
  const banned = [
    /\/Users\//,
    /\/home\/[a-z]+\//i,
    /\/opt\/openclaw\//,
    /[A-Z0-9]{20,}/,               // long keys or ids
    /sk_(live|test)_/,             // stripe-style
    /BEGIN [A-Z ]*PRIVATE KEY/,
    /AKIA[0-9A-Z]{16}/,            // aws access key
    /[\w.+-]+@[\w-]+\.[\w.-]+/,    // email address
    /\+?\d[\d \-()]{8,}\d/         // phone number
  ];
  banned.forEach((pattern) => {
    assert.equal(pattern.test(serialised), false, `system map data matched forbidden pattern ${pattern}`);
  });
});

test("safeLabel returns the friendly host name", () => {
  assert.equal(safeHosts.safeLabel("https://mission-control-rho-amber.vercel.app"), "Mission Control");
  assert.equal(safeHosts.safeLabel("https://leads-tracker-eta.vercel.app"), "LeadFlow");
  assert.equal(safeHosts.safeLabel("https://evil.example.com"), "");
});

// -------------------------------------------------------------------------
// Agent-to-section mapping (drives the mobile tap targets in the System /
// Agents cards).  Every roster member Jacqui sees on the iPhone screenshot
// must resolve to a real section that the router recognises.
// -------------------------------------------------------------------------

test("sectionForAgent maps the current roster to real sections", () => {
  const roster = [
    { name: "Xena",      role: "Orchestrator",      expected: "todo" },
    { name: "Hermes",    role: "Intake / PA",       expected: "matters" },
    { name: "Themis",    role: "Court diary",       expected: "matters" },
    { name: "Plutus",    role: "Finance",           expected: "finance" },
    { name: "Ares",      role: "Conflict checking", expected: "matters" },
    { name: "Gabrielle", role: "Support",           expected: "todo" },
    { name: "Marketing", role: "Marketing",         expected: "documents" }
  ];
  roster.forEach(({ name, role, expected }) => {
    const actual = agentSections.sectionForAgent(name, role);
    assert.equal(actual, expected, `${name} (${role}) should map to #${expected} but got ${actual || "<empty>"}`);
    assert.ok(agentSections.VALID_SECTIONS.has(actual), `${name} mapped to unknown section ${actual}`);
  });
});

test("sectionForAgent falls back to role when the name is unknown", () => {
  assert.equal(agentSections.sectionForAgent("New Agent", "Intake"), "matters");
  assert.equal(agentSections.sectionForAgent("New Agent", "PA"), "matters");
  assert.equal(agentSections.sectionForAgent("New Agent", "Court diary"), "matters");
  assert.equal(agentSections.sectionForAgent("New Agent", "Conflict checking"), "matters");
  assert.equal(agentSections.sectionForAgent("New Agent", "Finance"), "finance");
  assert.equal(agentSections.sectionForAgent("New Agent", "Orchestrator"), "todo");
  assert.equal(agentSections.sectionForAgent("New Agent", "Support"), "todo");
  assert.equal(agentSections.sectionForAgent("New Agent", "Marketing"), "documents");
});

test("sectionForAgent returns empty for junk input rather than guessing", () => {
  assert.equal(agentSections.sectionForAgent("", ""), "");
  assert.equal(agentSections.sectionForAgent(null, null), "");
  assert.equal(agentSections.sectionForAgent(undefined, undefined), "");
  assert.equal(agentSections.sectionForAgent("Nobody", "Nonsense"), "");
});

test("sectionForAgent is case- and whitespace-tolerant", () => {
  assert.equal(agentSections.sectionForAgent("  XENA  ", ""), "todo");
  assert.equal(agentSections.sectionForAgent("", "  Court Diary  "), "matters");
});

test("VALID_SECTIONS matches the router's screen list", () => {
  ["dashboard", "todo", "finance", "matters", "memory", "journal", "documents"].forEach((section) => {
    assert.ok(agentSections.VALID_SECTIONS.has(section), `expected ${section} in VALID_SECTIONS`);
  });
});

test("index.html uses the Practice Intelligence primary navigation", () => {
  ["To Do", "Finances", "Matters", "Memory", "Journal", "Documents"].forEach((label) => {
    assert.ok(indexHtml.includes(`<span class="nav-text">${label}</span>`), `missing primary nav label ${label}`);
  });
  ["#leads", "#system-map", 'id="leads"', 'id="system"', 'id="system-map"'].forEach((oldMarker) => {
    assert.equal(indexHtml.includes(oldMarker), false, `old primary dashboard marker must not remain: ${oldMarker}`);
  });
  assert.ok(indexHtml.includes("Practice Intelligence"), "dashboard must identify itself as a Practice Intelligence layer");
  assert.ok(indexHtml.includes("not a To Do list"), "dashboard must demote To Do framing");
});

test("index.html exposes a separate To Do operations tab", () => {
  assert.ok(indexHtml.includes('href="#todo"'), "sidebar must include a To Do nav link");
  assert.ok(indexHtml.includes('data-section="todo"'), "To Do nav link must carry data-section=\"todo\"");
  assert.ok(indexHtml.includes('id="todo"'), "index.html must define a #todo screen section");
  assert.ok(indexHtml.includes('data-screen="todo"'), "#todo screen must expose data-screen=\"todo\" for the router");
  assert.ok(indexHtml.includes("data-todo-board"), "#todo screen must expose the operations board container");
  assert.ok(todoScreenHtml.includes("Live operations board"), "To Do tab must label the board as live");
  assert.ok(todoScreenHtml.includes("Live Microsoft To Do privacy-safe feed"), "To Do tab must describe the live privacy-safe feed");
  assert.ok(todoScreenHtml.includes("No client names, matter numbers or LEAP record data."), "To Do tab must state its privacy boundary");
  assert.ok(indexHtml.includes('id="refreshTodoData"'), "To Do tab must expose a manual refresh control");
  assert.ok(indexHtml.includes("Last refreshed:"), "To Do tab must show the live feed refresh timestamp");
  assert.ok(indexHtml.includes("5 * 60 * 1000"), "To Do tab must auto-refresh the live feed while open");
  assert.ok(indexHtml.includes("uncachedUrl(url)"), "client GET API fetches must use the shared cache-bust helper");
  assert.ok(indexHtml.includes("_mc=${Date.now()}"), "client cache-bust token must change per request");
  assert.ok(
    !/old 10\/11 July|10 July operations snapshot|11 July operations snapshot|2026-07-10|2026-07-11/.test(todoScreenHtml + JSON.stringify(taskData)),
    "To Do tab and task seed must not ship stale 10/11 July snapshot wording"
  );
  assert.ok(
    /Microsoft To Do and LEAP remain[^<]*record-level/.test(indexHtml),
    "To Do tab must state Microsoft To Do and LEAP remain the record-level systems"
  );
  assert.equal(indexHtml.includes("dashboardBusinessTasks"), false, "dashboardBusinessTasks must not appear in the shipped page");
});

test("local server tasks API uses the live Microsoft To Do builder", () => {
  const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const agentStoreSource = fs.readFileSync(path.join(__dirname, "..", "api", "_agent-store.js"), "utf8");
  assert.ok(serverSource.includes('require("./api/_live-tasks.js")'), "local server must load the live task builder");
  assert.ok(serverSource.includes("await buildLiveTaskStore() || store"), "local /api/tasks GET must prefer live To Do data");
  assert.ok(serverSource.includes("private, no-store, no-cache, must-revalidate, max-age=0"), "local JSON API responses must not cache task data");
  assert.ok(agentStoreSource.includes("private, no-store, no-cache, must-revalidate, max-age=0"), "serverless JSON API responses must not cache task data");
  assert.ok(serverSource.includes('"Pragma": "no-cache"'), "local JSON API responses must include Pragma no-cache");
  assert.ok(agentStoreSource.includes('response.setHeader("Pragma", "no-cache")'), "serverless JSON API responses must include Pragma no-cache");
});

test("Agents tab is removed from the shipped navigation", () => {
  assert.equal(indexHtml.includes('href="#agents"'), false, "Agents nav/link must not ship");
  assert.equal(indexHtml.includes('data-section="agents"'), false, "Agents nav data-section must not ship");
  assert.equal(indexHtml.includes('id="agents"'), false, "Agents screen must not ship");
  assert.equal(indexHtml.includes('data-screen="agents"'), false, "Agents router screen must not ship");
  assert.equal(agentSections.VALID_SECTIONS.has("agents"), false, "agents must not be a valid route");
  assert.equal(systemMap.hubs.some((node) => node.section === "agents"), false, "system map must not route to removed Agents tab");
});

test("index.html defines dedicated Memory and Documents sections", () => {
  assert.ok(indexHtml.includes('id="memory"'), "Memory must be a dedicated section");
  assert.ok(indexHtml.includes('id="documents"'), "Documents must be a dedicated section");
  assert.ok(indexHtml.includes('<h2 id="memory-title">Memory</h2>'), "Memory heading must remain");
  assert.ok(documentsScreenHtml.includes('<h2 id="documents-title">Documents</h2>'), "Documents heading must remain");
  assert.ok(documentsScreenHtml.includes("Documents tab review"), "Documents screen must include the review recommendation panel");
  assert.ok(documentsScreenHtml.includes("Link audit and proposed clean-up"), "Documents screen must include the link audit");
  assert.ok(documentsScreenHtml.includes("Scheduled jobs"), "Documents screen must include the cron inventory");
  assert.ok(documentsScreenHtml.includes("OpenClaw scheduler snapshot checked 19 July 2026"), "Documents cron inventory must show its snapshot date");
  assert.ok(documentsScreenHtml.includes("44 jobs"), "Documents cron inventory must include all scheduler jobs from the latest snapshot");
  assert.ok(documentsScreenHtml.includes("Themis: Daily Morning Brief (7am)"), "Documents cron table must include active morning brief job");
  assert.ok(documentsScreenHtml.includes("Iris call relay to Jacqui"), "Documents cron table must include disabled jobs as audit history");
  ["#journal", "#dashboard", "#documents"].forEach((href) => {
    assert.ok(indexHtml.includes(`href="${href}"`), `Memory screen must include clickable ${href} link`);
  });
  assert.equal(indexHtml.includes('href="#agents"'), false, "Memory screen must not link to the removed Agents tab");
  assert.equal(indexHtml.includes("Memory Lanes Categories"), false, "Memory lanes categories subsection must not appear");
  assert.equal(indexHtml.includes("Memory lanes"), false, "Memory lanes tile must not appear");
  assert.equal(indexHtml.includes("Memory sources"), false, "Memory sources panel must not appear");
  assert.equal(indexHtml.includes("data-system-memory"), false, "Memory source renderer binding must not ship");
  assert.equal(indexHtml.includes("data-memory-categories"), false, "Memory category renderer binding must not ship");
  assert.equal(opsSummaryJs.includes("memoryCategories"), false, "Memory category feed data must not ship");
  assert.equal(indexHtml.includes("Searchable history concept"), false, "Memory categories panel must not appear");
  assert.equal(indexHtml.includes("Memory boundary"), false, "Memory boundary panel must not appear");
  assert.equal(documentsScreenHtml.includes("Generated-document library"), false, "Documents intro copy must not appear");
  assert.equal(documentsScreenHtml.includes("Metadata only"), false, "Documents metadata tag/copy must not appear");
  assert.equal(documentsScreenHtml.includes('aria-label="Document library counters"'), false, "Documents KPI/counter strip must not appear");
  assert.equal(documentsScreenHtml.includes("Library lanes"), false, "Documents library lanes panel must not appear");
  assert.equal(documentsScreenHtml.includes("Document types"), false, "Documents document-type counter must not appear");
  assert.equal(documentsScreenHtml.includes("Status filters"), false, "Documents status counter must not appear");
  assert.equal(documentsScreenHtml.includes("Privacy"), false, "Documents privacy counter must not appear");
  assert.equal(documentsScreenHtml.includes("Status model"), false, "Documents status model panel must not appear");
  assert.equal(documentsScreenHtml.includes("Document categories and source agents"), false, "Documents category panel must not appear");
  assert.equal(documentsScreenHtml.includes("Safe structure map"), false, "Documents safe structure details must not appear");
  assert.equal(documentsScreenHtml.includes("Safe launchers"), false, "Documents safe launchers panel must not appear");
  assert.equal(documentsScreenHtml.includes("What this map shows"), false, "Documents included-map panel must not appear");
  assert.equal(documentsScreenHtml.includes("What it deliberately hides"), false, "Documents hidden-map panel must not appear");
  assert.equal(documentsScreenHtml.includes("systemMapCanvas"), false, "Documents system map canvas must not appear");
  assert.equal(documentsScreenHtml.includes("systemMapDetail"), false, "Documents system map details must not appear");
  assert.equal(documentsScreenHtml.includes("systemMapLaunchers"), false, "Documents system map launchers must not appear");
  assert.equal(documentsScreenHtml.includes("systemMapIncluded"), false, "Documents included-map container must not appear");
  assert.equal(documentsScreenHtml.includes("systemMapExcluded"), false, "Documents hidden-map container must not appear");
  assert.equal(indexHtml.includes("data-system-documents"), false, "Document lane renderer binding must not ship");
  assert.equal(indexHtml.includes("data-document-statuses"), false, "Document status renderer binding must not ship");
  assert.equal(indexHtml.includes("data-document-categories"), false, "Document category renderer binding must not ship");
});

test("index.html defines the Journal section and client-side API wiring", () => {
  assert.ok(indexHtml.includes('href="#journal"'), "sidebar must include a Journal nav link");
  assert.ok(indexHtml.includes('data-section="journal"'), "Journal nav link must carry data-section=\"journal\"");
  assert.ok(indexHtml.includes('id="journal"'), "index.html must define a #journal screen section");
  assert.ok(indexHtml.includes('data-screen="journal"'), "#journal screen must expose data-screen=\"journal\" for the router");
  assert.ok(journalScreenHtml.includes('<h2 id="journal-title">Journal</h2>'), "Journal heading must remain visible");
  assert.ok(journalScreenHtml.includes("<h3>Workspace journal</h3>"), "Workspace journal heading must remain visible");
  assert.ok(journalScreenHtml.includes("Date range"), "Journal date range heading must remain visible");
  assert.ok(journalScreenHtml.includes('id="journalDateRange"'), "Journal date range value must remain visible");
  assert.ok(indexHtml.includes('apiJson("/api/journal")'), "Journal renderer must load from /api/journal");
  assert.equal(indexHtml.includes("Daily workspace journal entries rendered"), false, "Journal tab intro paragraph must not ship");
  assert.equal(indexHtml.includes("journalSource"), false, "Journal source summary text must not ship");
});

test("Journal visible cards and entry list do not ship", () => {
  [
    "<span>Entries</span>",
    "<span>Source</span>",
    "Daily memory",
    "<span>Privacy</span>",
    "Daily summaries loaded",
    "Sanitised seed data",
    "No raw notes rendered",
    "Chronological",
    "data-journal-list"
  ].forEach((label) => {
    assert.equal(journalScreenHtml.includes(label), false, `Journal screen must not include removed visible content: ${label}`);
  });
  assert.equal(indexHtml.includes('document.querySelector("[data-journal-list]")'), false, "Journal list renderer must not remain wired");
  assert.equal(indexHtml.includes('class="journal-entry"'), false, "Journal entry card renderer must not remain wired");
});

test("Journal boundary panel labels do not ship", () => {
  assert.equal(indexHtml.includes("Journal boundary"), false, "Journal boundary panel heading must not ship");
  [
    "What can appear in this public-safe operations view.",
    "<strong>Shown</strong>",
    "<strong>Hidden</strong>",
    "<strong>Source files</strong>",
    "Operational summaries, decisions, tool/runtime work, non-confidential milestones and review-only publication status.",
    "Secrets, credentials, raw emails, full client contact details, legal advice and matter-record facts.",
    "Summaries are derived offline from private <code>memory/YYYY-MM-DD.md</code> files, then committed as static JSON."
  ].forEach((label) => {
    assert.equal(journalScreenHtml.includes(label), false, `Journal boundary panel text must not ship in Journal screen: ${label}`);
  });
});

test("Journal seed is chronological and privacy-safe", () => {
  assert.ok(journalData.meta?.generatedAt, "journal seed must expose a generation timestamp");
  assert.ok(
    /Privacy-safe/i.test(journalData.meta?.source || ""),
    "journal seed must identify the privacy-safe source"
  );
  const days = journalData.days || [];
  assert.ok(days.length >= 2, "journal seed must include at least two days");
  assert.ok(days.some((day) => day.date === "2026-07-18"), "journal seed must include 2026-07-18");
  assert.ok(days.some((day) => day.date === "2026-07-19"), "journal seed must include 2026-07-19");
  const dates = days.map((day) => day.date);
  assert.deepEqual(dates, [...dates].sort(), "journal days must be chronological oldest-to-newest");
  days.forEach((day) => {
    assert.ok(Array.isArray(day.entries), `${day.date} must expose grouped entries`);
    assert.ok(day.entries.length, `${day.date} must include at least one entry`);
  });

  const serialised = JSON.stringify(journalData);
  [
    /\/Users\//,
    /\/home\/[a-z]+\//i,
    /\/opt\/openclaw\//,
    /[A-Z0-9]{20,}/,
    /sk_(live|test)_/,
    /BEGIN [A-Z ]*PRIVATE KEY/,
    /AKIA[0-9A-Z]{16}/,
    /[\w.+-]+@[\w-]+\.[\w.-]+/,
    /(?:\+?61|0)\d(?:[\s()-]*\d){8,}/
  ].forEach((pattern) => {
    assert.equal(pattern.test(serialised), false, `journal seed matched forbidden pattern ${pattern}`);
  });
});

// -------------------------------------------------------------------------
// index.html wiring — the script tags and hash anchors we depend on above
// must actually exist in the shipped page.
// -------------------------------------------------------------------------

test("index.html loads the agent-sections and safe-hosts scripts", () => {
  assert.ok(indexHtml.includes("lib/safe-hosts.js"), "safe-hosts.js must be included in index.html");
  assert.ok(indexHtml.includes("lib/system-map-data.js"), "system-map-data.js must be included in index.html");
  assert.ok(indexHtml.includes("lib/agent-sections.js"), "agent-sections.js must be included in index.html");
});

test("index.html defines every internal hash target we route to", () => {
  agentSections.VALID_SECTIONS.forEach((section) => {
    const marker = `id="${section}"`;
    assert.ok(indexHtml.includes(marker), `index.html missing section ${marker}`);
  });
});

test("index.html renders system agent rows as anchors when a section is known", () => {
  assert.ok(
    indexHtml.includes('class="row row-nav"'),
    "System agent rows must render as row-nav anchors so mobile users can tap them"
  );
});

test("Agents Kanban screen does not ship", () => {
  [
    '<h2 id="agents-title">Agents</h2>',
    '<section class="screen" id="agents"',
    'data-screen="agents"',
    'href="#agents"',
    'data-section="agents"',
    "Agent Kanban board",
    "Current operations board",
    "Live privacy-safe task view from Microsoft To Do",
    "Agent status",
    "Local-only changes cached in this browser.",
    "Snapshot + local",
    "Shared communication log"
  ].forEach((marker) => {
    assert.equal(indexHtml.includes(marker), false, `removed Agents UI marker must not ship: ${marker}`);
  });
});

test("index.html routes safe-launcher links through safeUrl", () => {
  assert.ok(
    indexHtml.includes("hosts.safeUrl(item.url)"),
    "launcher rendering must reject items outside the safe-host allowlist"
  );
  assert.ok(
    indexHtml.includes("hosts.safeUrl(node.url)"),
    "map node rendering must reject urls outside the safe-host allowlist"
  );
});

test("launcher render code opens external sites in a new tab with noopener noreferrer", () => {
  assert.ok(
    indexHtml.includes('target="_blank" rel="noopener noreferrer"'),
    "external launchers must open in a new tab with noopener noreferrer to avoid tab-nabbing"
  );
});

test("Kanban cards expose button and touch move paths", () => {
  assert.ok(
    indexHtml.includes('class="task-lane-picker"'),
    "Kanban cards must show an always-visible lane selector"
  );
  assert.ok(
    indexHtml.includes('aria-label="Move task to Kanban lane"'),
    "The always-visible lane selector must be labelled for mobile and keyboard users"
  );
  assert.ok(
    indexHtml.includes('data-task-move="${escapeHtml(previousStatus)}"'),
    "Kanban cards must keep visible previous-lane move buttons"
  );
  assert.ok(
    indexHtml.includes('data-task-move="${escapeHtml(nextStatus)}"'),
    "Kanban cards must keep visible next-lane move buttons"
  );
  assert.ok(
    indexHtml.includes('addEventListener("pointerdown"'),
    "Kanban must support touch/pointer dragging for phones"
  );
  assert.ok(
    indexHtml.includes("kanbanLaneAtPoint"),
    "Touch dragging must resolve the lane under the user's finger"
  );
});

test("Kanban seed uses a current privacy-safe operations snapshot", () => {
  assert.ok(taskData.meta?.generatedAt, "task seed data must expose a snapshot timestamp");
  assert.ok(
    /privacy-safe operations snapshot/i.test(taskData.meta?.source || ""),
    "task seed data must identify the privacy-safe operations source"
  );
  assert.ok(
    taskData.tasks.some((task) => /Marketing campaign rollout status/i.test(task.title)),
    "task seed data must reflect the current marketing rollout work"
  );
  assert.ok(
    taskData.tasks.some((task) => /Plutus payment-run automation/i.test(task.title)),
    "task seed data must include current Plutus automation work"
  );
  assert.ok(
    !taskData.tasks.some((task) => /Gabrielle booking bridge|Mission Control demo Kanban|Draft weekly content brief|MYOB unallocated bank items/i.test(task.title)),
    "old demo Kanban tasks must not return"
  );
});

test("To Do feed wording rejects the stale 10/11 July snapshot", () => {
  const taskText = JSON.stringify(taskData);
  const staleSnapshotPattern = /10 July|11 July|2026-07-10|2026-07-11|Gabrielle booking bridge|Mission Control demo Kanban|Draft weekly content brief|MYOB unallocated bank items|availability works|live booking creation is still blocked/i;
  assert.ok(todoScreenHtml.includes("Live Microsoft To Do privacy-safe feed"), "visible To Do tab must identify the live privacy-safe feed");
  assert.equal(staleSnapshotPattern.test(todoScreenHtml), false, "visible To Do tab must not mention the stale 10/11 July snapshot");
  assert.equal(staleSnapshotPattern.test(taskText), false, "fallback To Do seed must not contain stale 10/11 July task snapshot wording");
});

test("Live To Do task transform removes matter identifiers from public Kanban cards", () => {
  const card = liveTasks.publicTask(
    {
      id: "abc",
      title: "2026-07-20 - Smith matter 26/1207 urgent filing",
      status: "notStarted",
      importance: "high",
      createdDateTime: "2026-07-19T00:00:00Z",
      lastModifiedDateTime: "2026-07-19T00:00:00Z",
      dueDateTime: { dateTime: "2026-07-20T00:00:00", timeZone: "AUS Eastern Standard Time" }
    },
    { id: "list-1", displayName: "Matter Tasks" }
  );
  assert.equal(card.title, "Matter task due 20 July 2026");
  assert.equal(card.assigneeId, "themis");
  assert.equal(/\b26\/1207\b|Smith/i.test(JSON.stringify(card)), false, "public Kanban card must not include raw matter identifiers");
});

test("Removed Agents tab leaves no stale demo activity on visible pages", () => {
  const activityText = JSON.stringify(activityData);
  assert.equal(indexHtml.includes("Agent Kanban board"), false, "removed Agents Kanban must not ship");
  assert.equal(indexHtml.includes('id="newTaskForm"'), false, "removed Agents add-note form must not ship");
  assert.equal(indexHtml.includes("Shared communication log"), false, "removed Agents communication log must not ship");
  assert.equal(indexHtml.includes("Entries cached in this browser"), false, "cached-browser wording must not ship");
  assert.ok(activityText.includes("19 July"), "activity seed can remain current for API consumers");
  assert.ok(
    !/10 July|11 July|2026-07-10|2026-07-11|availability works|live booking creation is still blocked/.test(activityText),
    "stale 10 July/11 July demo activity must not return"
  );
});

console.log(`\n${passed} check${passed === 1 ? "" : "s"} passed.`);
