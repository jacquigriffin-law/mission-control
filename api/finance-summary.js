const fs = require("node:fs");
const path = require("node:path");

const SUMMARY_FILE = path.join(__dirname, "..", "data", "finance-summary.json");

const DEFAULT_SUMMARY = {
  generatedAt: null,
  source: "No private finance source connected",
  currency: "AUD",
  weeklyIncome: {
    legalAidNsw: null,
    legalAidNt: null,
    privateMatters: null,
    businessTotal: null
  },
  bank: {
    balance: null,
    label: null,
    lastReconciledAt: null
  },
  atoPressure: {
    quarterGstPayable: null,
    accumulatedGstToPay: null,
    runwayVsGst: null,
    incomeTaxLow: null,
    incomeTaxHigh: null,
    assumption: "Informational only; not tax advice."
  },
  bookkeepingHygiene: {
    unallocatedTransactions: null,
    unallocatedBank: null,
    documentsInUploads: null,
    daysSinceReconciled: null
  },
  basTimeline: [
    { quarter: "2026-Q1", period: "Jul-Sep 2025", dueDate: "2025-10-28", netPayable: null, status: "Pending source" },
    { quarter: "2026-Q2", period: "Oct-Dec 2025", dueDate: "2026-02-28", netPayable: null, status: "Pending source" },
    { quarter: "2026-Q3", period: "Jan-Mar 2026", dueDate: "2026-04-28", netPayable: null, status: "Pending source" },
    { quarter: "2026-Q4", period: "Apr-Jun 2026", dueDate: "2026-07-28", netPayable: null, status: "Pending source" }
  ],
  weeklyExpenses: [
    { category: "Accounting, bank fees and tax agent", amount: null },
    { category: "Office, software and subscriptions", amount: null },
    { category: "Motor vehicle, travel and parking", amount: null },
    { category: "Insurance, licences and professional costs", amount: null },
    { category: "Phone, internet and communications", amount: null }
  ],
  profitLoss: {
    period: null,
    totalIncome: null,
    totalExpenses: null,
    operatingProfit: null,
    netProfit: null,
    incomeByCategory: [],
    expensesByCategory: []
  },
  quarterlyBas: {
    quarter: null,
    gstCollected: null,
    gstPaid: null,
    estimatedNetBas: null,
    lodgementStatus: "Pending private source"
  },
  taxReturn2025: {
    annualBusinessIncome: null,
    annualBusinessExpenses: null,
    netSmallBusinessIncome: null,
    taxableIncome: null,
    estimatedTaxPayable: null,
    rentalIncome: null,
    rentalExpenses: null,
    netRentalLoss: null,
    netCapitalGain: null,
    sourceEmailDate: null,
    sourceAttachment: null
  },
  projectionMonths: [
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    "Jan", "Feb", "Mar", "Apr", "May", "Jun"
  ].map((month) => ({ month, income: null, expenses: null })),
  openMatters: {
    byType: [
      { type: "Family law", count: null },
      { type: "Care and protection", count: null },
      { type: "Criminal law", count: null },
      { type: "Domestic violence orders", count: null },
      { type: "Wills and estates", count: null }
    ],
    byFunding: [
      { funding: "Legal Aid NSW funded", count: null },
      { funding: "Legal Aid NT funded", count: null },
      { funding: "Private funded", count: null },
      { funding: "Mixed or unknown", count: null }
    ]
  },
  actions: []
};

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function roundMoney(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100) / 100;
}

function safeProfitLoss(profitLoss) {
  const incomeByCategory = Array.isArray(profitLoss?.incomeByCategory) ? profitLoss.incomeByCategory : [];
  const expensesByCategory = Array.isArray(profitLoss?.expensesByCategory) ? profitLoss.expensesByCategory : [];
  return {
    period: profitLoss?.period || null,
    totalIncome: roundMoney(profitLoss?.totalIncome),
    totalExpenses: roundMoney(profitLoss?.totalExpenses),
    operatingProfit: roundMoney(profitLoss?.operatingProfit),
    netProfit: roundMoney(profitLoss?.netProfit),
    incomeByCategory: incomeByCategory.map((item) => ({
      category: String(item?.category || "").slice(0, 80),
      amount: roundMoney(item?.amount)
    })).filter((item) => item.category && item.amount !== null),
    expensesByCategory: expensesByCategory.map((item) => ({
      category: String(item?.category || "").slice(0, 80),
      amount: roundMoney(item?.amount)
    })).filter((item) => item.category && item.amount !== null)
  };
}

