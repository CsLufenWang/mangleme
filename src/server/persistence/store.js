/**
 * 待办内存存储 + JSON 文件持久化
 * 1. 启动时从 data/todos.json 加载
 * 2. 增删改仅更新内存并标记 dirty
 * 3. 由外部定时器在 dirty 时写回文件
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../../data/todos.json');

let todos = [];
let dirty = false;

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    todos = Array.isArray(data.todos) ? data.todos : [];
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    todos = [];
  }
}

function save() {
  if (!dirty) return;
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    todos,
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  dirty = false;
}

/** @param {string} [date] - 可选，YYYY-MM-DD（或带时间），只返回该日期的待办；不传则返回全部 */
function getAll(date) {
  const list = todos.slice();
  if (!date || typeof date !== 'string') return list;
  const d = date.slice(0, 10);
  return list.filter((t) => t.date && t.date.slice(0, 10) === d);
}

function getById(id) {
  return todos.find((t) => t.id === id) || null;
}

function add(todo) {
  const now = new Date().toISOString();
  const dateRaw = normalizeDate(todo.date);
  const countdownTotalRaw = normalizeCountdownTotal(todo.countdown);
  const hasDate = dateRaw != null;
  const hasCountdown = countdownTotalRaw != null && countdownTotalRaw > 0;
  const date = hasCountdown ? null : dateRaw;
  const countdownTotal = hasDate ? null : countdownTotalRaw;
  const item = {
    id: todo.id || generateId(),
    title: todo.title || '',
    description: todo.description || '',
    important: clamp(todo.important, 1, 10),
    urgent: clamp(todo.urgent, 1, 10),
    status: todo.status || 'todo',
    parentId: todo.parentId || null,
    date,
    link: normalizeLink(todo.link),
    mindmap: normalizeMindmap(todo.mindmap),
    countdownTotalMinutes: countdownTotal,
    countdownStartedAt: countdownTotal != null && countdownTotal > 0 ? now : null,
    countdownValue: countdownTotal != null && countdownTotal > 0 && todo.countdown && todo.countdown.value > 0 ? todo.countdown.value : null,
    countdownUnit: countdownTotal != null && countdownTotal > 0 && todo.countdown ? String(todo.countdown.unit || 'minute').toLowerCase() : null,
    createdAt: now,
    updatedAt: now,
  };
  todos.push(item);
  dirty = true;
  return item;
}

function update(id, patch) {
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const current = todos[idx];
  const next = { ...current };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.description !== undefined) next.description = patch.description;
  if (patch.important !== undefined) next.important = clamp(patch.important, 1, 10);
  if (patch.urgent !== undefined) next.urgent = clamp(patch.urgent, 1, 10);
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.parentId !== undefined) next.parentId = patch.parentId;
  if (patch.date !== undefined) next.date = normalizeDate(patch.date);
  if (patch.link !== undefined) next.link = normalizeLink(patch.link);
  if (patch.mindmap !== undefined) next.mindmap = normalizeMindmap(patch.mindmap);
  if (patch.countdown !== undefined) {
    const total = normalizeCountdownTotal(patch.countdown);
    next.countdownTotalMinutes = total;
    next.countdownStartedAt = total > 0 ? new Date().toISOString() : null;
    next.countdownValue = patch.countdown && patch.countdown.value > 0 ? patch.countdown.value : null;
    next.countdownUnit = patch.countdown && patch.countdown.value > 0 ? String(patch.countdown.unit || 'minute').toLowerCase() : null;
  }
  if (next.date != null) {
    next.countdownTotalMinutes = null;
    next.countdownStartedAt = null;
    next.countdownValue = null;
    next.countdownUnit = null;
  } else if (next.countdownTotalMinutes != null && next.countdownTotalMinutes > 0) {
    next.date = null;
  }
  next.updatedAt = new Date().toISOString();
  todos[idx] = next;
  dirty = true;
  return next;
}

function remove(id) {
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  todos.splice(idx, 1);
  dirty = true;
  return true;
}

function isDirty() {
  return dirty;
}

function generateId() {
  return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

function clamp(n, min, max) {
  const v = Number(n);
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

/** 规范为 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm 或 YYYY-MM-DDTHH:mm:ss，否则 null */
function normalizeDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) {
    const datePart = s.slice(0, 10);
    if (s.length === 10) return datePart;
    if (s.startsWith(datePart + 'T') && s.length >= 16) {
      const timePart = s.slice(11, 19);
      if (/^\d{2}:\d{2}:\d{2}$/.test(timePart)) return datePart + 'T' + timePart;
      if (/^\d{2}:\d{2}$/.test(s.slice(11, 16))) return datePart + 'T' + s.slice(11, 16);
    }
    return datePart;
  }
  return null;
}

/** 规范链接，空则 null */
function normalizeLink(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/** 脑图：存为 JSON 字符串，无效或空则 null */
function normalizeMindmap(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch (e) { return null; }
  }
  const s = String(v).trim();
  if (s.length === 0) return null;
  try {
    JSON.parse(s);
    return s;
  } catch (e) {
    return null;
  }
}

/** countdown: { value: number, unit: 'minute'|'hour'|'day' } => 总分钟数，无效则 null */
function normalizeCountdownTotal(c) {
  if (!c || typeof c.value !== 'number' || c.value <= 0) return null;
  const u = String(c.unit || 'minute').toLowerCase();
  if (u === 'minute') return Math.round(c.value);
  if (u === 'hour') return Math.round(c.value * 60);
  if (u === 'day') return Math.round(c.value * 24 * 60);
  return Math.round(c.value);
}

// 启动时加载
load();

module.exports = {
  load,
  save,
  getAll,
  getById,
  add,
  update,
  remove,
  isDirty,
};
module.exports.DATA_FILE = DATA_FILE;
