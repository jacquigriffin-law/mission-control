// Lightweight sanity checks for the System Map tab.  Run with `node tests/system-map.test.js`.
// The goals are:
//   * every url mentioned by the map or launcher list must belong to the
//     safe-host allowlist,
//   * safe-host lookups must fall back to empty string for anything outside
//     the allowlist,
//   * the map data must not accidentally leak local filesystem paths, credential
//     shaped strings, or email/phone numbers.
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const safeHosts = require(path.join(__dirname, "..", "lib", "safe-hosts.js"));
const systemMap = require(path.join(__dirname, "..", "lib", "system-map-data.js"));

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

console.log(`\n${passed} check${passed === 1 ? "" : "s"} passed.`);
