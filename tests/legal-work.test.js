"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const legalWork = require(path.join(__dirname, "..", "api", "legal-work.js"));
const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

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

function mattersSection() {
  const match = indexHtml.match(/<section class="screen" id="matters"[\s\S]*?<\/section>/);
  assert.ok(match, "index.html must include the matters screen");
  return match[0];
}

test("legal work API derives from finance summary aggregates", () => {
  const summary = {
    generatedAt: "2026-07-19T04:30:00+10:00",
    live: true,
    sourceStatus: "legal_aid_email_active_myob_baseline_stale_leap_cache_stale",
    openMatters: {
      available: true,
      activeRecordCount: 103,
      recordCount: 1236,
      byType: [
        { type: "Care and protection", count: 67, matterName: "Hidden" },
        { type: "Family law", count: 16, clientName: "Hidden" }
      ],
      byFunding: [
        { funding: "Mixed or unknown", count: 103, fileNumber: "26/0000" }
      ],
      byJurisdiction: [
        { jurisdiction: "NSW", count: 99, legalAidReference: "A000000" },
        { jurisdiction: "NT", count: 4, rawEmail: "hidden@example.com" }
      ]
    },
    legalAidIncome: {
      total: 878592.99,
      recordCount: 94,
      latestMonth: "2026-07",
      currentMonth: { month: "2026-07", total: 24214.3, byJurisdiction: [{ jurisdiction: "NSW", total: 24214.3, recordCount: 1 }], paymentLines: ["hidden"] },
      byJurisdiction: [
        { jurisdiction: "NSW", total: 863346.99, recordCount: 74, rawPaymentLine: "hidden" },
        { jurisdiction: "NT", total: 15246, recordCount: 20, emailSubject: "hidden" }
      ]
    }
  };

  const data = legalWork.buildLegalWork(summary);
  assert.equal(data.totals.activeOpenMatters, 103);
  assert.equal(data.totals.indexedMatterRows, 1236);
  assert.equal(data.totals.legalAidIncome, 878592.99);
  assert.equal(data.totals.legalAidPaymentCount, 94);
  assert.deepEqual(data.sourceFreshness, {
    leap: "cached aggregate",
    legalAid: "email aggregate active"
  });
  assert.deepEqual(data.typeMix, [
    { label: "Care and protection", count: 67 },
    { label: "Family law", count: 16 }
  ]);
  assert.deepEqual(data.jurisdictionMix, [
    { label: "NSW", count: 99 },
    { label: "NT", count: 4 }
  ]);
  assert.deepEqual(data.legalAidIncome.byJurisdiction, [
    { jurisdiction: "NSW", total: 863346.99, paymentCount: 74 },
    { jurisdiction: "NT", total: 15246, paymentCount: 20 }
  ]);
  assert.equal(data.legalAidIncome.currentMonth.paymentCount, 1);
});

test("legal work API response is privacy allowlisted", () => {
  const data = legalWork.buildLegalWork({
    generatedAt: "2026-07-19T04:30:00+10:00",
    live: true,
    sourceStatus: "fixture",
    openMatters: {
      available: true,
      activeRecordCount: 1,
      recordCount: 1,
      byType: [{ type: "Family law", count: 1, clientName: "Do Not Show" }],
      byFunding: [{ funding: "Legal Aid NSW funded", count: 1, matterId: "MAT-PRIVATE" }],
      byJurisdiction: [{ jurisdiction: "NSW", count: 1, fileNumber: "26/9999" }]
    },
    legalAidIncome: {
      total: 100,
      recordCount: 2,
      latestMonth: "2026-07",
      currentMonth: { month: "2026-07", total: 100, recordCount: 2, legalAidReference: "A123456" },
      byJurisdiction: [{ jurisdiction: "NSW", total: 100, recordCount: 2, paymentLines: ["Private line"] }]
    },
    clientName: "Do Not Show",
    matterName: "Do Not Show",
    matterId: "Do Not Show",
    fileNumber: "Do Not Show",
    legalAidReference: "Do Not Show",
    rawEmail: "Do Not Show",
    paymentLines: ["Do Not Show"]
  });

  assert.deepEqual(Object.keys(data).sort(), [
    "entities",
    "fundingMix",
    "generatedAt",
    "jurisdictionMix",
    "legalAidIncome",
    "live",
    "privacyBoundary",
    "source",
    "sourceFreshness",
    "sourceMix",
    "sourceStatus",
    "totals",
    "typeMix"
  ]);

  const serialised = JSON.stringify(data);
  [
    /Do Not Show/,
    /MAT-PRIVATE/,
    /26\/9999/,
    /A123456/,
    /clientName/,
    /matterName/,
    /matterId/,
    /fileNumber/,
    /legalAidReference/,
    /rawEmail/,
    /paymentLines/,
    /rawPaymentLine/,
    /emailSubject/
  ].forEach((pattern) => {
    assert.equal(pattern.test(serialised), false, `legal work response matched forbidden pattern ${pattern}`);
  });
});

test("Matters screen fetches /api/legal-work and avoids stale placeholder source wording", () => {
  const section = mattersSection();
  assert.ok(indexHtml.includes('fetch("/api/legal-work"'), "frontend must fetch /api/legal-work");
  assert.ok(indexHtml.includes("let legalWorkData = null"), "frontend must not initialise legal work from stale ops-summary.js");
  assert.ok(indexHtml.includes("mattersHeroCount"), "overview matters count must use the live legal work feed");
  assert.ok(indexHtml.includes("renderLegalWork();"), "frontend must render legal work after API data loads");
  assert.equal(/safeSummary\.legalWork\?\./.test(indexHtml), false, "frontend must not read matters from stale safeSummary.legalWork");
  assert.ok(indexHtml.includes("safeSummary.legalWork = legalWorkData"), "frontend may update dashboard counters from the fresh API payload");
  assert.equal(/data-safe="legalWork/.test(indexHtml), false, "frontend must not bind legal work counters to stale safe summary data");
  [
    /placeholder/i,
    /stale/i,
    /2026-07-04/i,
    /MISSION_CONTROL_SAFE_SUMMARY\.legalWork/,
    /Counts remain placeholders/i
  ].forEach((pattern) => {
    assert.equal(pattern.test(section), false, `Matters screen matched stale wording ${pattern}`);
  });
});

console.log(`\n${passed} legal work check${passed === 1 ? "" : "s"} passed.`);
