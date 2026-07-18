const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PORT = Number(process.env.PORT) || 3000;

const financeSummary = require("./api/finance-summary.js");
const legalWork = require("./api/legal-work.js");
const { buildLiveTaskStore } = require("./api/_live-tasks.js");

const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const VALID_STATUSES = new Set(["To Do", "In Progress", "Done"]);
const VALID_PRIORITIES = new Set(["Low", "Medium", "High"]);
const VALID_AGENT_STATES = new Set(["Working", "Idle"]);

function readJson(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(name, data) {
  const file = path.join(DATA_DIR, `${name}.json`);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0"
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > 128 * 1024) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function nextId(list, prefix) {
  const numbers = list
    .map((item) => Number(String(item.id || "").replace(prefix, "")))
    .filter((value) => Number.isFinite(value));
  const next = numbers.length ? Math.max(...numbers) + 1 : 1001;
  return `${prefix}${next}`;
}

function findAgent(agents, id) {
  const key = String(id || "").toLowerCase();
  return agents.find((agent) => agent.id === key);
}

function pushActivity(entry) {
  const store = readJson("activity");
  const list = Array.isArray(store.activity) ? store.activity : [];
  const record = {
    id: nextId(list, "A-"),
    at: nowIso(),
    ...entry
  };
  list.unshift(record);
  writeJson("activity", { activity: list.slice(0, 200) });
  return record;
}

function agentDisplayName(agents, id) {
  const agent = findAgent(agents, id);
  return agent ? agent.name : "Unassigned";
}

function updateAgentActivity(id, action) {
  if (!id) return;
  const store = readJson("agents");
  const agent = findAgent(store.agents, id);
  if (!agent) return;
  agent.lastActionAt = nowIso();
  agent.lastAction = action;
  writeJson("agents", store);
}

function handleAgents(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (req.method === "GET" && parts.length === 2) {
    return sendJson(res, 200, { ok: true, data: readJson("agents").agents });
  }
  if (req.method === "PATCH" && parts.length === 3) {
    const id = parts[2];
    return readBody(req)
      .then((body) => {
        const store = readJson("agents");
        const agent = findAgent(store.agents, id);
        if (!agent) return sendJson(res, 404, { ok: false, error: "agent_not_found" });
        if (body.status) {
          if (!VALID_AGENT_STATES.has(body.status)) {
            return sendJson(res, 400, { ok: false, error: "invalid_status" });
          }
          agent.status = body.status;
        }
        if (typeof body.workingOn === "string") agent.workingOn = body.workingOn.slice(0, 240);
        if (typeof body.lastAction === "string") agent.lastAction = body.lastAction.slice(0, 240);
        agent.lastActionAt = nowIso();
        writeJson("agents", store);
        pushActivity({
          agentId: agent.id,
          type: "status",
          message: `${agent.name} updated status to ${agent.status}.`
        });
        return sendJson(res, 200, { ok: true, data: agent });
      })
      .catch((error) => sendJson(res, 400, { ok: false, error: error.message }));
  }
  res.setHeader("Allow", "GET, PATCH");
  return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
}

function taskLanes(tasks) {
  const lanes = { "To Do": [], "In Progress": [], "Done": [] };
  tasks.forEach((task) => {
    if (lanes[task.status]) lanes[task.status].push(task);
  });
  return lanes;
}

async function handleTasks(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && parts.length === 2) {
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
    return sendJson(res, 200, {
      ok: true,
      data: { tasks, lanes: taskLanes(tasks), meta: store.meta || null }
    });
  }

  if (req.method === "POST" && parts.length === 2) {
    return readBody(req)
      .then((body) => {
        const store = readJson("tasks");
        const agents = readJson("agents").agents;
        const status = VALID_STATUSES.has(body.status) ? body.status : "To Do";
        const priority = VALID_PRIORITIES.has(body.priority) ? body.priority : "Medium";
        const assigneeId = body.assigneeId && findAgent(agents, body.assigneeId) ? String(body.assigneeId).toLowerCase() : null;
        const title = (body.title || "").toString().trim().slice(0, 160);
        if (!title) return sendJson(res, 400, { ok: false, error: "title_required" });
        const task = {
          id: nextId(store.tasks, "T-"),
          title,
          detail: (body.detail || "").toString().trim().slice(0, 480),
          status,
          priority,
          assigneeId,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        store.tasks.push(task);
        writeJson("tasks", store);
        pushActivity({
          agentId: assigneeId,
          type: "task_created",
          message: `New task "${task.title}" added to ${task.status} (${task.priority}), assigned to ${agentDisplayName(agents, assigneeId)}.`
        });
        return sendJson(res, 201, { ok: true, data: task });
      })
      .catch((error) => sendJson(res, 400, { ok: false, error: error.message }));
  }

  if ((req.method === "PATCH" || req.method === "POST") && parts.length >= 3) {
    const id = parts[2];
    const action = parts[3];
    return readBody(req)
      .then((body) => {
        const store = readJson("tasks");
        const agents = readJson("agents").agents;
        const task = store.tasks.find((item) => item.id === id);
        if (!task) return sendJson(res, 404, { ok: false, error: "task_not_found" });

        if (action === "done") {
          const actorId = body.agentId ? String(body.agentId).toLowerCase() : task.assigneeId;
          const actor = findAgent(agents, actorId);
          task.status = "Done";
          task.updatedAt = nowIso();
          writeJson("tasks", store);
          if (actor) updateAgentActivity(actor.id, `Marked "${task.title}" as Done.`);
          pushActivity({
            agentId: actor ? actor.id : task.assigneeId,
            type: "task_done",
            message: `${actor ? actor.name : "An agent"} marked "${task.title}" as Done.`
          });
          return sendJson(res, 200, { ok: true, data: task });
        }

        if (req.method !== "PATCH") {
          res.setHeader("Allow", "PATCH");
          return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
        }

        const changes = [];
        if (body.status) {
          if (!VALID_STATUSES.has(body.status)) return sendJson(res, 400, { ok: false, error: "invalid_status" });
          if (body.status !== task.status) {
            changes.push(`status → ${body.status}`);
            task.status = body.status;
          }
        }
        if (body.priority) {
          if (!VALID_PRIORITIES.has(body.priority)) return sendJson(res, 400, { ok: false, error: "invalid_priority" });
          if (body.priority !== task.priority) {
            changes.push(`priority → ${body.priority}`);
            task.priority = body.priority;
          }
        }
        if (body.assigneeId !== undefined) {
          const next = body.assigneeId === null || body.assigneeId === "" ? null : String(body.assigneeId).toLowerCase();
          if (next && !findAgent(agents, next)) return sendJson(res, 400, { ok: false, error: "invalid_assignee" });
          if (next !== task.assigneeId) {
            changes.push(`assignee → ${agentDisplayName(agents, next)}`);
            task.assigneeId = next;
          }
        }
        if (typeof body.title === "string") task.title = body.title.trim().slice(0, 160);
        if (typeof body.detail === "string") task.detail = body.detail.trim().slice(0, 480);
        task.updatedAt = nowIso();
        writeJson("tasks", store);
        if (changes.length) {
          pushActivity({
            agentId: task.assigneeId,
            type: "task_update",
            message: `"${task.title}" updated: ${changes.join(", ")}.`
          });
        }
        return sendJson(res, 200, { ok: true, data: task });
      })
      .catch((error) => sendJson(res, 400, { ok: false, error: error.message }));
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
}

function handleActivity(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  }
  const store = readJson("activity");
  const list = Array.isArray(store.activity) ? store.activity : [];
  const sorted = [...list].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  return sendJson(res, 200, { ok: true, data: sorted });
}

function handleComms(req, res) {
  if (req.method === "GET") {
    const store = readJson("communications");
    const list = Array.isArray(store.communications) ? store.communications : [];
    const sorted = [...list].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    return sendJson(res, 200, { ok: true, data: sorted });
  }
  if (req.method === "POST") {
    return readBody(req)
      .then((body) => {
        const from = (body.from || "").toString().trim().slice(0, 80);
        const channel = (body.channel || "Broadcast").toString().trim().slice(0, 40);
        const message = (body.message || "").toString().trim().slice(0, 800);
        if (!from) return sendJson(res, 400, { ok: false, error: "from_required" });
        if (!message) return sendJson(res, 400, { ok: false, error: "message_required" });
        const store = readJson("communications");
        const list = Array.isArray(store.communications) ? store.communications : [];
        const record = {
          id: nextId(list, "C-"),
          at: nowIso(),
          from,
          channel,
          message
        };
        list.unshift(record);
        writeJson("communications", { communications: list.slice(0, 300) });
        return sendJson(res, 201, { ok: true, data: record });
      })
      .catch((error) => sendJson(res, 400, { ok: false, error: error.message }));
  }
  res.setHeader("Allow", "GET, POST");
  return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
}

function handleJournal(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  }
  const store = readJson("journal");
  const days = Array.isArray(store.days) ? [...store.days] : [];
  days.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  return sendJson(res, 200, {
    ok: true,
    data: {
      meta: store.meta || null,
      days
    }
  });
}

function safeStaticPath(pathname) {
  const relative = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.normalize(path.join(ROOT, relative));
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

function serveStatic(req, res, pathname) {
  const filePath = safeStaticPath(pathname);
  if (!filePath) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = STATIC_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=60"
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname } = url;

  try {
    if (pathname === "/api/finance-summary") return financeSummary(req, res);
    if (pathname === "/api/legal-work") return legalWork(req, res);
    if (pathname.startsWith("/api/agents")) return handleAgents(req, res, url);
    if (pathname.startsWith("/api/tasks")) return handleTasks(req, res, url).catch((error) => sendJson(res, 500, { ok: false, error: "server_error", message: error.message }));
    if (pathname === "/api/activity") return handleActivity(req, res);
    if (pathname === "/api/communications") return handleComms(req, res);
    if (pathname === "/api/journal") return handleJournal(req, res);
    if (pathname.startsWith("/api/")) return sendJson(res, 404, { ok: false, error: "unknown_endpoint" });
    return serveStatic(req, res, pathname);
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: "server_error", message: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Mission Control server listening on http://localhost:${PORT}`);
});
