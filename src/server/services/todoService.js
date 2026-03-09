/**
 * 待办业务：CRUD + 列表排序（按紧急性 / 按重要性 / 按系数）
 * 含倒计时剩余计算与 effectiveUrgent（随倒计时自动提高紧急度）
 */
const store = require('../persistence/store');

const SORT_URGENT = 'urgent';
const SORT_IMPORTANT = 'important';
const SORT_SCORE = 'score';
const DEFAULT_SCORE_FACTOR = 0.33;

/** 计算倒计时剩余与有效紧急度，返回新对象（含 remainingPercent、remainingText、urgent 可能被覆盖） */
function applyCountdown(todo) {
  const t = { ...todo };
  const total = t.countdownTotalMinutes;
  const started = t.countdownStartedAt;
  if (!total || !started || total <= 0) return t;
  const startMs = new Date(started).getTime();
  const elapsedMs = Date.now() - startMs;
  const elapsedMinutes = elapsedMs / (60 * 1000);
  let remainingMinutes = total - elapsedMinutes;
  if (remainingMinutes <= 0) {
    t.remainingPercent = 0;
    t.remainingMinutes = 0;
    t.remainingText = '已到期';
    t.urgent = 10;
    return t;
  }
  const remainingPercent = (remainingMinutes / total) * 100;
  t.remainingPercent = remainingPercent;
  t.remainingMinutes = remainingMinutes;
  if (remainingMinutes < 60) t.remainingText = Math.ceil(remainingMinutes) + ' 分钟';
  else if (remainingMinutes < 24 * 60) t.remainingText = (remainingMinutes / 60).toFixed(1) + ' 小时';
  else t.remainingText = (remainingMinutes / (24 * 60)).toFixed(1) + ' 天';
  const baseUrgent = clamp(t.urgent, 1, 10);
  const delta = 10 - baseUrgent;
  const elapsedRatio = 1 - remainingPercent / 100;
  t.urgent = Math.min(10, Math.max(1, Math.round(baseUrgent + delta * elapsedRatio)));
  return t;
}

