const DEFAULT_SUMMARY = {
  generatedAt: null,
  source: "No private finance source connected",
  currency: "AUD",
  weeklyIncome: {
    legalAidNsw: null,
    legalAidNt: null,
    privateMatters: null
  },
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

function getPin(request) {
  const headerPin = request.headers["x-finance-pin"];
  if (Array.isArray(headerPin)) return headerPin[0] || "";
  if (headerPin) return headerPin;
  try {
    const url = new URL(request.url || "", `https://${request.headers.host || "localhost"}`);
    return url.searchParams.get("pin") || "";
  } catch {
    return "";
  }
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
  return {
    ...DEFAULT_SUMMARY,
    ...parsed,
    taxReturn2025: {
      ...DEFAULT_SUMMARY.taxReturn2025,
      ...(parsed.taxReturn2025 || {})
    },
    live: true,
    sourceStatus: parsed.sourceStatus || "connected"
  };
}

module.exports = function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  }

  const requiredPin = process.env.MISSION_CONTROL_FINANCE_PIN || "";
  if (!requiredPin) {
    return sendJson(response, 503, {
      ok: false,
      error: "finance_pin_not_configured",
      message: "Set MISSION_CONTROL_FINANCE_PIN in Vercel before serving private finance data."
    });
  }

  if (getPin(request) !== requiredPin) {
    return sendJson(response, 401, { ok: false, error: "unauthorised" });
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
