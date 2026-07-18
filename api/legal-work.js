const financeSummary = require("./finance-summary.js");

const DEFAULT_SOURCE = require("../data/legal-work.json");

function roundMoney(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100) / 100;
}

function safeCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.round(number));
}

function safeLabel(value, fallback) {
  return String(value || fallback || "Unknown")
    .replace(/[<>]/g, "")
    .slice(0, 80);
}

function safeNote(value, fallback) {
  return String(value || fallback || "")
    .replace(/[<>]/g, "")
    .slice(0, 220);
}

function typeLabel(value) {
  const label = safeLabel(value, "Other or unknown").toLowerCase();
  if (label.includes("care") || label.includes("protection")) return "Care and protection";
  if (label.includes("family")) return "Family law";
  if (label.includes("criminal")) return "Criminal law";
  if (label.includes("domestic") || label.includes("dvo") || label.includes("avo")) return "Domestic violence orders";
  if (label.includes("will") || label.includes("estate") || label.includes("probate")) return "Wills and estates";
  return "Other or unknown";
}

function fundingLabel(value) {
  const label = safeLabel(value, "Mixed or unknown").toLowerCase();
  if (label.includes("legal aid") && label.includes("nsw")) return "Legal Aid NSW";
  if (label.includes("legal aid") && label.includes("nt")) return "Legal Aid NT";
  if (label.includes("private")) return "Private";
  return "Mixed or unknown";
}

function jurisdictionLabel(value) {
  const label = safeLabel(value, "Other or unknown").toLowerCase();
  if (/\bnsw\b|new south wales/.test(label)) return "NSW";
  if (/\bnt\b|northern territory|darwin|katherine|alice springs|palmerston|humpty doo/.test(label)) return "NT";
  return "Other or unknown";
}

