// System link data. Structure only — no secrets, no client / matter data,
// no memory contents, no local file paths. Every external `url` must belong
// to a host listed in lib/safe-hosts.js SAFE_HOSTS or it will be dropped by
// the render code.
//
// Mission Control is a Practice Intelligence layer, so this data set now
// describes the internal sections and the safe external surfaces that
// support them; it is no longer used as a standalone map screen.
(function (root) {
  "use strict";

  var DATA = {
    lede: "How Mission Control fits together as a Practice Intelligence layer. Sections open here; safe external sites open in a new tab. Structure only — no client, matter or memory content.",

    // Hub nodes route to other sections in this dashboard.
    hubs: [
      { id: "mc",        label: "Mission Control", type: "hub", x: 50, y: 50, desc: "You are here. Practice Intelligence overview.", section: "dashboard" },
      { id: "finance",   label: "Finance",         type: "hub", x: 22, y: 22, desc: "Plutus finance feed — cash, GST/BAS pressure and hygiene.", section: "finance" },
      { id: "matters",   label: "Matters",         type: "hub", x: 78, y: 22, desc: "Matter type, funding and jurisdiction mix across JGMS, FLA and NT Rural.", section: "matters" },
      { id: "memory",    label: "Memory",          type: "hub", x: 78, y: 78, desc: "STATUS, daily logs, decisions and corrections — content stays private.", section: "memory" },
      { id: "journal",   label: "Journal",         type: "hub", x: 62, y: 88, desc: "Privacy-safe chronological summaries derived from daily workspace memory.", section: "journal" },
      { id: "documents", label: "Documents",       type: "hub", x: 40, y: 88, desc: "Generated reports, drafts, audits and briefings library.", section: "documents" }
    ],

    // Site nodes open a safe public URL in a new tab.
    sites: [
      { id: "leadflow",  label: "LeadFlow",              type: "site", x: 8,  y: 55, url: "https://leads-tracker-eta.vercel.app",           desc: "Prospective lead intake and triage (external)." },
      { id: "jgms",      label: "JGMS",                  type: "site", x: 92, y: 40, url: "https://mobilesolicitor.vercel.app",              desc: "Jacqui Griffin Mobile Solicitor public site." },
      { id: "fla",       label: "Family Law Assist",     type: "site", x: 92, y: 60, url: "https://familylawassist.net.au",                  desc: "FLA landing and information site." },
      { id: "ntrural",   label: "NT Rural & Remote",     type: "site", x: 50, y: 12, url: "https://ntruralremotelegalservices.com.au",       desc: "NT Rural and Remote Legal Services information site." },
      { id: "sb-public", label: "Second Brain (public)", type: "brain",x: 8,  y: 30, url: "https://rubric-second-brain.vercel.app",          desc: "Redacted public workspace map." },
      { id: "sb-private",label: "Second Brain (private)",type: "brain",x: 8,  y: 78, url: "https://rubric-second-brain-private.vercel.app",  desc: "Gated admin map — credentials required." }
    ],

    // Edges are ordered pairs of node ids.  Only edges where both endpoints
    // exist after the safe-URL filter are drawn.
    edges: [
      ["mc", "finance"], ["mc", "matters"],
      ["mc", "memory"],  ["mc", "journal"], ["mc", "documents"],
      ["mc", "leadflow"], ["mc", "jgms"], ["mc", "fla"], ["mc", "ntrural"],
      ["mc", "sb-public"], ["mc", "sb-private"],
      ["matters", "leadflow"],
      ["matters", "jgms"], ["matters", "fla"], ["matters", "ntrural"],
      ["memory", "journal"],
      ["memory", "sb-private"], ["memory", "sb-public"]
    ],

    // Simple category-grouped launcher rows.  Grouped so users can see at a
    // glance which surfaces are safe to open from here.
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

    // Deliberately shown / hidden lists — keeps the boundary obvious.
    included: [
      "Names of the safe public sites and this dashboard's own sections.",
      "Privacy-safe journal summaries derived from daily memory files.",
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