function clamp(n, min, max) {
  const v = Number(n);
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

/** @param {string} [date] - 可选 YYYY-MM-DD，不传则返回全部；仅返回未归档且未完成的待办 */
function getAll(date) {
  return store.getAll(date)
    .filter((t) => t.status !== 'archived' && t.status !== 'done')
    .map(applyCountdown);
}

function getById(id) {
  const item = store.getById(id);
  return item ? applyCountdown(item) : null;
}

function create(body) {
  const item = store.add(body);
  return applyCountdown(item);
}

function updateById(id, body) {
  const item = store.update(id, body);
  return item ? applyCountdown(item) : null;
}

function deleteById(id) {
  return store.remove(id);
}

/**
 * 返回排序后的列表，用于推荐处理顺序
 * @param {string} sortBy - 'urgent' | 'important' | 'score'
 * @param {number} scoreFactor - 系数，仅 sortBy=score 时使用，默认 0.33
 * @param {string} [date] - 可选 YYYY-MM-DD，只返回该日期的待办
 */
function getList(sortBy, scoreFactor = DEFAULT_SCORE_FACTOR, date) {
  const list = store.getAll(date)
    .filter((t) => !t.parentId && t.status !== 'archived' && t.status !== 'done')
    .map(applyCountdown);
  const factor = Number(scoreFactor);
  const safeFactor = Number.isNaN(factor) || factor < 0 || factor > 1 ? DEFAULT_SCORE_FACTOR : factor;

  if (sortBy === SORT_URGENT) {
    return list.slice().sort((a, b) => (b.urgent || 0) - (a.urgent || 0));
  }
  if (sortBy === SORT_IMPORTANT) {
    return list.slice().sort((a, b) => (b.important || 0) - (a.important || 0));
  }
  if (sortBy === SORT_SCORE) {
    return list.slice().sort((a, b) => score(b, safeFactor) - score(a, safeFactor));
  }
  return list.slice().sort((a, b) => score(b, safeFactor) - score(a, safeFactor));
}

function score(todo, factor) {
  const u = todo.urgent || 0;
  const i = todo.important || 0;
  return factor * u + (1 - factor) * i;
}

/** 返回需告警的待办：1）倒计时剩余不足 20% 或 剩余不足 1 小时；2）仅设置日期时间的，距离截止不足 1 小时 */
function getDeadlineWarnings() {
  const all = store.getAll();
  const result = [];

  // 1. 有倒计时的：剩余 >0 且（剩余 <20% 或 剩余 <1 小时）
  const withCountdown = all
    .filter((t) => !t.parentId && t.status !== 'archived' && t.status !== 'done' && t.countdownTotalMinutes && t.countdownStartedAt)
    .map(applyCountdown)
    .filter((t) => t.remainingPercent > 0 && (t.remainingPercent < 20 || (t.remainingMinutes != null && t.remainingMinutes < 60)));
  result.push(...withCountdown);

  // 2. 仅设置日期时间（无倒计时）、且距离截止不足 1 小时的
  const withDateOnly = all
    .filter((t) => !t.parentId && t.status !== 'archived' && t.status !== 'done' && t.date && !t.countdownTotalMinutes)
    .map(applyCountdown)
    .filter((t) => isDateWithinOneHour(t.date));
  withDateOnly.forEach((t) => {
    const deadlineMs = getDateDeadlineMs(t.date);
    if (deadlineMs != null) {
      const remainingMinutes = (deadlineMs - Date.now()) / (60 * 1000);
      t.remainingMinutes = remainingMinutes;
      t.remainingPercent = Math.min(100, (remainingMinutes / 60) * 100);
      t.remainingText = remainingMinutes < 60 ? Math.ceil(remainingMinutes) + ' 分钟' : (remainingMinutes / 60).toFixed(1) + ' 小时';
    }
  });
  result.push(...withDateOnly);

  return result;
}

/** 解析 date 字符串得到截止时间戳（毫秒）。仅日期无时间则视为当天 23:59:59；无效返回 null */
function getDateDeadlineMs(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const s = dateStr.trim();
  const datePart = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const [y, mo, d] = datePart.split('-').map(Number);
  if (s.length <= 10) {
    return new Date(y, mo - 1, d, 23, 59, 59, 999).getTime();
  }
  const t = s.indexOf('T');
  if (t === -1) return new Date(y, mo - 1, d, 23, 59, 59, 999).getTime();
  const timeStr = s.slice(t + 1);
  let deadlineMs;
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
    const [h, m, sec] = timeStr.split(':').map(Number);
    deadlineMs = new Date(y, mo - 1, d, h, m, sec, 0).getTime();
  } else if (/^\d{2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(':').map(Number);
    deadlineMs = new Date(y, mo - 1, d, h, m, 0, 0).getTime();
  } else return null;
  return deadlineMs;
}

/** 日期/日期时间是否已过期（与当前时间比较） */
function isDateExpired(dateStr) {
  const deadlineMs = getDateDeadlineMs(dateStr);
  return deadlineMs != null && Date.now() > deadlineMs;
}

/** 仅设置日期时间的待办：距离截止是否在 1 小时内（未过期且不足 1 小时） */
function isDateWithinOneHour(dateStr) {
  const deadlineMs = getDateDeadlineMs(dateStr);
  if (deadlineMs == null) return false;
  const now = Date.now();
  if (now >= deadlineMs) return false;
  const remainingMs = deadlineMs - now;
  return remainingMs <= 60 * 60 * 1000;
}

/** 返回已过期的待办：倒计时已到期 或 设置的日期/日期时间已过 */
function getExpiredTodos() {
  const all = store.getAll();
  return all
    .filter((t) => !t.parentId && t.status !== 'archived' && t.status !== 'done')
    .map(applyCountdown)
    .filter((t) => {
      if (t.countdownTotalMinutes && t.countdownStartedAt && (t.remainingPercent == null || t.remainingPercent <= 0)) return true;
      return isDateExpired(t.date);
    });
}

/** 返回指定日期的待办分区数量：坟墓区(已超时)、ICU区(告警)、活力区(健康)、完活区(已完成)。date 为 YYYY-MM-DD；不传或空则统计全部 */
function getDayStats(date) {
  const dateStr = date && String(date).trim().slice(0, 10);
  const list = dateStr
    ? store.getAll(dateStr).filter((t) => !t.parentId && t.status !== 'archived').map(applyCountdown)
    : store.getAll().filter((t) => !t.parentId && t.status !== 'archived').map(applyCountdown);
  const warningSet = new Set(getDeadlineWarnings().map((t) => t.id));
  let grave = 0;
  let icu = 0;
  let healthy = 0;
  let done = 0;
  list.forEach((t) => {
    if (t.status === 'done') {
      done++;
      return;
    }
    const countdownExpired = t.countdownTotalMinutes && (t.remainingPercent == null || t.remainingPercent <= 0);
    const dateExpired = isDateExpired(t.date);
    if (countdownExpired || dateExpired) grave++;
    else if (warningSet.has(t.id)) icu++;
    else healthy++;
  });
  return { grave, icu, healthy, done };
}

module.exports = {
  getAll,
  getById,
  create,
  updateById,
  deleteById,
  getList,
  getDeadlineWarnings,
  getExpiredTodos,
  getDayStats,
};
