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
  }
};

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function roundMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100) / 100;
}

function derivePrivateFields(summary) {
  const dashboard = summary.myobLive?.dashboard || {};
  const profitLoss = summary.myobLive?.profitLoss || {};
  const gstReturn = summary.myobLive?.gstReturn || {};
  const bankBalance = dashboard.bankBalance;
  const accumulatedGstToPay = dashboard.dashboardGstToPay;
  const quarterGstPayable = summary.quarterlyBas?.estimatedNetBas ?? gstReturn.netPaymentOrRefund;
  const operatingProfit = profitLoss.operatingProfit;
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
  const safe = { ...summary };
  delete safe.myobLive;
  delete safe.rawMyob;
  delete safe.rawRecords;
  delete safe.transactions;
  delete safe.clients;
  delete safe.clientRecords;
  return safe;
}

function loadSummary() {
  const raw = process.env.FINANCE_SUMMARY_JSON;
  if (!raw) {
    return {
      ...DEFAULT_SUMMARY,
      live: false,
      sourceStatus: "missing FINANCE_SUMMARY_JSON"
    };
  }
  const parsed = JSON.parse(raw);
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
    basTimeline: Array.isArray(parsed.basTimeline) ? parsed.basTimeline : DEFAULT_SUMMARY.basTimeline,
    taxReturn2025: {
      ...DEFAULT_SUMMARY.taxReturn2025,
      ...(parsed.taxReturn2025 || {}),
      sourceAttachment: parsed.taxReturn2025?.sourceAttachment ? "Private source" : null
    },
    live: true,
    sourceStatus: parsed.sourceStatus || "connected"
  };
  return sanitisePrivateSummary(derivePrivateFields(merged));
}

module.exports = function handler(request, response) {
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
};
