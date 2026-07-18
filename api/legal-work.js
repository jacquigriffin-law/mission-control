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

function buildLegalWork(summary = financeSummary.loadSummary()) {
  const openMatters = summary.openMatters || {};
  const legalAidIncome = summary.legalAidIncome || {};
  const byType = safeRows(openMatters.byType, "type");
  const byFunding = safeRows(openMatters.byFunding, "funding");
  const byJurisdiction = safeRows(openMatters.byJurisdiction, "jurisdiction");
  const legalAidByJurisdiction = safeJurisdictionIncome(legalAidIncome.byJurisdiction);
  const currentMonthJurisdictions = safeJurisdictionIncome(legalAidIncome.currentMonth?.byJurisdiction);
  const activeRecordCount = safeCount(openMatters.activeRecordCount);
  const indexedRecordCount = safeCount(openMatters.recordCount);
  const legalAidPaymentCount = safeCount(legalAidIncome.recordCount);
  const legalAidTotal = roundMoney(legalAidIncome.total);
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
      legalAidIncome: legalAidTotal,
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
        name: "Legal Aid income aggregate",
        shortName: "Legal Aid income",
        totalIncome: legalAidTotal,
        paymentCount: legalAidPaymentCount,
        byJurisdiction: legalAidByJurisdiction
      }
    ],
    typeMix: byType,
    fundingMix: byFunding,
    sourceMix: [
      activeRecordCount === null ? null : {
        label: "Open matters index",
        count: activeRecordCount
      },
      legalAidPaymentCount === null ? null : {
        label: "Legal Aid aggregate payments",
        count: legalAidPaymentCount
      }
    ].filter(Boolean),
    jurisdictionMix: byJurisdiction,
    legalAidIncome: {
      total: legalAidTotal,
      paymentCount: legalAidPaymentCount,
      latestMonth: legalAidIncome.latestMonth || null,
      currentMonth: legalAidIncome.currentMonth ? {
        month: legalAidIncome.currentMonth.month || null,
        total: roundMoney(legalAidIncome.currentMonth.total),
        paymentCount: currentMonthPaymentCount
      } : null,
      byJurisdiction: legalAidByJurisdiction
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
