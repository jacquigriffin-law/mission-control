// System Map data.  Structure only — no secrets, no client / matter data,
// no memory contents, no local file paths.  Every external `url` must belong
// to a host listed in lib/safe-hosts.js SAFE_HOSTS or it will be dropped by
// the render code.
(function (root) {
  "use strict";

  var DATA = {
    lede: "How Mission Control fits together. Tap the hub nodes to jump between sections here, or the outer nodes to open the safe public site in a new tab. Structure only — no client, matter or memory data.",

    // Hub nodes route to other sections in this dashboard.
    hubs: [
      { id: "mc",       label: "Mission Control", type: "hub",    x: 50, y: 50, desc: "You are here.  Central operations view.", section: "dashboard" },
      { id: "finance",  label: "Finance",         type: "hub",    x: 22, y: 22, desc: "Plutus finance feed — cash, GST/BAS pressure and hygiene.", section: "finance" },
      { id: "matters",  label: "Legal Work",      type: "hub",    x: 78, y: 22, desc: "JGMS, FLA and NT Rural aggregate work mix.", section: "matters" },
      { id: "leads",    label: "Leads",           type: "hub",    x: 22, y: 78, desc: "LeadFlow counters, source mix and triage lanes.", section: "leads" },
      { id: "system",   label: "System",          type: "hub",    x: 78, y: 78, desc: "Agents, memory lanes, documents and security signals.", section: "system" },
      { id: "agents",   label: "Agents",          type: "hub",    x: 50, y: 88, desc: "Agent status, kanban tasks and the shared log.", section: "agents" }
    ],

    // Site nodes open a safe public URL in a new tab.
    sites: [
      { id: "leadflow",  label: "LeadFlow",              type: "site", x: 8,  y: 55, url: "https://leads-tracker-eta.vercel.app",           desc: "Prospective lead intake and triage." },
      { id: "jgms",      label: "JGMS",                  type: "site", x: 92, y: 40, url: "https://mobilesolicitor.vercel.app",              desc: "Jacqui Griffin Mobile Solicitor public site." },
      { id: "fla",       label: "Family Law Assist",     type: "site", x: 92, y: 60, url: "https://familylawassist.net.au",                  desc: "FLA landing and information site." },
      { id: "ntrural",   label: "NT Rural & Remote",     type: "site", x: 50, y: 12, url: "https://ntruralremotelegalservices.com.au",       desc: "NT Rural and Remote Legal Services information site." },
      { id: "sb-public", label: "Second Brain (public)", type: "brain",x: 8,  y: 30, url: "https://rubric-second-brain.vercel.app",          desc: "Redacted public workspace map." },
      { id: "sb-private",label: "Second Brain (private)",type: "brain",x: 8,  y: 78, url: "https://rubric-second-brain-private.vercel.app",  desc: "Gated admin map — credentials required." }
    ],

    // Edges are ordered pairs of node ids.  Only edges where both endpoints
    // exist after the safe-URL filter are drawn.
    edges: [
      ["mc", "finance"], ["mc", "matters"], ["mc", "leads"],
      ["mc", "system"],  ["mc", "agents"],
      ["mc", "leadflow"], ["mc", "jgms"], ["mc", "fla"], ["mc", "ntrural"],
      ["mc", "sb-public"], ["mc", "sb-private"],
      ["leads", "leadflow"],
      ["matters", "jgms"], ["matters", "fla"], ["matters", "ntrural"],
      ["system", "sb-private"], ["system", "sb-public"]
    ],

    // Simple category-grouped launcher rows shown under the map.  Grouped so
    // users can see at a glance which surfaces are safe to open from here.
    launchers: [
      {
        heading: "Operations dashboards",
        items: [
          { label: "Mission Control", url: "https://mission-control-rho-amber.vercel.app", note: "This dashboard.", self: true },
          { label: "LeadFlow",        url: "https://leads-tracker-eta.vercel.app",         note: "Prospective lead intake and triage." }
        ]
      },
      {
        heading: "Public brand sites",
        items: [
          { label: "JGMS",              url: "https://mobilesolicitor.vercel.app",         note: "Jacqui Griffin Mobile Solicitor." },
          { label: "Family Law Assist", url: "https://familylawassist.net.au",             note: "FLA landing site." },
          { label: "NT Rural & Remote", url: "https://ntruralremotelegalservices.com.au",  note: "NT rural and remote information site." }
        ]
      },
      {
        heading: "Second Brain",
        items: [
          { label: "Public map",  url: "https://rubric-second-brain.vercel.app",         note: "Redacted public workspace map." },
          { label: "Private map", url: "https://rubric-second-brain-private.vercel.app", note: "Gated admin map — credentials required." }
        ]
      }
    ],

    // Deliberately shown / hidden lists, matching the Second Brain safety
    // posture.  Keeps the boundary obvious to anyone reading over Jacqui's
    // shoulder.
    included: [
      "Names of the safe public sites and this dashboard's own sections.",
      "Ordered relationships between sections and safe sites.",
      "One-line descriptions of what each surface is for."
    ],
    excluded: [
      "Client names, matter identifiers, LEAP IDs and Legal Aid references.",
      "Emails, phone numbers, addresses, credentials and API keys.",
      "Local file paths, memory contents and raw finance records.",
      "Any writable admin endpoint — the map only links to gated or public sites."
    ]
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = DATA;
  }
  root.MC_SYSTEM_MAP = DATA;
})(typeof globalThis !== "undefined" ? globalThis : this);
