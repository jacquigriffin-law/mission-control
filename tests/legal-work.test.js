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
  assert.equal(summary.totals.legalAidPaymentCount, 94);
  assert.equal(Object.hasOwn(summary.totals, "legalAidIncome"), false);
  assert.equal(Object.hasOwn(summary.legalAidIncome, "total"), false);
  assert.equal(Object.hasOwn(summary.legalAidIncome, "byJurisdiction"), false);
  assert.ok(summary.typeMix.some((item) => item.label === "Care and protection" && item.count === 67));
  assert.deepEqual(summary.fundingMix, [{ label: "Mixed or unknown", count: 103 }]);
  assert.ok(summary.jurisdictionMix.some((item) => item.label === "NSW" && item.count === 99));
  assert.equal(summary.trends.monthlyOpened.length, 12);
  assert.ok(summary.trends.monthlyOpened.some((item) => item.month === "2026-02" && item.openedCount === 13));
  assert.ok(summary.trends.monthlyLegalAidIncome.some((item) => item.month === "2026-07" && item.total === 24214.3));
  assert.equal(summary.trends.matterTypeIncome.available, false);
  assert.match(summary.trends.matterTypeIncome.note, /unavailable\/pending/i);
  assert.equal(Object.hasOwn(summary, "entities"), false);
  assert.equal(Object.hasOwn(summary, "sourceMix"), false);
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
      monthlyOpened: [
        {
          month: "2026-07",
          openedCount: 2,
          byType: [{ type: "Care and protection 26/1207", count: 2 }],
          byJurisdiction: [{ jurisdiction: "NSW court file 26/1207", count: 2 }],
          matterRecords: [{ clientName: "Jane Smith" }]
        },
        { month: "bad-client-month", openedCount: 100, byType: [{ type: "Hidden Client", count: 100 }] }
      ],
      matterRecords: [{ clientName: "Jane Smith", matterId: "MAT-123" }]
    },
    legalAidIncome: {
      total: 1234.56,
      recordCount: 2,
      latestMonth: "2026-07",
      matterTypeIncomeMapping: {
        available: false,
        note: "Matter-type income mapping is unavailable/pending until aggregate remittances can be reliably matched to matters."
      },
      byJurisdiction: [
        { jurisdiction: "NSW LA-REF-999", total: 1000, recordCount: 1 },
        { jurisdiction: "NT raw email subject line", total: 234.56, recordCount: 1 }
      ],
      monthlyByJurisdiction: [
        { month: "2026-07", jurisdiction: "NSW LA-REF-999", total: 1000, recordCount: 1 },
        { month: "2026-07", jurisdiction: "Darwin NT sender@example.com", total: 234.56, recordCount: 1 },
        { month: "client-month", jurisdiction: "Hidden Client", total: 9999, recordCount: 9 }
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
  assert.deepEqual(summary.trends.monthlyOpened, [
    {
      month: "2026-07",
      openedCount: 2,
      byType: [{ label: "Care and protection", count: 2 }],
      byJurisdiction: [{ label: "NSW", count: 2 }]
    }
  ]);
  assert.deepEqual(summary.trends.monthlyLegalAidIncome, [
    {
      month: "2026-07",
      total: 1234.56,
      paymentCount: 2,
      byJurisdiction: [
        { jurisdiction: "NSW", total: 1000, paymentCount: 1 },
        { jurisdiction: "NT", total: 234.56, paymentCount: 1 }
      ]
    }
  ]);
  assert.equal(Object.hasOwn(summary.totals, "legalAidIncome"), false);
  assert.equal(Object.hasOwn(summary.legalAidIncome, "total"), false);
  assert.equal(Object.hasOwn(summary.legalAidIncome, "byJurisdiction"), false);
  assert.equal(Object.hasOwn(summary, "entities"), false);
  assert.match(summary.trends.matterTypeIncome.note, /unavailable\/pending/i);
  assertNoPrivateLeak(summary);
});

