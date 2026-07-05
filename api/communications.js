const {
  readJson,
  sendJson,
  serverlessWriteNotice,
  sortNewest
} = require("./_agent-store.js");

module.exports = function handler(request, response) {
  if (request.method === "GET") {
    return sendJson(response, 200, {
      ok: true,
      data: sortNewest(readJson("communications").communications || [])
    });
  }

  if (request.method === "POST") {
    const body = request.body || {};
    const from = String(body.from || "").trim().slice(0, 80);
    const message = String(body.message || "").trim().slice(0, 800);
    if (!from) return sendJson(response, 400, { ok: false, error: "from_required" });
    if (!message) return sendJson(response, 400, { ok: false, error: "message_required" });
    return sendJson(response, 201, {
      ok: true,
      data: serverlessWriteNotice({
        id: `C-${Date.now()}`,
        at: new Date().toISOString(),
        from,
        channel: String(body.channel || "Broadcast").trim().slice(0, 40),
        message
      })
    });
  }

  response.setHeader("Allow", "GET, POST");
  return sendJson(response, 405, { ok: false, error: "method_not_allowed" });
};