function cleanActionText(value, maxLength) {
  return String(value || "")
    .replace(/client/gi, "private party")
    .replace(/invoice/gi, "billing item")
    .replace(/transaction/gi, "item")
    .replace(/payment/gi, "amount")
    .replace(/matter/gi, "work item")
    .replace(/raw/gi, "source-level")
    .replace(/filename/gi, "source label")
    .slice(0, maxLength);
}

function safeAction(action) {
  return {
    id: String(action.id || "").slice(0, 48),
    title: cleanActionText(action.title, 90),
    detail: cleanActionText(action.detail, 180),
    priority: ["critical", "high", "medium", "low"].includes(action.priority) ? action.priority : "low",
    status: cleanActionText(action.status || "open", 48),
    source: String(action.source || "aggregate").slice(0, 64),
    amount: action.amount === undefined ? null : roundMoney(action.amount),
    dueDate: action.dueDate ? String(action.dueDate).slice(0, 32) : null,
    metric: cleanActionText(action.metric, 80)
  };
}

function buildFinanceActions(summary) {
  const actions = [];
  const ato = summary.atoPressure || {};
  const hygiene = summary.bookkeepingHygiene || {};
  const bas = summary.quarterlyBas || {};
  const basTimeline = Array.isArray(summary.basTimeline) ? summary.basTimeline : [];
  const sourceStatus = [summary.sourceStatus, summary.staleness].filter(Boolean).join("; ");

  if (Number.isFinite(Number(ato.runwayVsGst)) && Number(ato.runwayVsGst) < 0) {
    actions.push({
      id: "gst-runway-shortfall",
      title: "Protect GST cash shortfall",
      detail: "Operating cash is below accumulated GST shown by the finance feed.",
      priority: "critical",
      status: "Needs plan",
      source: "atoPressure",
      amount: Math.abs(Number(ato.runwayVsGst)),
      metric: "Runway vs GST"
    });
  } else if (Number.isFinite(Number(ato.accumulatedGstToPay)) && Number(ato.accumulatedGstToPay) > 0) {
    actions.push({
      id: "gst-reserve-watch",
      title: "Keep GST reserve visible",
      detail: "Accumulated GST to pay is present in the dashboard and should remain separated from operating cash.",
      priority: "high",
      status: "Monitor",
      source: "atoPressure",
      amount: ato.accumulatedGstToPay,
      metric: "Accumulated GST"
    });
  }

  if (Number.isFinite(Number(ato.carriedGstToPay)) && Number(ato.carriedGstToPay) > 0) {
    actions.push({
      id: "carried-gst-pressure",
      title: "Check carried GST pressure",
      detail: "Carried GST pressure remains above the current-quarter estimate.",
      priority: Number(ato.carriedGstToPay) > 10000 ? "high" : "medium",
      status: "Review",
      source: "atoPressure",
      amount: ato.carriedGstToPay,
      metric: "Carried GST"
    });
  }

  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const nextBasTimelineItem = basTimeline
    .filter((item) => item && item.dueDate && !/lodged|paid|complete/i.test(String(item.status || "")))
    .map((item) => ({
      ...item,
      daysFromToday: Math.round((Date.parse(`${item.dueDate}T00:00:00Z`) - todayUtc) / 86400000)
    }))
    .filter((item) => Number.isFinite(item.daysFromToday))
    .sort((a, b) => {
      const aPastPenalty = a.daysFromToday < -30 ? 10000 : 0;
      const bPastPenalty = b.daysFromToday < -30 ? 10000 : 0;
      return (aPastPenalty + Math.abs(a.daysFromToday)) - (bPastPenalty + Math.abs(b.daysFromToday));
    })[0]
    || basTimeline.find((item) => item && item.dueDate);

  if (Number.isFinite(Number(bas.estimatedNetBas)) && Number(bas.estimatedNetBas) > 0) {
    actions.push({
      id: "bas-net-amount",
      title: "Confirm BAS amount and lodgement status",
      detail: bas.status || bas.lodgementStatus || "A BAS net payable amount is visible and needs status confirmation.",
      priority: "high",
      status: "Confirm",
      source: "quarterlyBas",
      amount: bas.estimatedNetBas,
      dueDate: bas.dueDate || bas.due || nextBasTimelineItem?.dueDate || null,
      metric: bas.quarter || "Quarterly BAS"
    });
  } else if (nextBasTimelineItem) {
    actions.push({
      id: "bas-timeline-status",
      title: "Confirm BAS timeline status",
      detail: nextBasTimelineItem.status || "Quarterly BAS status needs source confirmation.",
      priority: /pending|draft|source/i.test(String(nextBasTimelineItem.status || "")) ? "high" : "medium",
      status: "Confirm",
      source: "basTimeline",
      amount: nextBasTimelineItem.netPayable,
      dueDate: nextBasTimelineItem.dueDate,
      metric: nextBasTimelineItem.quarter || "BAS timeline"
    });
  }

  if (Number.isFinite(Number(hygiene.unallocatedTransactions)) && Number(hygiene.unallocatedTransactions) > 0) {
    actions.push({
      id: "unallocated-items",
      title: "Clear unallocated items",
      detail: `${Number(hygiene.unallocatedTransactions)} unallocated items are reducing reliability of category and BAS reporting.`,
      priority: Number(hygiene.unallocatedTransactions) > 50 ? "high" : "medium",
      status: "Open",
      source: "bookkeepingHygiene",
      amount: null,
      metric: "Unallocated total"
    });
  }

  if (Number.isFinite(Number(hygiene.unallocatedBank)) && Number(hygiene.unallocatedBank) > 0) {
    actions.push({
      id: "unallocated-bank-feed",
      title: "Review unallocated bank-feed items",
      detail: `${Number(hygiene.unallocatedBank)} bank-feed items need allocation before the aggregate figures are accountant-ready.`,
      priority: Number(hygiene.unallocatedBank) > 25 ? "high" : "medium",
      status: "Open",
      source: "bookkeepingHygiene",
      amount: null,
      metric: "Unallocated bank"
    });
  }

  if (Number.isFinite(Number(hygiene.documentsInUploads)) && Number(hygiene.documentsInUploads) > 0) {
    actions.push({
      id: "upload-documents",
      title: "Process uploaded MYOB documents",
      detail: `${Number(hygiene.documentsInUploads)} uploaded documents are waiting to be matched or filed.`,
      priority: "medium",
      status: "Open",
      source: "bookkeepingHygiene",
      amount: null,
      metric: "Upload documents"
    });
  }

  if (sourceStatus && /stale/i.test(sourceStatus)) {
    actions.push({
      id: "source-freshness",
      title: "Refresh stale finance source",
      detail: "One or more finance sources are marked stale; keep last verified figures visible until a fresh pull succeeds.",
      priority: "medium",
      status: "Watch",
      source: "sourceStatus",
      amount: null,
      metric: "Source freshness"
    });
  }

  return actions.map(safeAction).filter((action) => action.id && action.title);
}

