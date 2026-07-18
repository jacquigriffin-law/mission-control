const {
  VALID_PRIORITIES,
  VALID_STATUSES,
  findAgent,
  readJson,
  sendJson,
  serverlessWriteNotice,
  taskLanes
} = require("./_agent-store.js");
const { buildLiveTaskStore } = require("./_live-tasks.js");

module.exports = async function handler(request, response) {
  if (request.method === "GET") {
    let store = readJson("tasks");
    try {
      store = await buildLiveTaskStore() || store;
    } catch (error) {
      store.meta = {
        ...(store.meta || {}),
        liveError: true,
        note: `${store.meta?.note || "Fallback task snapshot."} Live Microsoft To Do refresh failed; showing committed fallback.`
      };
    }
    const tasks = store.tasks || [];
    return sendJson(response, 200, { ok: true, data: { tasks, lanes: taskLanes(tasks), meta: store.meta || null } });
  }

  if (request.method === "POST") {
    const body = request.body || {};
    const agents = readJson("agents").agents;
    const title = String(body.title || "").trim().slice(0, 160);
    if (!title) return sendJson(response, 400, { ok: false, error: "title_required" });
    const status = VALID_STATUSES.has(body.status) ? body.status : "To Do";
    const priority = VALID_PRIORITIES.has(body.priority) ? body.priority : "Medium";
    const assigneeId = body.assigneeId && findAgent(agents, body.assigneeId)
      ? String(body.assigneeId).toLowerCase()
      : null;
    return sendJson(response, 201, {
      ok: true,
      data: serverlessWriteNotice({
        id: `T-${Date.now()}`,
        title,
        detail: String(body.detail || "").trim().slice(0, 480),
        status,
        priority,
        assigneeId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    });
  }

  response.setHeader("Allow", "GET, POST");
  return sendJson(response, 405, { ok: false, error: "method_not_allowed" });
};
