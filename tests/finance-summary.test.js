"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const financeSummary = require(path.join(__dirname, "..", "api", "finance-summary.js"));
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

function withFinanceEnv(value, fn) {
  const previous = process.env.FINANCE_SUMMARY_JSON;
  if (value === undefined) {
    delete process.env.FINANCE_SUMMARY_JSON;
  } else {
    process.env.FINANCE_SUMMARY_JSON = value;
  }
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.FINANCE_SUMMARY_JSON;
    } else {
      process.env.FINANCE_SUMMARY_JSON = previous;
    }
  }
}

function financeSection() {
  const match = indexHtml.match(/<section class="screen" id="finance"[\s\S]*?<\/section>/);
  assert.ok(match, "index.html must include the finance screen");
  return match[0];
}

test("FINANCE_SUMMARY_JSON takes priority over data fallback", () => {
  const summary = withFinanceEnv(JSON.stringify({
    generatedAt: "2026-07-19T00:00:00Z",
    sourceStatus: "env_fixture",
    profitLoss: {
      period: "Env period",
      totalIncome: 1234.567,
      totalExpenses: 100,
      operatingProfit: 1134.567,
      netProfit: 1134.567,
      incomeByCategory: [{ category: "envIncome", amount: 1234.567 }],
      expensesByCategory: [{ category: "envExpense", amount: 100 }]
    },
    clients: [{ name: "Private Client" }],
    invoices: [{ number: "INV-PRIVATE" }],
    transactions: [{ description: "Private transaction" }]
  }), () => financeSummary.loadSummary());

  assert.equal(summary.sourceStatus, "env_fixture");
  assert.equal(summary.profitLoss.period, "Env period");
  assert.equal(summary.profitLoss.totalIncome, 1234.57);
  assert.deepEqual(summary.profitLoss.incomeByCategory, [{ category: "envIncome", amount: 1234.57 }]);
});

test("data/finance-summary.json fallback supplies profitLoss when env is absent", () => {
  const summary = withFinanceEnv(undefined, () => financeSummary.loadSummary());
  assert.equal(summary.live, true);
  assert.ok(summary.generatedAt, "fallback summary should expose generatedAt");
  assert.ok(summary.profitLoss.period, "fallback summary should expose profitLoss period");
  assert.equal(typeof summary.profitLoss.netProfit, "number");
  assert.ok(summary.profitLoss.incomeByCategory.length, "fallback summary should expose income categories");
  assert.ok(summary.profitLoss.expensesByCategory.length, "fallback summary should expose expense categories");
});

test("finance API response is allowlisted to privacy-safe aggregate fields", () => {
  const summary = withFinanceEnv(JSON.stringify({
    profitLoss: {
      period: "Safe period",
      totalIncome: 10,
      totalExpenses: 4,
      operatingProfit: 6,
      netProfit: 6,
      incomeByCategory: [{ category: "safeIncome", amount: 10, clientName: "Hidden" }],
      expensesByCategory: [{ category: "safeExpense", amount: 4, rawLine: "Hidden" }]
    },
    client: "Hidden Client",
    clientRecords: [{ name: "Hidden" }],
    invoiceLines: [{ invoice: "Hidden" }],
    paymentLines: [{ payment: "Hidden" }],
    matterDetails: [{ matter: "Hidden" }],
    rawMyob: { transaction: "Hidden" },
    transactions: [{ description: "Hidden" }]
  }), () => financeSummary.loadSummary());

  assert.deepEqual(Object.keys(summary).sort(), [
    "currency",
    "generatedAt",
    "live",
    "profitLoss",
    "source",
    "sourceStatus"
  ]);
  assert.deepEqual(Object.keys(summary.profitLoss).sort(), [
    "expensesByCategory",
    "incomeByCategory",
    "netProfit",
    "operatingProfit",
    "period",
    "totalExpenses",
    "totalIncome"
  ]);
  const serialised = JSON.stringify(summary);
  [
    /Hidden/,
    /client/i,
    /invoice/i,
    /payment/i,
    /matter/i,
    /transaction/i,
    /raw/i
  ].forEach((pattern) => {
    assert.equal(pattern.test(serialised), false, `finance response matched forbidden pattern ${pattern}`);
  });
});

test("Finance screen binds only to profitLoss aggregate fields", () => {
  const section = financeSection();
  const financeBindings = Array.from(section.matchAll(/data-finance="([^"]+)"/g), (match) => match[1]);
  assert.deepEqual(financeBindings.sort(), [
    "profitLoss.netProfit",
    "profitLoss.operatingProfit",
    "profitLoss.period",
    "profitLoss.totalExpenses",
    "profitLoss.totalIncome"
  ].sort());
  assert.ok(section.includes("data-finance-income-categories"), "finance screen must render incomeByCategory");
  assert.ok(section.includes("data-finance-expense-categories"), "finance screen must render expensesByCategory");
  [
    /data-finance="(?!profitLoss\.)/,
    /data-finance-expense="/,
    /data-projection-month/
  ].forEach((pattern) => {
    assert.equal(pattern.test(section), false, `finance screen matched forbidden binding ${pattern}`);
  });
});

console.log(`\n${passed} finance check${passed === 1 ? "" : "s"} passed.`);