function derivePrivateFields(summary) {
  const dashboard = summary.myobLive?.dashboard || {};
  const profitLoss = summary.myobLive?.profitLoss || {};
  const gstReturn = summary.myobLive?.gstReturn || {};
  const bankBalance = dashboard.bankBalance;
  const accumulatedGstToPay = dashboard.dashboardGstToPay;
  const quarterGstPayable = summary.quarterlyBas?.estimatedNetBas ?? gstReturn.netPaymentOrRefund;
  const operatingProfit = summary.profitLoss?.operatingProfit ?? profitLoss.operatingProfit;
  const incomeTaxLow = roundMoney(Number(operatingProfit) * 0.325);
  const incomeTaxHigh = roundMoney(Number(operatingProfit) * 0.37);
  const carriedGstToPay = Number.isFinite(Number(accumulatedGstToPay)) && Number.isFinite(Number(quarterGstPayable))
    ? roundMoney(Number(accumulatedGstToPay) - Number(quarterGstPayable))
    : null;
  const runwayVsGst = Number.isFinite(Number(bankBalance)) && Number.isFinite(Number(accumulatedGstToPay))
    ? roundMoney(Number(bankBalance) - Number(accumulatedGstToPay))
    : null;

  return {
    ...summary,
    bank: {
      ...summary.bank,
      balance: summary.bank?.balance ?? bankBalance ?? null,
      label: summary.bank?.label ?? dashboard.bankAccountLabel ?? null
    },
    atoPressure: {
      ...summary.atoPressure,
      quarterGstPayable: summary.atoPressure?.quarterGstPayable ?? quarterGstPayable ?? null,
      accumulatedGstToPay: summary.atoPressure?.accumulatedGstToPay ?? accumulatedGstToPay ?? null,
      carriedGstToPay: summary.atoPressure?.carriedGstToPay ?? carriedGstToPay,
      runwayVsGst: summary.atoPressure?.runwayVsGst ?? runwayVsGst,
      incomeTaxLow: summary.atoPressure?.incomeTaxLow ?? incomeTaxLow,
      incomeTaxHigh: summary.atoPressure?.incomeTaxHigh ?? incomeTaxHigh,
      incomeTaxEstimate: {
        operatingProfitYtd: operatingProfit ?? null,
        lowRate: incomeTaxLow,
        highRate: incomeTaxHigh,
        range: incomeTaxLow !== null && incomeTaxHigh !== null
          ? `${Math.round(incomeTaxLow).toLocaleString("en-AU")}-${Math.round(incomeTaxHigh).toLocaleString("en-AU")}`
          : null,
        assumption: "32.5%-37% marginal estimate for planning only"
      }
    },
    bookkeepingHygiene: {
      ...summary.bookkeepingHygiene,
      unallocatedTransactions: summary.bookkeepingHygiene?.unallocatedTransactions ?? dashboard.unallocatedTransactionsTotal ?? null,
      unallocatedBank: summary.bookkeepingHygiene?.unallocatedBank ?? dashboard.unallocatedBankTransactions ?? null,
      documentsInUploads: summary.bookkeepingHygiene?.documentsInUploads ?? dashboard.documentsInUploads ?? null,
      daysSinceReconciled: summary.bookkeepingHygiene?.daysSinceReconciled ?? "Pending source"
    },
    basTimeline: Array.isArray(summary.basTimeline) && summary.basTimeline.some((item) => item.netPayable !== null || item.status !== "Pending source")
      ? summary.basTimeline
      : [
        { quarter: "2026-Q1", period: "Jul-Sep 2025", dueDate: "2025-10-28", netPayable: null, status: "source pending" },
        { quarter: "2026-Q2", period: "Oct-Dec 2025", dueDate: "2026-02-28", netPayable: null, status: "source pending" },
        { quarter: "2026-Q3", period: "Jan-Mar 2026", dueDate: "2026-04-28", netPayable: quarterGstPayable ?? null, status: summary.quarterlyBas?.lodgementStatus || "MYOB GST return visible" },
        { quarter: "2026-Q4", period: "Apr-Jun 2026", dueDate: "2026-07-28", netPayable: null, status: "draft source pending" }
      ],
    receivables: {
      overdueInvoices: dashboard.overdueInvoices ?? null,
      legalAidNsw: { d0_30: null, d31_60: null, d61_90: null, d90plus: null },
      privateMattersWip: null,
      recentPayments: [],
      ...(summary.receivables || {})
    }
  };
}

