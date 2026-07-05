const { readJson, sendJson, sortNewest } = require("./_agent-store.js");

module.exports = function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  }
  return sendJson(response, 200, {
    ok: true,
    data: sortNewest(readJson("activity").activity || [])
  });
};
