const {
  VALID_PRIORITIES,
  VALID_STATUSES,
  findAgent,
  readJson,
  sendJson,
  serverlessWriteNotice
} = require("../_agent-store.js");

module.exports = function handler(request, response) {
  if (request.method !== "PATCH") {
    response.setHeader("Allow", "PATCH");
    return sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  }

  const { id } = request.query || {};
  const body = request.body || {};
  const tasks = readJson("tasks").tasks;
  const agents = readJson("agents").agents;
  const task = tasks.find((item) => item.id === id);
  if (!task) return sendJson(response, 404, { ok: false, error: "task_not_found" });
  if (body.status && !VALID_STATUSES.has(body.status)) {
    return sendJson(response, 400, { ok: false, error: "invalid_status" });
  }
  if (body.priority && !VALID_PRIORITIES.has(body.priority)) {
    return sendJson(response, 400, { ok: false, error: "invalid_priority" });
  }
  if (body.assigneeId && !findAgent(agents, body.assigneeId)) {
    return sendJson(response, 400, { ok: false, error: "invalid_assignee" });
  }

  return sendJson(response, 200, {
    ok: true,
    data: serverlessWriteNotice({
      ...task,
      ...body,
      assigneeId: body.assigneeId === "" ? null : body.assigneeId ?? task.assigneeId,
      updatedAt: new Date().toISOString()
    })
  });
};
