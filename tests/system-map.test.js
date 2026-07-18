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
const agentData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "agents.json"), "utf8"));
const activityData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "activity.json"), "utf8"));
const taskData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "tasks.json"), "utf8"));
const journalData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "journal.json"), "utf8"));

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
  const validSections = new Set(["dashboard", "todo", "finance", "matters", "agents", "memory", "journal", "documents"]);
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
    { name: "Xena",      role: "Orchestrator",      expected: "agents" },
    { name: "Hermes",    role: "Intake / PA",       expected: "matters" },
    { name: "Themis",    role: "Court diary",       expected: "matters" },
    { name: "Plutus",    role: "Finance",           expected: "finance" },
    { name: "Ares",      role: "Conflict checking", expected: "matters" },
    { name: "Gabrielle", role: "Support",           expected: "agents" },
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
  assert.equal(agentSections.sectionForAgent("New Agent", "Orchestrator"), "agents");
  assert.equal(agentSections.sectionForAgent("New Agent", "Support"), "agents");
  assert.equal(agentSections.sectionForAgent("New Agent", "Marketing"), "documents");
});

test("sectionForAgent returns empty for junk input rather than guessing", () => {
  assert.equal(agentSections.sectionForAgent("", ""), "");
  assert.equal(agentSections.sectionForAgent(null, null), "");
  assert.equal(agentSections.sectionForAgent(undefined, undefined), "");
  assert.equal(agentSections.sectionForAgent("Nobody", "Nonsense"), "");
});

test("sectionForAgent is case- and whitespace-tolerant", () => {
  assert.equal(agentSections.sectionForAgent("  XENA  ", ""), "agents");
  assert.equal(agentSections.sectionForAgent("", "  Court Diary  "), "matters");
});

test("VALID_SECTIONS matches the router's screen list", () => {
  ["dashboard", "todo", "finance", "matters", "agents", "memory", "journal", "documents"].forEach((section) => {
    assert.ok(agentSections.VALID_SECTIONS.has(section), `expected ${section} in VALID_SECTIONS`);
  });
});

