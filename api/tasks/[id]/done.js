const {
  readJson,
  sendJson,
  serverlessWriteNotice
} = require("../../_agent-store.js");

module.exports = function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  }

  const { id } = request.query || {};
  const tasks = readJson("tasks").tasks;
  const task = tasks.find((item) => item.id === id);
  if (!task) return sendJson(response, 404, { ok: false, error: "task_not_found" });

  return sendJson(response, 200, {
    ok: true,
    data: serverlessWriteNotice({
      ...task,
      status: "Done",
      updatedAt: new Date().toISOString()
    })
  });
};
