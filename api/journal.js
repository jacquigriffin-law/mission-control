const { readJson, sendJson } = require("./_agent-store.js");

function sortDaysChronological(days) {
  return [...days].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

module.exports = function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  }

  const store = readJson("journal");
  const days = Array.isArray(store.days) ? sortDaysChronological(store.days) : [];
  return sendJson(response, 200, {
    ok: true,
    data: {
      meta: store.meta || null,
      days
    }
  });
};
