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

function assertNoPrivateLeak(value) {
  const serialised = JSON.stringify(value);
  [
    /Jane Smith/i,
    /Hidden Client/i,
    /opposing party/i,
    /MAT-\d+/i,
    /26\/1207/i,
    /LA-REF/i,
    /file number/i,
    /court file/i,
    /raw email/i,
    /sender@example\.com/i,
    /subject line/i,
    /transaction line/i,
    /payment line/i,
    /matterRecords/i,
    /clientRecords/i,
    /rawRecords/i,
    /legalAidReferences/i,
    /transactions"\s*:/i,
    /payments"\s*:/i
  ].forEach((pattern) => {
    assert.equal(pattern.test(serialised), false, `legal work output matched forbidden private pattern ${pattern}`);
  });
}

test("legal work feed derives current aggregates from finance summary fallback", () => {
  const summary = legalWork.buildLegalWork();
  assert.equal(summary.live, true);
  assert.equal(summary.totals.activeOpenMatters, 103);
  assert.equal(summary.totals.indexedMatterRows, 1236);
  assert.equal(summary.totals.legalAidIncome, 878592.99);
  assert.equal(summary.totals.legalAidPaymentCount, 94);
  assert.ok(summary.typeMix.some((item) => item.label === "Care and protection" && item.count === 67));
  assert.ok(summary.jurisdictionMix.some((item) => item.label === "NSW" && item.count === 99));
  assert.ok(summary.legalAidIncome.byJurisdiction.some((item) => item.jurisdiction === "NSW" && item.paymentCount === 74));
  assertNoPrivateLeak(summary);
});

test("legal work API allowlists labels from private-shaped source data", () => {
  const summary = legalWork.buildLegalWork({
    generatedAt: "2026-07-19T00:00:00Z",
    live: true,
    sourceStatus: "legal_aid_email_active_leap_current",
    openMatters: {
      available: true,
      activeRecordCount: 3,
      recordCount: 50,
      byType: [
        { type: "Family law - Jane Smith MAT-123", count: 1 },
        { type: "Care and protection 26/1207", count: 1 },
        { type: "Private note about opposing party", count: 1 }
      ],
      byFunding: [
        { funding: "Legal Aid NSW LA-REF-999", count: 1 },
        { funding: "Private Hidden Client", count: 1 },
        { funding: "Payment line $123", count: 1 }
      ],
      byJurisdiction: [
        { jurisdiction: "Parramatta NSW court file 26/1207", count: 2 },
        { jurisdiction: "Darwin NT sender@example.com", count: 1 }
      ],
      matterRecords: [{ clientName: "Jane Smith", matterId: "MAT-123" }]
    },
    legalAidIncome: {
      total: 1234.56,
      recordCount: 2,
      latestMonth: "2026-07",
      byJurisdiction: [
        { jurisdiction: "NSW LA-REF-999", total: 1000, recordCount: 1 },
        { jurisdiction: "NT raw email subject line", total: 234.56, recordCount: 1 }
      ],
      payments: [{ reference: "LA-REF-999", line: "payment line" }],
      rawEmails: [{ sender: "sender@example.com", subject: "subject line" }]
    },
    clientRecords: [{ name: "Hidden Client" }],
    transactions: [{ description: "transaction line" }]
  });

  assert.deepEqual(summary.typeMix, [
    { label: "Care and protection", count: 1 },
    { label: "Family law", count: 1 },
    { label: "Other or unknown", count: 1 }
  ]);
  assert.deepEqual(summary.fundingMix, [
    { label: "Legal Aid NSW", count: 1 },
    { label: "Mixed or unknown", count: 1 },
    { label: "Private", count: 1 }
  ]);
  assert.deepEqual(summary.jurisdictionMix, [
    { label: "NSW", count: 2 },
    { label: "NT", count: 1 }
  ]);
  assertNoPrivateLeak(summary);
});

test("Matters screen loads legal-work API and avoids stale placeholder wording", () => {
  const section = mattersSection();
  assert.ok(indexHtml.includes('fetch("/api/legal-work"'), "Matters tab must fetch the legal work API");
  assert.ok(indexHtml.includes("let legalWorkData = null"), "Matters tab must render from legalWorkData");
  assert.equal(/safeSummary\.legalWork\?\./.test(indexHtml), false, "Matters renderer must not read stale ops-summary legalWork");
  [
    /2026-07-04/,
    /placeholder/i,
    /counts remain placeholders/i,
    /Partial feed/i,
    /leads\/leads-register\.json/i,
    /LeadFlow aggregate snapshot/i
  ].forEach((pattern) => {
    assert.equal(pattern.test(section), false, `Matters screen matched stale wording ${pattern}`);
  });
});

console.log(`\n${passed} legal work check${passed === 1 ? "" : "s"} passed.`);