function sanitisePrivateSummary(summary) {
  const actions = buildFinanceActions(summary);
  return {
    generatedAt: summary.generatedAt || null,
    source: summary.source || "No private finance source connected",
    currency: summary.currency || "AUD",
    live: Boolean(summary.live),
    sourceStatus: summary.sourceStatus || "missing finance summary source",
    weeklyIncome: summary.weeklyIncome || DEFAULT_SUMMARY.weeklyIncome,
    bank: summary.bank || DEFAULT_SUMMARY.bank,
    atoPressure: summary.atoPressure || DEFAULT_SUMMARY.atoPressure,
    bookkeepingHygiene: summary.bookkeepingHygiene || DEFAULT_SUMMARY.bookkeepingHygiene,
    basTimeline: Array.isArray(summary.basTimeline) ? summary.basTimeline : DEFAULT_SUMMARY.basTimeline,
    weeklyExpenses: Array.isArray(summary.weeklyExpenses) ? summary.weeklyExpenses : DEFAULT_SUMMARY.weeklyExpenses,
    profitLoss: {
      period: summary.profitLoss?.period || null,
      basis: summary.profitLoss?.basis || null,
      totalIncome: roundMoney(summary.profitLoss?.totalIncome),
      totalExpenses: roundMoney(summary.profitLoss?.totalExpenses),
      operatingProfit: roundMoney(summary.profitLoss?.operatingProfit),
      netProfit: roundMoney(summary.profitLoss?.netProfit),
      incomeByCategory: Array.isArray(summary.profitLoss?.incomeByCategory) ? summary.profitLoss.incomeByCategory : [],
      expensesByCategory: Array.isArray(summary.profitLoss?.expensesByCategory) ? summary.profitLoss.expensesByCategory : []
    },
    quarterlyBas: summary.quarterlyBas || DEFAULT_SUMMARY.quarterlyBas,
    legalAidIncome: summary.legalAidIncome || null,
    openMatters: summary.openMatters || DEFAULT_SUMMARY.openMatters,
    projectionMonths: Array.isArray(summary.projectionMonths) ? summary.projectionMonths : DEFAULT_SUMMARY.projectionMonths,
    receivables: summary.receivables || null,
    taxReturn2025: summary.taxReturn2025 || DEFAULT_SUMMARY.taxReturn2025,
    actions
  };
}

