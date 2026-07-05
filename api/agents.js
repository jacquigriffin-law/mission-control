const {
  VALID_AGENT_STATES,
  readJson,
  sendJson,
  serverlessWriteNotice
} = require("./_agent-store.js");

module.exports = function handler(request, response) {
  if (request.method === "GET") {
    return sendJson(response, 200, { ok: true, data: readJson("agents").agents });
  }

  if (request.method === "PATCH") {
    const body = request.body || {};
    if (body.status && !VALID_AGENT_STATES.has(body.status)) {
      return sendJson(response, 400, { ok: false, error: "invalid_status" });
    }
    return sendJson(response, 200, {
      ok: true,
      data: serverlessWriteNotice({
        id: body.id || null,
        status: body.status || null,
        lastActionAt: new Date().toISOString()
      })
    });
  }

  response.setHeader("Allow", "GET, PATCH");
  return sendJson(response, 405, { ok: false, error: "method_not_allowed" });
};
