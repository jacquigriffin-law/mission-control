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
  },
  system: {
    source: "OpenClaw workspace safe operating snapshot",
    agentCount: 7,
    agents: [
      { name: "Xena", role: "Orchestrator", workingOn: "Routing, Mission Control, status and verification", tone: "blue" },
      { name: "Hermes", role: "Intake / PA", workingOn: "Lead monitoring, email/SMS triage and client follow-up queues", tone: "amber" },
      { name: "Themis", role: "Court diary", workingOn: "Court dates, calendar risk, Children's Court list checks and morning brief", tone: "red" },
      { name: "Plutus", role: "Finance", workingOn: "BAS, GST, ATO pressure, MYOB hygiene and billing/payment checks", tone: "red" },
      { name: "Ares", role: "Conflict checking", workingOn: "Conflict checks and compliance logging", tone: "green" },
      { name: "Gabrielle", role: "Support", workingOn: "Task organisation and practical follow-up support", tone: "blue" },
      { name: "Marketing", role: "Marketing", workingOn: "Website, public content, SEO and lead-source reporting", tone: "" }
    ],
    memory: [
      { label: "STATUS.md", purpose: "What is happening right now and current deployment notes.", status: "Active" },
      { label: "memory/YYYY-MM-DD.md", purpose: "Daily working log and recent decisions.", status: "Active" },
      { label: "MEMORY.md", purpose: "Long-term curated memory for the main direct session.", status: "Protected" },
      { label: "mistakes.md", purpose: "Corrections and behaviours to avoid repeating.", status: "Watch" }
    ],
    documents: [
      { label: "output/", purpose: "Generated reports, audits, screenshots and working packs. Listed here only because the private workspace is not web-openable from Vercel.", status: "Local files" },
      { label: "input/", purpose: "Source documents provided to the workspace. Listed here only because the private workspace is not web-openable from Vercel.", status: "Local files" },
      { label: "sites/ and mission-control/", purpose: "Website/app source folders deployed through GitHub and Vercel.", status: "Versioned", url: "https://github.com/jacquigriffin-law/mission-control" },
      { label: "skills/", purpose: "Reusable agent scripts and procedures. Listed here only because the private workspace is not web-openable from Vercel.", status: "Versioned" }
    ],
    security: {
      status: "Watch",
      signals: [
        { label: "Secrets", note: "Do not render credentials, tokens or private source file contents.", tone: "red" },
        { label: "Finance", note: "Only aggregate figures are shown; no invoices, transactions or client-linked amounts.", tone: "amber" },
        { label: "Client data", note: "No names, phone numbers, email addresses or matter facts in Mission Control.", tone: "green" },
        { label: "Deployment", note: "Verify GitHub/Vercel state after every published change.", tone: "blue" }
      ]
    },
    fixQueue: [
      { label: "Mission Control stale alias", note: "Old mission-control-v2-opal-one URL still points to a stale June deployment.", tone: "amber" },
      { label: "LeadFlow background runner", note: "Fully hands-off To Do triage needs a scheduled runner beyond app-open sync.", tone: "blue" },
      { label: "LawConnect metrics", note: "Credits, phone minutes, value and conversion fields need source connection.", tone: "blue" }
    ]
  }
};
