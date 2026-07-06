// Safe-host allow list used by the System Map tab and any other client-side
// links inside Mission Control.  Kept in a plain script so a Node test suite
// can require() it directly without a DOM.  Do not add hosts that expose
// secrets, client/matter data, memory contents or writable endpoints.
(function (root) {
  "use strict";

  var SAFE_HOSTS = {
    "mission-control-rho-amber.vercel.app": {
      label: "Mission Control",
      role: "This dashboard."
    },
    "leads-tracker-eta.vercel.app": {
      label: "LeadFlow",
      role: "Prospective lead intake and triage."
    },
    "mobilesolicitor.vercel.app": {
      label: "JGMS",
      role: "Jacqui Griffin Mobile Solicitor public site."
    },
    "familylawassist.net.au": {
      label: "Family Law Assist",
      role: "FLA landing and information site."
    },
    "ntruralremotelegalservices.com.au": {
      label: "NT Rural & Remote",
      role: "NT Rural and Remote Legal Services information site."
    },
    "rubric-second-brain.vercel.app": {
      label: "Second Brain (public)",
      role: "Redacted public map of the workspace."
    },
    "rubric-second-brain-private.vercel.app": {
      label: "Second Brain (private)",
      role: "Gated admin map, credentials required."
    }
  };

  function safeUrl(url) {
    if (!url) return "";
    try {
      var u = new URL(url);
      if (u.protocol !== "https:") return "";
      return Object.prototype.hasOwnProperty.call(SAFE_HOSTS, u.hostname) ? u.href : "";
    } catch (e) {
      return "";
    }
  }

  function safeLabel(url) {
    if (!url) return "";
    try {
      var u = new URL(url);
      var entry = SAFE_HOSTS[u.hostname];
      return entry ? entry.label : "";
    } catch (e) {
      return "";
    }
  }

  var API = {
    SAFE_HOSTS: SAFE_HOSTS,
    safeUrl: safeUrl,
    safeLabel: safeLabel
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = API;
  }
  root.MC_SAFE_HOSTS = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