function loadRawSummary() {
  if (process.env.FINANCE_SUMMARY_JSON) {
    return {
      parsed: JSON.parse(process.env.FINANCE_SUMMARY_JSON),
      sourceStatus: "env"
    };
  }
  if (fs.existsSync(SUMMARY_FILE)) {
    return {
      parsed: JSON.parse(fs.readFileSync(SUMMARY_FILE, "utf8")),
      sourceStatus: "file"
    };
  }
  return null;
}

function loadSummary() {
  const raw = loadRawSummary();
  if (!raw) {
    return sanitisePrivateSummary({
      ...DEFAULT_SUMMARY,
      live: false,
      sourceStatus: "missing finance summary source"
    });
  }
  const parsed = raw.parsed;
  const merged = {
    ...DEFAULT_SUMMARY,
    ...parsed,
    weeklyIncome: {
      ...DEFAULT_SUMMARY.weeklyIncome,
      ...(parsed.weeklyIncome || {})
    },
    quarterlyBas: {
      ...DEFAULT_SUMMARY.quarterlyBas,
      ...(parsed.quarterlyBas || {})
    },
    bank: {
      ...DEFAULT_SUMMARY.bank,
      ...(parsed.bank || {})
    },
    atoPressure: {
      ...DEFAULT_SUMMARY.atoPressure,
      ...(parsed.atoPressure || {})
    },
    bookkeepingHygiene: {
      ...DEFAULT_SUMMARY.bookkeepingHygiene,
      ...(parsed.bookkeepingHygiene || {})
    },
    profitLoss: {
      ...DEFAULT_SUMMARY.profitLoss,
      ...safeProfitLoss(parsed.profitLoss || parsed.myobLive?.profitLoss || {})
    },
    basTimeline: Array.isArray(parsed.basTimeline) ? parsed.basTimeline : DEFAULT_SUMMARY.basTimeline,
    taxReturn2025: {
      ...DEFAULT_SUMMARY.taxReturn2025,
      ...(parsed.taxReturn2025 || {}),
      sourceAttachment: parsed.taxReturn2025?.sourceAttachment ? "Private source" : null
    },
    live: true,
    sourceStatus: parsed.sourceStatus || `connected:${raw.sourceStatus}`
  };
  return sanitisePrivateSummary(derivePrivateFields(merged));
}

function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  }

  try {
    return sendJson(response, 200, { ok: true, data: loadSummary() });
  } catch (error) {
    return sendJson(response, 500, {
      ok: false,
      error: "finance_summary_parse_failed",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

module.exports = handler;
module.exports.loadSummary = loadSummary;
module.exports.sanitisePrivateSummary = sanitisePrivateSummary;
