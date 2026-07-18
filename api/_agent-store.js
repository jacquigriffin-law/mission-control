const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

const VALID_STATUSES = new Set(["To Do", "In Progress", "Done"]);
const VALID_PRIORITIES = new Set(["Low", "Medium", "High"]);
const VALID_AGENT_STATES = new Set(["Working", "Idle"]);

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), "utf8"));
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.end(JSON.stringify(body));
}

function taskLanes(tasks) {
  const lanes = { "To Do": [], "In Progress": [], "Done": [] };
  tasks.forEach((task) => {
    if (lanes[task.status]) lanes[task.status].push(task);
  });
  return lanes;
}

function sortNewest(list) {
  return [...list].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

function findAgent(agents, id) {
  const key = String(id || "").toLowerCase();
  return agents.find((agent) => agent.id === key);
}

function serverlessWriteNotice(data, extra = {}) {
  return {
    ...data,
    serverless: true,
    persisted: false,
    note: "Vercel deployment is using committed seed JSON. For persistent writes, connect a database/KV store."
  };
}

module.exports = {
  VALID_AGENT_STATES,
  VALID_PRIORITIES,
  VALID_STATUSES,
  findAgent,
  readJson,
  sendJson,
  serverlessWriteNotice,
  sortNewest,
  taskLanes
};
