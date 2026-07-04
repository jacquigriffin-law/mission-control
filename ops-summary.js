window.MISSION_CONTROL_SAFE_SUMMARY = {
  generatedAt: "2026-07-04T20:55:00+10:00",
  leadFlow: {
    source: "leads-tracker/data.json aggregate snapshot",
    lastUpdated: "2026-07-02T17:47:31+10:00",
    total: 68,
    bySource: [
      { label: "Legal Aid NSW", count: 54 },
      { label: "JGMS website/email", count: 8 },
      { label: "NT Rural & Remote", count: 2 },
      { label: "LawConnect lane", count: 0, placeholder: true },
      { label: "Other / unknown", count: 4 }
    ],
    byStatus: [
      { label: "New", count: 27 },
      { label: "Not a lead", count: 18 },
      { label: "Closed / no response", count: 10 },
      { label: "Declined", count: 5 },
      { label: "Existing matter", count: 4 },
      { label: "Closed", count: 4 }
    ],
    byPriority: [
      { label: "Urgent", count: 25 },
      { label: "High", count: 39 },
      { label: "Medium", count: 3 },
      { label: "Low", count: 1 }
    ],
    byWorkType: [
      { label: "Family law", count: 46 },
      { label: "Care and protection", count: 10 },
      { label: "General", count: 5 },
      { label: "Children's Court", count: 2 },
      { label: "Domestic violence", count: 1 },
      { label: "Other / unknown", count: 4 }
    ],
    triage: {
      todoList: "LeadFlow - Triage Inbox",
      status: "To Do triage sync available",
      pendingReview: 27,
      reviewApproval: 36,
      acceptOrDecline: 19,
      conversionRate: null,
      lawConnectRoi: null
    }
  },
  legalWork: {
    source: "leads/leads-register.json and LeadFlow aggregate snapshot",
    entities: [
      {
        key: "jgms",
        name: "Jacqui Griffin Mobile Solicitor",
        shortName: "JGMS",
        intakeSignals: 3,
        openMatters: null,
        opened30d: null,
        closed30d: null,
        byType: [
          { label: "Care and protection", count: 2 },
          { label: "Domestic violence", count: 1 },
          { label: "Family law", count: 0 },
          { label: "Criminal law", count: 0 },
          { label: "Wills and estates", count: 0 },
          { label: "Other", count: 0 }
        ],
        byFunding: [
          { label: "Legal Aid NSW", count: null },
          { label: "Legal Aid NT", count: null },
          { label: "Private", count: null },
          { label: "Mixed / unknown", count: null }
        ],
        jurisdictions: [
          { label: "Parramatta NSW", count: 3 }
        ]
      },
      {
        key: "fla",
        name: "Family Law Assist",
        shortName: "FLA",
        intakeSignals: 0,
        openMatters: null,
        opened30d: null,
        closed30d: null,
        byType: [
          { label: "Family law", count: 0 },
          { label: "Care and protection", count: 0 },
          { label: "Domestic violence", count: 0 },
          { label: "Criminal law", count: 0 },
          { label: "Wills and estates", count: 0 },
          { label: "Other", count: 0 }
        ],
        byFunding: [
          { label: "Private", count: null },
          { label: "Legal Aid NSW", count: null },
          { label: "Legal Aid NT", count: null },
          { label: "Mixed / unknown", count: null }
        ],
        jurisdictions: [
          { label: "Online / not captured", count: null }
        ]
      },
      {
        key: "nt",
        name: "NT Rural & Remote Legal Services",
        shortName: "NT R&R",
        intakeSignals: 2,
        openMatters: null,
        opened30d: null,
        closed30d: null,
        byType: [
          { label: "Family law", count: 1 },
          { label: "Other", count: 1 },
          { label: "Care and protection", count: 0 },
          { label: "Criminal law", count: 0 },
          { label: "Domestic violence", count: 0 },
          { label: "Wills and estates", count: 0 }
        ],
        byFunding: [
          { label: "Legal Aid NT", count: null },
          { label: "Private", count: null },
          { label: "Legal Aid NSW", count: null },
          { label: "Mixed / unknown", count: null }
        ],
        jurisdictions: [
          { label: "Darwin NT", count: 1 },
          { label: "NT", count: 1 }
        ]
      }
    ]
  }
};