function aggregateRows(rows, labelKey, normaliseLabel) {
  const totals = new Map();
  (Array.isArray(rows) ? rows : []).forEach((item) => {
    const count = safeCount(item?.count);
    if (count === null) return;
    const label = normaliseLabel(item?.[labelKey] || item?.label);
    totals.set(label, (totals.get(label) || 0) + count);
  });
  return Array.from(totals, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function safeRows(rows, labelKey) {
  const normalisers = {
    type: typeLabel,
    funding: fundingLabel,
    jurisdiction: jurisdictionLabel
  };
  return aggregateRows(rows, labelKey, normalisers[labelKey] || ((value) => safeLabel(value, "Other or unknown")));
}

function safeJurisdictionIncome(rows) {
  const totals = new Map();
  (Array.isArray(rows) ? rows : []).forEach((item) => {
    const jurisdiction = jurisdictionLabel(item?.jurisdiction);
    const current = totals.get(jurisdiction) || { jurisdiction, total: 0, paymentCount: 0 };
    const total = roundMoney(item?.total);
    const paymentCount = safeCount(item?.recordCount ?? item?.paymentCount);
    if (total !== null) current.total += total;
    if (paymentCount !== null) current.paymentCount += paymentCount;
    totals.set(jurisdiction, current);
  });
  return Array.from(totals.values()).map((item) => ({
    jurisdiction: item.jurisdiction,
    total: roundMoney(item.total),
    paymentCount: safeCount(item.paymentCount)
  }));
}

function safeMonth(value) {
  const text = String(value || "");
  return /^\d{4}-\d{2}$/.test(text) ? text : null;
}

function safeMonthlyOpened(rows) {
  return (Array.isArray(rows) ? rows : []).map((item) => {
    const month = safeMonth(item?.month);
    if (!month) return null;
    return {
      month,
      openedCount: safeCount(item?.openedCount) ?? 0,
      byType: safeRows(item?.byType, "type"),
      byJurisdiction: safeRows(item?.byJurisdiction, "jurisdiction")
    };
  }).filter(Boolean);
}

function safeMonthlyLegalAidIncome(rows, period = {}) {
  const monthMap = new Map();
  let windowMonths = [];
  if (safeMonth(period.startMonth) && safeMonth(period.endMonth)) {
    let [year, month] = period.startMonth.split("-").map(Number);
    const end = period.endMonth;
    while (`${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}` <= end && windowMonths.length < 12) {
      windowMonths.push(`${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}`);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }
  (Array.isArray(rows) ? rows : []).forEach((item) => {
    const month = safeMonth(item?.month);
    if (!month) return;
    const jurisdiction = jurisdictionLabel(item?.jurisdiction);
    if (!["NSW", "NT"].includes(jurisdiction)) return;
    const current = monthMap.get(month) || {
      month,
      total: 0,
      paymentCount: 0,
      byJurisdiction: new Map()
    };
    const jurisdictionRow = current.byJurisdiction.get(jurisdiction) || {
      jurisdiction,
      total: 0,
      paymentCount: 0
    };
    const amount = roundMoney(item?.total);
    const paymentCount = safeCount(item?.recordCount ?? item?.paymentCount) ?? 0;
    if (amount !== null) {
      current.total += amount;
      jurisdictionRow.total += amount;
    }
    current.paymentCount += paymentCount;
    jurisdictionRow.paymentCount += paymentCount;
    current.byJurisdiction.set(jurisdiction, jurisdictionRow);
    monthMap.set(month, current);
  });
  if (!windowMonths.length) {
    windowMonths = Array.from(monthMap.keys()).sort((a, b) => a.localeCompare(b)).slice(-12);
  }
  return windowMonths
    .map((month) => monthMap.get(month) || {
      month,
      total: 0,
      paymentCount: 0,
      byJurisdiction: new Map([
        ["NSW", { jurisdiction: "NSW", total: 0, paymentCount: 0 }],
        ["NT", { jurisdiction: "NT", total: 0, paymentCount: 0 }]
      ])
    })
    .map((item) => ({
      month: item.month,
      total: roundMoney(item.total),
      paymentCount: safeCount(item.paymentCount),
      byJurisdiction: ["NSW", "NT"].map((jurisdiction) => item.byJurisdiction.get(jurisdiction) || {
        jurisdiction,
        total: 0,
        paymentCount: 0
      })
        .sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction))
        .map((jurisdiction) => ({
          jurisdiction: jurisdiction.jurisdiction,
          total: roundMoney(jurisdiction.total),
          paymentCount: safeCount(jurisdiction.paymentCount)
        }))
    }));
}

function buildLegalWork(summary = financeSummary.loadSummary()) {
  const openMatters = summary.openMatters || {};
  const legalAidIncome = summary.legalAidIncome || {};
  const byType = safeRows(openMatters.byType, "type");
  const byFunding = safeRows(openMatters.byFunding, "funding");
  const byJurisdiction = safeRows(openMatters.byJurisdiction, "jurisdiction");
  const monthlyOpened = safeMonthlyOpened(openMatters.monthlyOpened);
  const trendPeriod = openMatters.monthlyOpenedPeriod || {
    startMonth: monthlyOpened[0]?.month || null,
    endMonth: monthlyOpened[monthlyOpened.length - 1]?.month || null,
    basis: "Currently open LEAP aggregate records grouped by instruction date."
  };
  const monthlyLegalAidIncome = safeMonthlyLegalAidIncome(legalAidIncome.monthlyByJurisdiction, trendPeriod);
  const currentMonthJurisdictions = safeJurisdictionIncome(legalAidIncome.currentMonth?.byJurisdiction);
  const activeRecordCount = safeCount(openMatters.activeRecordCount);
  const indexedRecordCount = safeCount(openMatters.recordCount);
  const legalAidPaymentCount = safeCount(legalAidIncome.recordCount);
  const currentMonthPaymentCount = safeCount(legalAidIncome.currentMonth?.recordCount)
    ?? currentMonthJurisdictions.reduce((sum, item) => sum + (item.paymentCount || 0), 0);

  return {
    generatedAt: summary.generatedAt || null,
    source: DEFAULT_SOURCE.source,
    live: Boolean(summary.live && openMatters.available),
    sourceStatus: summary.sourceStatus || null,
    sourceFreshness: {
      leap: /leap.*stale|stale.*leap/i.test(String(summary.sourceStatus || "")) ? "cached aggregate" : "current aggregate",
      legalAid: /legal_aid_email_active/i.test(String(summary.sourceStatus || "")) ? "email aggregate active" : "aggregate source"
    },
    privacyBoundary: DEFAULT_SOURCE.privacyBoundary,
    totals: {
      activeOpenMatters: activeRecordCount,
      indexedMatterRows: indexedRecordCount,
      legalAidPaymentCount
    },
    entities: [
      {
        key: "open-matters",
        name: "Open matters aggregate",
        shortName: "Open matters",
        openMatters: activeRecordCount,
        indexedMatterRows: indexedRecordCount,
        byType,
        jurisdictions: byJurisdiction
      },
      {
        key: "legal-aid-income",
        name: "Legal Aid payment months",
        shortName: "Legal Aid months",
        paymentCount: legalAidPaymentCount
      }
    ],
    typeMix: byType,
    fundingMix: byFunding,
    jurisdictionMix: byJurisdiction,
    legalAidIncome: {
      paymentCount: legalAidPaymentCount,
      latestMonth: legalAidIncome.latestMonth || null,
      currentMonth: legalAidIncome.currentMonth ? {
        month: legalAidIncome.currentMonth.month || null,
        total: roundMoney(legalAidIncome.currentMonth.total),
        paymentCount: currentMonthPaymentCount
      } : null,
      monthlyByJurisdiction: monthlyLegalAidIncome
    },
    trends: {
      period: trendPeriod,
      monthlyOpened,
      monthlyLegalAidIncome,
      matterTypeIncome: {
        available: Boolean(legalAidIncome.matterTypeIncomeMapping?.available),
        note: safeNote(
          legalAidIncome.matterTypeIncomeMapping?.note,
          "Matter-type income mapping is unavailable until payment-to-matter matching is reliable."
        )
      }
    }
  };
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  }

  try {
    return sendJson(response, 200, { ok: true, data: buildLegalWork() });
  } catch (error) {
    return sendJson(response, 500, {
      ok: false,
      error: "legal_work_parse_failed",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

module.exports = handler;
module.exports.buildLegalWork = buildLegalWork;
