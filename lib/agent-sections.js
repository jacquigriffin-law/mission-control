// Maps agent names and role labels to the internal dashboard section they should
// jump to when a mobile user taps their card.  Kept in a plain script so the Node
// test suite can require() it directly without a DOM.  Only returns values from
// VALID_SECTIONS so that a typo cannot become an unsafe or unknown hash target.
(function (root) {
  "use strict";

  var VALID_SECTIONS = new Set([
    "dashboard", "finance", "matters", "leads",
    "system", "system-map", "agents"
  ]);

  // Name is the strongest signal — hard-code the current roster so a role rename
  // never accidentally re-points a tap target.
  var BY_NAME = {
    "xena":      "system-map",
    "hermes":    "leads",
    "themis":    "matters",
    "plutus":    "finance",
    "ares":      "matters",
    "gabrielle": "agents",
    "marketing": "agents"
  };

  // Fallback by role for future agents where the name is unknown.
  var BY_ROLE = {
    "orchestrator":      "system-map",
    "intake / pa":       "leads",
    "intake":            "leads",
    "pa":                "leads",
    "court diary":       "matters",
    "finance":           "finance",
    "conflict checking": "matters",
    "support":           "agents",
    "marketing":         "agents"
  };

  function normalise(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function sectionForAgent(name, role) {
    var byName = BY_NAME[normalise(name)];
    if (byName && VALID_SECTIONS.has(byName)) return byName;
    var byRole = BY_ROLE[normalise(role)];
    if (byRole && VALID_SECTIONS.has(byRole)) return byRole;
    return "";
  }

  var API = {
    VALID_SECTIONS: VALID_SECTIONS,
    sectionForAgent: sectionForAgent
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = API;
  }
  root.MC_AGENT_SECTIONS = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
