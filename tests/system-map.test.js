// Lightweight sanity checks for the System Map tab.  Run with `node tests/system-map.test.js`.
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
const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const taskData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "tasks.json"), "utf8"));

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
  const validSections = new Set(["dashboard", "finance", "matters", "leads", "system", "agents", "system-map"]);
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
    { name: "Xena",      role: "Orchestrator",      expected: "system-map" },
    { name: "Hermes",    role: "Intake / PA",       expected: "leads" },
    { name: "Themis",    role: "Court diary",       expected: "matters" },
    { name: "Plutus",    role: "Finance",           expected: "finance" },
    { name: "Ares",      role: "Conflict checking", expected: "matters" },
    { name: "Gabrielle", role: "Support",           expected: "agents" },
    { name: "Marketing", role: "Marketing",         expected: "agents" }
  ];
  roster.forEach(({ name, role, expected }) => {
    const actual = agentSections.sectionForAgent(name, role);
    assert.equal(actual, expected, `${name} (${role}) should map to #${expected} but got ${actual || "<empty>"}`);
    assert.ok(agentSections.VALID_SECTIONS.has(actual), `${name} mapped to unknown section ${actual}`);
  });
});

test("sectionForAgent falls back to role when the name is unknown", () => {
  assert.equal(agentSections.sectionForAgent("New Agent", "Intake"), "leads");
  assert.equal(agentSections.sectionForAgent("New Agent", "PA"), "leads");
  assert.equal(agentSections.sectionForAgent("New Agent", "Court diary"), "matters");
  assert.equal(agentSections.sectionForAgent("New Agent", "Conflict checking"), "matters");
  assert.equal(agentSections.sectionForAgent("New Agent", "Finance"), "finance");
  assert.equal(agentSections.sectionForAgent("New Agent", "Orchestrator"), "system-map");
  assert.equal(agentSections.sectionForAgent("New Agent", "Support"), "agents");
});

test("sectionForAgent returns empty for junk input rather than guessing", () => {
  assert.equal(agentSections.sectionForAgent("", ""), "");
  assert.equal(agentSections.sectionForAgent(null, null), "");
  assert.equal(agentSections.sectionForAgent(undefined, undefined), "");
  assert.equal(agentSections.sectionForAgent("Nobody", "Nonsense"), "");
});

test("sectionForAgent is case- and whitespace-tolerant", () => {
  assert.equal(agentSections.sectionForAgent("  XENA  ", ""), "system-map");
  assert.equal(agentSections.sectionForAgent("", "  Court Diary  "), "matters");
});

test("VALID_SECTIONS matches the router's screen list", () => {
  ["dashboard", "finance", "matters", "leads", "system", "system-map", "agents"].forEach((section) => {
    assert.ok(agentSections.VALID_SECTIONS.has(section), `expected ${section} in VALID_SECTIONS`);
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

test("index.html renders agent rows as anchors when a section is known", () => {
  assert.ok(
    indexHtml.includes('class="row row-nav"'),
    "System agent rows must render as row-nav anchors so mobile users can tap them"
  );
  assert.ok(
    indexHtml.includes('class="agent-status-card is-nav"'),
    "Agent status cards must render as is-nav anchors so mobile users can tap them"
  );
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
    taskData.tasks.some((task) => /Gabrielle booking bridge/i.test(task.title)),
    "task seed data must reflect the current Gabrielle/Acuity blocker"
  );
  assert.ok(
    taskData.tasks.some((task) => /Mission Control/i.test(task.title) && task.status === "In Progress"),
    "task seed data must include the current Mission Control fix in progress"
  );
  assert.ok(
    !taskData.tasks.some((task) => /Draft weekly content brief|MYOB unallocated bank items/i.test(task.title)),
    "old demo Kanban tasks must not return"
  );
});

console.log(`\n${passed} check${passed === 1 ? "" : "s"} passed.`);
