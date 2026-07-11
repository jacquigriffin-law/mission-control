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
    ],
    fundingMix: [
      { label: "Legal Aid NSW", count: 54, note: "Aggregate intake signals routed through the NSW panel." },
      { label: "Legal Aid NT", count: null, note: "Aggregate placeholder until NT export lands." },
      { label: "Private", count: null, note: "Private-fee matters — awaiting MYOB or LEAP export." },
      { label: "Mixed / unknown", count: 4, note: "Records missing an explicit funding tag." }
    ],
    sourceMix: [
      { label: "JGMS", count: 3, note: "Signals arriving via the JGMS website and direct email." },
      { label: "FLA", count: 0, note: "Family Law Assist landing enquiries." },
      { label: "NT Rural & Remote", count: 2, note: "Signals arriving via the NT Rural & Remote site." },
      { label: "Legal Aid NSW panel", count: 54, note: "Panel assignments logged in LeadFlow." },
      { label: "LawConnect", count: 0, placeholder: true, note: "Reserved lane for LawConnect ROI once source connects." }
    ],
    jurisdictionMix: [
      { label: "Parramatta NSW", count: 3, note: "JGMS matters currently visible." },
      { label: "Darwin NT", count: 1, note: "NT Rural & Remote signal captured with a Darwin marker." },
      { label: "NT (rural/remote)", count: 1, note: "NT signal without a specific town captured." },
      { label: "Online / not captured", count: null, note: "FLA online intake pending source." }
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
      { label: "STATUS.md", purpose: "What is happening right now and current deployment notes.", status: "Active", category: "Status" },
      { label: "memory/YYYY-MM-DD.md", purpose: "Daily working log — chats, actions and decisions of the day.", status: "Active", category: "Daily log" },
      { label: "MEMORY.md", purpose: "Long-term curated memory for the main direct session.", status: "Protected", category: "Long term" },
      { label: "mistakes.md", purpose: "Corrections and behaviours to avoid repeating.", status: "Watch", category: "Corrections" },
      { label: "decisions/", purpose: "Point-in-time decisions with the reasoning behind them.", status: "Active", category: "Decisions" },
      { label: "searchable history", purpose: "Concept: a searchable index across daily logs, decisions and corrections. Content stays private on device.", status: "Concept", category: "Search" }
    ],
    memoryCategories: [
      { label: "Daily chats", note: "Working conversations kept as private daily logs.", tone: "blue" },
      { label: "Decisions", note: "Point-in-time choices with the reasoning captured.", tone: "green" },
      { label: "Corrections", note: "Explicit mistakes.md entries to avoid repeating.", tone: "amber" },
      { label: "Status", note: "Current STATUS.md — what is happening right now.", tone: "" },
      { label: "Long-term memory", note: "MEMORY.md long-lived facts for the main session.", tone: "violet" },
      { label: "Searchable history", note: "Concept lane for full-text search across the above.", tone: "" }
    ],
    documents: [
      { label: "output/", purpose: "Generated reports, audits, screenshots and working packs (local files).", status: "Local files", category: "Reports" },
      { label: "input/", purpose: "Source documents provided to the workspace (local files).", status: "Local files", category: "Source" },
      { label: "sites/ and mission-control/", purpose: "Website/app source folders deployed through GitHub and Vercel.", status: "Versioned", category: "Deployed", url: "https://github.com/jacquigriffin-law/mission-control" },
      { label: "skills/", purpose: "Reusable agent scripts and procedures (local files).", status: "Versioned", category: "Skills" }
    ],
    documentCategories: [
      { label: "Reports", note: "Aggregate reports and audits generated by agents.", agent: "Plutus / Xena", tone: "blue" },
      { label: "Drafts", note: "Draft letters, submissions and marketing copy.", agent: "Marketing", tone: "" },
      { label: "Audits", note: "Compliance, workflow and cost audits.", agent: "Ares / Plutus", tone: "green" },
      { label: "Finance summaries", note: "BAS packs, GST snapshots and ATO pressure summaries.", agent: "Plutus", tone: "red" },
      { label: "Court instructions", note: "Instruction packs and court-diary briefings.", agent: "Themis", tone: "amber" },
      { label: "Conflict checks", note: "Conflict-check records tied to new intakes.", agent: "Ares", tone: "violet" },
      { label: "Marketing drafts", note: "Website content, SEO copy and campaign drafts.", agent: "Marketing", tone: "" }
    ],
    documentStatuses: [
      { label: "Draft", note: "Being prepared by an agent." },
      { label: "Review", note: "Awaiting Jacqui review or approval." },
      { label: "Ready", note: "Signed off and ready to send or file." },
      { label: "Sent / filed", note: "Delivered to the recipient or court." }
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