test("Matters screen loads legal-work API and avoids stale placeholder wording", () => {
  const section = mattersSection();
  assert.ok(indexHtml.includes('fetch("/api/legal-work"'), "Matters tab must fetch the legal work API");
  assert.ok(indexHtml.includes("let legalWorkData = null"), "Matters tab must render from legalWorkData");
  assert.equal(/safeSummary\.legalWork\?\./.test(indexHtml), false, "Matters renderer must not read stale ops-summary legalWork");
  assert.equal(section.includes("data-entity-cards"), false, "Matters screen must not render entity summary cards");
  assert.equal(section.includes('<h2 id="matters-title">Matters</h2>'), false, "Matters screen must not render the top intro heading");
  assert.equal(section.includes("Current matter mix and 12-month opening/payment trends"), false, "Matters screen must not render the top intro copy");
  assert.equal(section.includes('aria-labelledby="matters-title"'), false, "Matters screen must not reference the removed heading");
  assert.ok(section.includes("Matter type mix"), "Matters screen must keep matter type mix as the first useful card");
  assert.ok(section.indexOf("Matter type mix") < section.indexOf("Jurisdiction"), "Matters screen must start with useful matter type mix before jurisdiction");
  assert.ok(section.includes('data-entity-bars="full"'), "Matters screen must keep matter type mix binding");
  assert.equal(section.includes("data-matter-funding-bars"), false, "Matters screen must not render funding mix binding");
  assert.equal(section.includes("Funding mix"), false, "Matters screen must not render funding mix card");
  assert.ok(section.includes("data-matter-jurisdiction-bars"), "Matters screen must keep jurisdiction split binding");
  assert.ok(section.includes("data-matter-opened-trends"), "Matters screen must show last-12-month opened matter trends");
  assert.ok(section.includes("Open Matters last 12 months"), "Matters screen must use Jacqui's open matters heading");
  assert.equal(section.includes("Opened matters, last 12 months"), false, "Matters screen must not use the old opened matters heading");
  assert.ok(section.includes("data-matter-income-trends"), "Matters screen must show monthly Legal Aid income trends");
  assert.ok(section.includes("Legal Aid income by month and jurisdiction"), "Matters screen must label Legal Aid income by month and jurisdiction");
  assert.equal(section.includes("mattersLiveStatus"), false, "Matters section header must not render a live status badge");
  assert.equal(/\\$878,?593|878592\\.99/.test(section), false, "Matters screen must not lead with the all-time Legal Aid total");
  [
    /aggregate/i,
    /Live legal work feed/i,
    /Open matters aggregate/i,
    /Legal Aid income aggregate/i,
    /Legal Aid payment months/i,
    /entity-card/i,
    /2026-07-04/,
    /placeholder/i,
    /counts remain placeholders/i,
    /Partial feed/i,
    /leads\/leads-register\.json/i,
    /LeadFlow aggregate snapshot/i,
    /Source lanes/i,
    /data-matter-source-bars/i,
    /Privacy boundary/i,
    /Displayed here/i,
    /Not displayed here/i,
    /Source systems/i,
    /Legal Aid income totals/i
  ].forEach((pattern) => {
    assert.equal(pattern.test(section), false, `Matters screen matched stale wording ${pattern}`);
  });
  assert.equal(/data-matter-source-bars/.test(indexHtml), false, "removed source bars renderer must not remain in index.html");
  assert.equal(/data-matter-funding-bars/.test(indexHtml), false, "removed funding bars renderer must not remain in index.html");
  assert.equal(/data-entity-cards/.test(indexHtml), false, "removed entity cards renderer must not remain in index.html");
  assert.equal(/entity-card/.test(indexHtml), false, "removed entity card CSS must not remain in index.html");
  assert.equal(/legalWorkData\?\.entities/.test(indexHtml), false, "Matters renderer must not read removed entities output");
  assert.equal(/sourceMix/.test(indexHtml), false, "Matters renderer must not read removed sourceMix output");
  assert.equal(/totals\.legalAidIncome/.test(indexHtml), false, "Matters renderer must not display all-time Legal Aid income");
  assert.equal(/mattersLiveStatus|setMattersStatus/.test(indexHtml), false, "removed Matters live status binding must not remain in index.html");
});

console.log(`\n${passed} legal work check${passed === 1 ? "" : "s"} passed.`);
