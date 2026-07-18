const crypto = require("crypto");

const GRAPH_URL = "https://graph.microsoft.com/v1.0";
const MAX_OPEN_TASKS = 32;
const MAX_DONE_TASKS = 8;

function hasGraphConfig() {
  return Boolean(
    process.env.AZURE_CLIENT_ID
    && process.env.AZURE_TENANT_ID
    && process.env.AZURE_CLIENT_SECRET
  );
}

async function graphToken() {
  const body = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default"
  });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(process.env.AZURE_TENANT_ID)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error(`graph_token_${response.status}`);
  const data = await response.json();
  if (!data.access_token) throw new Error("graph_token_missing");
  return data.access_token;
}

async function graphGet(pathOrUrl, token) {
  const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `${GRAPH_URL}${pathOrUrl}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`graph_get_${response.status}`);
  return response.json();
}

async function graphGetAll(path, token) {
  const out = [];
  let next = path;
  while (next) {
    const data = await graphGet(next, token);
    out.push(...(Array.isArray(data.value) ? data.value : []));
    next = data["@odata.nextLink"] || "";
  }
  return out;
}

function hashId(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function dateOnly(value) {
  const text = typeof value === "string" ? value : value?.dateTime;
  if (!text) return "";
  const match = String(text).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function displayDate(value) {
  const date = dateOnly(value);
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function daysUntil(date) {
  if (!date) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [year, month, day] = date.split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - todayUtc) / 86400000);
}

function listAgent(listName) {
  const name = String(listName || "").toLowerCase();
  if (/marketing/.test(name)) return "marketing";
  if (/finance|business/.test(name)) return "plutus";
  if (/lead|intake/.test(name)) return "hermes";
  if (/matter|leap|task/.test(name)) return "themis";
  if (/agent|system|review/.test(name)) return "xena";
  return "xena";
}

function listLabel(listName) {
  const name = String(listName || "").toLowerCase();
  if (/marketing/.test(name)) return "Marketing";
  if (/finance|business/.test(name)) return "Business and finance";
  if (/lead|intake/.test(name)) return "Lead and intake";
  if (/matter/.test(name)) return "Matter";
  if (/leap/.test(name)) return "LEAP";
  if (/tasks/.test(name)) return "Operations";
  if (/agent|system|review/.test(name)) return "Agent/system";
  return "Operations";
}

function titleLooksPrivate(title, listName) {
  return (
    /matter|lead|intake|leap|tasks/i.test(String(listName || ""))
    || /\b\d{2}\/\d{4}\b/.test(title)
    || /\b[A-Z]{2,}\b.*\b[A-Z]{2,}\b/.test(title)
    || /legal aid approval|offer of work|referral|legal inquiry|client email|court documents/i.test(title)
    || /[-—]\s*[A-Z][A-Za-z'’.-]+/.test(title)
  );
}

function scrubPublicTitle(title) {
  return String(title || "")
    .replace(/\b\d{2}\/\d{4}\b/g, "matter")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "email")
    .replace(/\b(?:\+?61|0)4\d{2}\s?\d{3}\s?\d{3}\b/g, "phone")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function safeTitle(task, listName) {
  const raw = String(task.title || "Untitled task").trim();
  if (!titleLooksPrivate(raw, listName)) return scrubPublicTitle(raw);
  const due = displayDate(task.dueDateTime);
  const prefix = listLabel(listName);
  return due ? `${prefix} task due ${due}` : `${prefix} task`;
}

function priorityFor(task) {
  const due = dateOnly(task.dueDateTime);
  const delta = daysUntil(due);
  const title = String(task.title || "");
  if (task.importance === "high" || /urgent|start here|today/i.test(title) || (delta !== null && delta <= 0)) return "High";
  if (delta !== null && delta <= 7) return "Medium";
  return "Low";
}

function statusFor(task) {
  if (task.status === "completed") return "Done";
  if (/start here|today/i.test(String(task.title || ""))) return "In Progress";
  return "To Do";
}

function taskSortKey(task) {
  const statusOrder = { "In Progress": 0, "To Do": 1, Done: 2 };
  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  return [
    statusOrder[task.status] ?? 9,
    priorityOrder[task.priority] ?? 9,
    task.dueSort || "9999-99-99",
    task.title || ""
  ].join("|");
}

function publicTask(task, list) {
  const due = dateOnly(task.dueDateTime);
  const status = statusFor(task);
  const priority = priorityFor(task);
  const source = listLabel(list.displayName);
  const dueText = due ? ` Due ${displayDate(due)}.` : "";
  return {
    id: `todo-${hashId(`${list.id}:${task.id}`)}`,
    title: safeTitle(task, list.displayName),
    detail: `${source} task from live Microsoft To Do.${dueText}`.trim(),
    status,
    priority,
    assigneeId: listAgent(list.displayName),
    createdAt: task.createdDateTime || task.lastModifiedDateTime || new Date().toISOString(),
    updatedAt: task.lastModifiedDateTime || task.createdDateTime || new Date().toISOString(),
    dueSort: due || ""
  };
}

function limitTasks(tasks) {
  const sorted = tasks.slice().sort((a, b) => taskSortKey(a).localeCompare(taskSortKey(b)));
  const open = sorted.filter((task) => task.status !== "Done").slice(0, MAX_OPEN_TASKS);
  const done = sorted.filter((task) => task.status === "Done").slice(0, MAX_DONE_TASKS);
  return open.concat(done).map(({ dueSort, ...task }) => task);
}

async function buildLiveTaskStore() {
  if (!hasGraphConfig()) return null;
  const token = await graphToken();
  const user = encodeURIComponent(process.env.MS365_PRIMARY_USER || "jacquigriffin@mobilesolicitor.com.au");
  const lists = await graphGetAll(`/users/${user}/todo/lists?$top=100`, token);
  const rows = [];
  for (const list of lists) {
    const listName = String(list.displayName || "");
    if (!/agent|system|review|business|finance|marketing|lead|intake/i.test(listName)) continue;
    const tasks = await graphGetAll(`/users/${user}/todo/lists/${encodeURIComponent(list.id)}/tasks?$top=100`, token);
    tasks.forEach((task) => rows.push(publicTask(task, list)));
  }
  const tasks = limitTasks(rows);
  if (!tasks.length) return null;
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      source: "Live Microsoft To Do privacy-safe operations feed",
      note: "Live To Do tasks are transformed before display; client names, matter numbers and raw record details are not exposed.",
      live: true
    },
    tasks
  };
}

module.exports = {
  buildLiveTaskStore,
  hasGraphConfig,
  publicTask
};