test("index.html uses the Practice Intelligence primary navigation", () => {
  ["To Do", "Finances", "Matters", "Agents", "Memory", "Journal", "Documents"].forEach((label) => {
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
  assert.ok(
    /Microsoft To Do and LEAP remain[^<]*record-level/.test(indexHtml),
    "To Do tab must state Microsoft To Do and LEAP remain the record-level systems"
  );
  assert.equal(indexHtml.includes("dashboardBusinessTasks"), false, "dashboardBusinessTasks must not appear in the shipped page");
});

test("Agents screen keeps the heading without the intro paragraph", () => {
  assert.ok(indexHtml.includes('<h2 id="agents-title">Agents</h2>'), "Agents heading must remain");
  assert.equal(
    indexHtml.includes("Focused accountability view for the agent roster"),
    false,
    "Agents intro paragraph must not appear in the shipped page"
  );
});

test("index.html defines dedicated Memory and Documents sections", () => {
  assert.ok(indexHtml.includes('id="memory"'), "Memory must be a dedicated section");
  assert.ok(indexHtml.includes('id="documents"'), "Documents must be a dedicated section");
  assert.ok(indexHtml.includes("STATUS.md"), "Memory section must reference STATUS.md");
  assert.ok(indexHtml.includes("memory/YYYY-MM-DD.md"), "Memory section must reference daily memory logs");
  assert.ok(indexHtml.includes("MEMORY.md"), "Memory section must reference long-term memory");
  assert.ok(indexHtml.includes("mistakes.md"), "Memory section must reference corrections");
  assert.ok(indexHtml.includes("Generated-document library"), "Documents section must describe the generated-documents library concept");
  assert.ok(indexHtml.includes("Metadata only"), "Documents section must avoid exposing document contents");
});

test("index.html defines the Journal section and client-side API wiring", () => {
  assert.ok(indexHtml.includes('href="#journal"'), "sidebar must include a Journal nav link");
  assert.ok(indexHtml.includes('data-section="journal"'), "Journal nav link must carry data-section=\"journal\"");
  assert.ok(indexHtml.includes('id="journal"'), "index.html must define a #journal screen section");
  assert.ok(indexHtml.includes('data-screen="journal"'), "#journal screen must expose data-screen=\"journal\" for the router");
  assert.ok(indexHtml.includes("data-journal-list"), "#journal screen must expose the journal list container");
  assert.ok(indexHtml.includes('apiJson("/api/journal")'), "Journal renderer must load from /api/journal");
  assert.ok(indexHtml.includes("secrets, raw emails, client contact details and legal advice"), "Journal tab must state the privacy boundary");
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

test("Agents screen does not render local cache or agent status sections", () => {
  assert.ok(indexHtml.includes('<h2 id="agents-title">Agents</h2>'), "Agents heading must remain");
  assert.ok(indexHtml.includes("Operations snapshot"), "Agents screen must keep the Operations snapshot badge");
  assert.ok(indexHtml.includes("Agent Kanban board"), "Agents screen must render the live Kanban board section");
  assert.equal(indexHtml.includes("Current operations board"), false, "Agents screen must not render the old stale board heading");
  assert.ok(indexHtml.includes("Live privacy-safe task view from Microsoft To Do"), "Agents Kanban must explain the live privacy-safe source");
  assert.ok(indexHtml.includes("data-kanban"), "Agents screen must keep the kanban task board");
  assert.ok(indexHtml.includes('id="newTaskForm"'), "Agents screen must keep the operation-note task form");

  [
    "Agent status",
    "Local-only changes cached in this browser.",
    "Snapshot + local",
    "persistCallout",
    "persistReset",
    "data-agent-status",
    "agent-status-card",
    "agent-status-grid",
    "agentStatusFilter",
    "agentSort",
    "agentsCountTag",
    "agentsRefresh",
    "status-pill",
    "agent-identity",
    "agent-working",
    "agent-last",
    "renderAgentStatus",
    "sortedVisibleAgents",
    "Working shows a live green pulse; Idle shows an amber hold. Colour code stays consistent with each agent's kanban cards.",
    "No agents match this filter.",
    "Adjust the status filter or refresh the seed data.",
    "Agent seed data could not load."
  ].forEach((marker) => {
    assert.equal(indexHtml.includes(marker), false, `removed Agent status marker must not remain: ${marker}`);
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

test("Agent workspace seed avoids stale demo status text", () => {
  const agentText = JSON.stringify(agentData);
  const activityText = JSON.stringify(activityData);
  assert.ok(/Acuity update|live booking/.test(agentText), "agent seed must reflect current booking blocker context");
  assert.ok(activityText.includes("19 July"), "activity seed must reflect current 19 July operations");
  assert.ok(activityText.includes("Mission Control Journal"), "activity seed must include current journal work");
  assert.ok(activityText.includes("Private income column"), "activity seed must include current Mission Control status work");
  assert.ok(activityData.activity.every((item) => String(item.at || "").startsWith("2026-07-19")), "activity feed seed must use current 19 July timestamps");
  assert.ok(indexHtml.includes("Operations snapshot"), "agents screen must label the seed as an operations snapshot");
  assert.ok(indexHtml.includes("Agent Kanban board"), "agents screen must show the live Kanban section");
  assert.ok(!indexHtml.includes("Current operations board"), "agents screen must not show the old stale operations board heading");
  assert.ok(indexHtml.includes('id="newTaskForm"'), "agents screen must keep the add-note task form");
  assert.ok(!indexHtml.includes("Shared communication log"), "agents screen must not show the non-durable shared communication log");
  assert.ok(!indexHtml.includes("Entries cached in this browser"), "agents screen must not show cached-browser wording");
  assert.ok(!indexHtml.includes('id="commsForm"'), "agents screen must not ship the shared communication form");
  assert.ok(!indexHtml.includes('class="comms-list"'), "agents screen must not ship the shared communication list panel");
  assert.ok(!indexHtml.includes("Snapshot + local"), "agents screen must not show the local overlay status badge");
  assert.ok(!indexHtml.includes("Local-only changes cached in this browser."), "agents screen must not show the local-only cache warning");
  assert.ok(!indexHtml.includes("read-only seed JSON"), "agents screen must not show deployment persistence warning copy");
  assert.ok(!indexHtml.includes("persistCallout"), "agents screen must not keep hidden persistence callout markup");
  assert.ok(!indexHtml.includes("persistReset"), "agents screen must not keep hidden persistence reset controls");
  assert.ok(!indexHtml.includes("data-agent-status"), "agents screen must not keep the removed status grid binding");
  assert.ok(!indexHtml.includes("agentStatusFilter"), "agents screen must not keep removed status filter controls");
  assert.ok(!indexHtml.includes("agent-status-card"), "agents screen must not keep removed status card markers");
  assert.ok(indexHtml.includes("localStorage.getItem(OVERLAY_KEY)"), "localStorage overlay read path must remain available");
  assert.ok(indexHtml.includes("localStorage.removeItem(OVERLAY_KEY)"), "localStorage overlay reset path must remain available");
  assert.ok(
    !/10 July|11 July|2026-07-10|2026-07-11|availability works|live booking creation is still blocked/.test(activityText),
    "stale 10 July/11 July demo activity must not return"
  );
  assert.ok(
    !/05 July|Rebuilt daily follow-up worksheet|Cleared 6 lead alerts|Updated ATO pressure card/.test(agentText + activityText),
    "old demo agent and activity statuses must not return"
  );
});

console.log(`\n${passed} check${passed === 1 ? "" : "s"} passed.`);
