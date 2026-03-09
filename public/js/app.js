(function () {
  const API = '/api/todos';
  const listEl = document.getElementById('recommendList');
  const canvasBoard = document.getElementById('canvasBoard');
  const canvasNotes = document.getElementById('canvasNotes');
  const sortSelect = document.getElementById('sortBy');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const todoForm = document.getElementById('todoForm');
  const todoId = document.getElementById('todoId');
  const todoTitle = document.getElementById('todoTitle');
  const todoDesc = document.getElementById('todoDesc');
  const todoImportant = document.getElementById('todoImportant');
  const todoUrgent = document.getElementById('todoUrgent');
  const btnNew = document.getElementById('btnNew');
  const btnCancel = document.getElementById('btnCancel');
  const btnDelete = document.getElementById('btnDelete');
  const calendarTitle = document.getElementById('calendarTitle');
  const calendarDays = document.getElementById('calendarDays');
  const calendarPrev = document.getElementById('calendarPrev');
  const calendarNext = document.getElementById('calendarNext');
  const calendarShowAll = document.getElementById('calendarShowAll');
  const calendarToday = document.getElementById('calendarToday');
  const todoDate = document.getElementById('todoDate');
  const todoTime = document.getElementById('todoTime');
  const todoLink = document.getElementById('todoLink');
  const todoCountdownValue = document.getElementById('todoCountdownValue');
  const todoCountdownUnit = document.getElementById('todoCountdownUnit');
  const expiredBox = document.getElementById('expiredBox');
  const expiredList = document.getElementById('expiredList');
  const deadlineWarningsList = document.getElementById('deadlineWarningsList');
  const deadlineWarningsBox = document.getElementById('deadlineWarnings');
  const todayStatsGrave = document.getElementById('todayStatsGrave');
  const todayStatsIcu = document.getElementById('todayStatsIcu');
  const todayStatsHealthy = document.getElementById('todayStatsHealthy');
  const todayStatsDone = document.getElementById('todayStatsDone');
  const todayStatsBox = document.getElementById('todayStatsBox');
  const dayStatsTitle = document.getElementById('dayStatsTitle');
  const dayStatsHeader = document.getElementById('dayStatsHeader');
  const dayStatsBody = document.getElementById('dayStatsBody');
  const dayStatsChevron = document.getElementById('dayStatsChevron');
  const calendarPanel = document.getElementById('calendarPanel');

  const DAY_STATS_COLLAPSED_KEY = 'dayStatsCollapsed';

  const NOTE_COLORS = ['note-yellow', 'note-pink', 'note-blue', 'note-green', 'note-orange'];

  let selectedDate = null;
  let calendarYear = new Date().getFullYear();
  let calendarMonth = new Date().getMonth();

  function getListParams() {
    const sortBy = sortSelect.value || 'score';
    return { sortBy, scoreFactor: 0.33 };
  }

  function getDateQuery() {
    return selectedDate ? '&date=' + encodeURIComponent(selectedDate) : '';
  }

  function fetchList() {
    const { sortBy, scoreFactor } = getListParams();
    fetch(API + '/list?sortBy=' + encodeURIComponent(sortBy) + '&scoreFactor=' + scoreFactor + getDateQuery())
      .then((r) => r.json())
      .then(renderList)
      .catch(console.error);
  }

  function markDone(id, e) {
    if (e) e.stopPropagation();
    fetch(API + '/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    }).then(() => refreshAll()).catch(console.error);
  }

  function markDelete(id, e) {
    if (e) e.stopPropagation();
    if (!confirm('确定删除该待办？')) return;
    fetch(API + '/' + id, { method: 'DELETE' }).then(() => refreshAll()).catch(console.error);
  }

  /** 当前时间 + 3 小时的 ISO 本地日期时间字符串，用于「再缓缓」 */
  function getDateTimeIn3Hours() {
    const d = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return y + '-' + m + '-' + day + 'T' + h + ':' + min + ':' + sec;
  }

  function markSnooze(id, e) {
    if (e) e.stopPropagation();
    const newDate = getDateTimeIn3Hours();
    fetch(API + '/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, countdown: null }),
    }).then(() => refreshAll()).catch(console.error);
  }

  function renderList(items) {
    listEl.innerHTML = '';
    items.forEach((t) => {
      const li = document.createElement('li');
      li.dataset.id = t.id;
      let meta = 'E' + t.urgent + ' I' + t.important;
      if (t.remainingText) meta += ' · ' + t.remainingText;
      li.innerHTML =
        '<span class="list-item-main">' + escapeHtml(t.title || '') + '</span>' +
        '<span class="list-item-right">' +
        '<span class="list-item-meta">' + escapeHtml(meta) + '</span>' +
        '<span class="list-item-actions">' +
        '<button type="button" class="btn-action btn-done">搞定了</button>' +
        '<button type="button" class="btn-action btn-delete">不干了</button>' +
        '<button type="button" class="btn-action btn-snooze">再缓缓</button></span>' +
        '</span>';
      li.querySelector('.list-item-main').addEventListener('click', () => openEdit(t.id));
      li.querySelector('.btn-done').addEventListener('click', (e) => markDone(t.id, e));
      li.querySelector('.btn-delete').addEventListener('click', (e) => markDelete(t.id, e));
      li.querySelector('.btn-snooze').addEventListener('click', (e) => markSnooze(t.id, e));
      listEl.appendChild(li);
    });
  }

  // 画布：坐标 → 百分比。横纵轴视觉范围 1～11，避免 10 贴边只显示一半
  function coordsToPercent(urgent, important) {
    const left = ((urgent - 1) / 10) * 100;
    const top = ((11 - important) / 10) * 100;
    return { left, top };
  }

  function percentToCoords(leftPercent, topPercent) {
    const urgent = Math.round((leftPercent / 100) * 10 + 1);
    const important = 11 - Math.round((topPercent / 100) * 10);
    return {
      urgent: Math.max(1, Math.min(10, urgent)),
      important: Math.max(1, Math.min(10, important)),
    };
  }

  const ROTATIONS = ['-0.8deg', '0.6deg', '-1.2deg', '0.5deg', '1deg'];
  let spreadTimeoutId = null;
  let currentSpreadCell = null;

  function renderCanvas(todos) {
    const topLevel = todos.filter((t) => !t.parentId);
    canvasNotes.innerHTML = '';
    topLevel.forEach((t, i) => {
      const urgent = Math.max(1, Math.min(10, t.urgent || 1));
      const important = Math.max(1, Math.min(10, t.important || 1));
      const { left, top } = coordsToPercent(urgent, important);
      const cell = urgent + '-' + important;
      const note = document.createElement('div');
      note.className = 'sticky-note ' + (NOTE_COLORS[i % NOTE_COLORS.length]);
      note.dataset.id = t.id;
      note.dataset.cell = cell;
      note.style.left = left + '%';
      note.style.top = top + '%';
      note.style.setProperty('--rotate', ROTATIONS[i % ROTATIONS.length]);
      const desc = (t.description || '').trim() || '无';
      let meta = 'E' + urgent + ' I' + important;
      if (t.remainingText) meta += ' · ' + t.remainingText;
      const linkPart = t.link ? '<a href="' + escapeHtml(t.link) + '" target="_blank" rel="noopener" class="note-link" onclick="event.stopPropagation()">🔗</a>' : '';
      note.innerHTML =
        '<div class="note-title-row">' +
        '<div class="note-title">' + escapeHtml((t.title || '未命名').slice(0, 14)) + '</div>' + linkPart +
        '</div><div class="note-meta">' + escapeHtml(meta) + '</div><div class="note-desc">' +
        escapeHtml(desc.slice(0, 50)) + (desc.length > 50 ? '…' : '') + '</div>' +
        '<span class="note-actions">' +
        '<button type="button" class="note-btn-done">搞定了</button>' +
        '<button type="button" class="note-btn-delete">不干了</button>' +
        '<button type="button" class="note-btn-snooze">再缓缓</button></span>';
      note._wasDragged = false;
      note.addEventListener('click', () => {
        if (note._wasDragged) {
          note._wasDragged = false;
          return;
        }
        openEdit(t.id);
      });
      note.querySelector('.note-btn-done').addEventListener('click', (e) => { e.stopPropagation(); markDone(t.id, e); });
      note.querySelector('.note-btn-delete').addEventListener('click', (e) => { e.stopPropagation(); markDelete(t.id, e); });
      note.querySelector('.note-btn-snooze').addEventListener('click', (e) => { e.stopPropagation(); markSnooze(t.id, e); });
      note.addEventListener('mouseenter', () => onNoteMouseEnter(note, cell));
      note.addEventListener('mouseleave', () => onNoteMouseLeave(cell));
      initNoteDrag(note);
      canvasNotes.appendChild(note);
    });
  }

  function removeSpreadBridge() {
    const bridge = canvasNotes.querySelector('.spread-bridge');
    if (bridge) bridge.remove();
  }

  function onNoteMouseEnter(note, cell) {
    if (spreadTimeoutId) {
      clearTimeout(spreadTimeoutId);
      spreadTimeoutId = null;
    }
    const siblings = canvasNotes.querySelectorAll('.sticky-note[data-cell="' + cell + '"]');
    if (siblings.length <= 1) {
      clearSpread(currentSpreadCell);
      removeSpreadBridge();
      currentSpreadCell = null;
      note.classList.add('hover-zoom');
      return;
    }
    if (currentSpreadCell !== cell) {
      clearSpread(currentSpreadCell);
      removeSpreadBridge();
      currentSpreadCell = cell;
    }
    const list = Array.from(siblings);
    const hoverIndex = list.indexOf(note);
    const stepX = 80;
    const stepY = 25;
    list.forEach((n, idx) => {
      const dx = (idx - hoverIndex) * stepX;
      const dy = (idx - hoverIndex) * stepY;
      const scale = idx === hoverIndex ? 1.2 : 1;
      n.style.setProperty('--spread-dx', dx + 'px');
      n.style.setProperty('--spread-dy', dy + 'px');
      n.style.setProperty('--spread-scale', scale);
      n.classList.toggle('spread-hover', idx === hoverIndex);
    });
    requestAnimationFrame(() => {
      const canvasRect = canvasNotes.getBoundingClientRect();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      list.forEach((n) => {
        const r = n.getBoundingClientRect();
        minX = Math.min(minX, r.left - canvasRect.left);
        minY = Math.min(minY, r.top - canvasRect.top);
        maxX = Math.max(maxX, r.right - canvasRect.left);
        maxY = Math.max(maxY, r.bottom - canvasRect.top);
      });
      const pad = 28;
      removeSpreadBridge();
      const bridge = document.createElement('div');
      bridge.className = 'spread-bridge';
      bridge.dataset.cell = cell;
      bridge.style.left = (minX - pad) + 'px';
      bridge.style.top = (minY - pad) + 'px';
      bridge.style.width = (maxX - minX + pad * 2) + 'px';
      bridge.style.height = (maxY - minY + pad * 2) + 'px';
      bridge.addEventListener('mouseenter', () => {
        if (spreadTimeoutId) {
          clearTimeout(spreadTimeoutId);
          spreadTimeoutId = null;
        }
      });
      bridge.addEventListener('mouseleave', () => {
        spreadTimeoutId = setTimeout(() => {
          clearSpread(cell);
          removeSpreadBridge();
          currentSpreadCell = null;
          spreadTimeoutId = null;
        }, 320);
      });
      canvasNotes.insertBefore(bridge, canvasNotes.firstChild);
    });
  }

  function onNoteMouseLeave(cell) {
    canvasNotes.querySelectorAll('.sticky-note[data-cell="' + cell + '"]').forEach((n) => n.classList.remove('hover-zoom'));
    spreadTimeoutId = setTimeout(() => {
      clearSpread(cell);
      removeSpreadBridge();
      currentSpreadCell = null;
      spreadTimeoutId = null;
    }, 420);
  }

  function clearSpread(cell) {
    if (!cell) return;
    removeSpreadBridge();
    const siblings = canvasNotes.querySelectorAll('.sticky-note[data-cell="' + cell + '"]');
    siblings.forEach((n) => {
      n.style.removeProperty('--spread-dx');
      n.style.removeProperty('--spread-dy');
      n.style.removeProperty('--spread-scale');
      n.classList.remove('spread-hover');
    });
  }

  function initNoteDrag(note) {
    let startX, startY, startLeft, startTop, moved;

    function getNotesRect() {
      return canvasNotes.getBoundingClientRect();
    }

    function pxToPercent(pxLeft, pxTop) {
      const r = getNotesRect();
      const leftPercent = (pxLeft / r.width) * 100;
      const topPercent = (pxTop / r.height) * 100;
      return {
        left: Math.max(0, Math.min(100, leftPercent)),
        top: Math.max(0, Math.min(100, topPercent)),
      };
    }

    note.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.note-actions')) return;
      e.preventDefault();
      const r = getNotesRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(note.style.left) || 0;
      startTop = parseFloat(note.style.top) || 0;
      moved = false;
      note.classList.add('dragging');
      const onMove = (e2) => {
        moved = true;
        const dx = e2.clientX - startX;
        const dy = e2.clientY - startY;
        const leftPercent = startLeft + (dx / r.width) * 100;
        const topPercent = startTop + (dy / r.height) * 100;
        note.style.left = Math.max(0, Math.min(100, leftPercent)) + '%';
        note.style.top = Math.max(0, Math.min(100, topPercent)) + '%';
      };
      const onUp = (e2) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        note.classList.remove('dragging');
        if (moved) {
          note._wasDragged = true;
          const leftPercent = parseFloat(note.style.left);
          const topPercent = parseFloat(note.style.top);
          const { urgent, important } = percentToCoords(leftPercent, topPercent);
          const id = note.dataset.id;
          if (id)
            fetch(API + '/' + id, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urgent, important }),
            })
              .then(() => { refreshAll(); })
              .catch(console.error);
        }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function fetchAllAndFillCanvas() {
    fetch(API + (selectedDate ? '?date=' + encodeURIComponent(selectedDate) : ''))
      .then((r) => r.json())
      .then(renderCanvas)
      .catch(console.error);
  }

  function toYYYYMMDD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function renderCalendar() {
    calendarTitle.textContent = calendarYear + '年' + (calendarMonth + 1) + '月';
    const first = new Date(calendarYear, calendarMonth, 1);
    const last = new Date(calendarYear, calendarMonth + 1, 0);
    const startPad = first.getDay();
    const daysInMonth = last.getDate();
    const todayStr = toYYYYMMDD(new Date());
    calendarDays.innerHTML = '';
    for (let i = 0; i < startPad; i++) {
      const prevMonth = new Date(calendarYear, calendarMonth, 1 - (startPad - i));
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'calendar-day other-month';
      cell.textContent = prevMonth.getDate();
      cell.dataset.date = toYYYYMMDD(prevMonth);
      cell.addEventListener('click', () => selectDate(cell.dataset.date));
      calendarDays.appendChild(cell);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = calendarYear + '-' + String(calendarMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'calendar-day';
      cell.textContent = d;
      cell.dataset.date = dateStr;
      if (dateStr === todayStr) cell.classList.add('today');
      if (dateStr === selectedDate) cell.classList.add('selected');
      cell.addEventListener('click', () => selectDate(dateStr));
      calendarDays.appendChild(cell);
    }
    let rest = (7 - ((startPad + daysInMonth) % 7)) % 7;
    if (rest > 0) {
      for (let i = 1; i <= rest; i++) {
        const nextMonth = new Date(calendarYear, calendarMonth + 1, i);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'calendar-day other-month';
        cell.textContent = i;
        cell.dataset.date = toYYYYMMDD(nextMonth);
        cell.addEventListener('click', () => selectDate(cell.dataset.date));
        calendarDays.appendChild(cell);
      }
    }
  }

  function selectDate(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    refreshAll();
  }

  calendarPrev.addEventListener('click', () => {
    if (calendarMonth === 0) { calendarYear--; calendarMonth = 11; } else calendarMonth--;
    renderCalendar();
  });
  calendarNext.addEventListener('click', () => {
    if (calendarMonth === 11) { calendarYear++; calendarMonth = 0; } else calendarMonth++;
    renderCalendar();
  });
  calendarShowAll.addEventListener('click', () => {
    selectedDate = null;
    renderCalendar();
    refreshAll();
  });
  calendarToday.addEventListener('click', () => {
    const now = new Date();
    selectedDate = toYYYYMMDD(now);
    calendarYear = now.getFullYear();
    calendarMonth = now.getMonth();
    renderCalendar();
    refreshAll();
  });

  function openNew() {
    todoId.value = '';
    modalTitle.textContent = '新建待办';
    todoTitle.value = '';
    todoDesc.value = '';
    todoImportant.value = 5;
    todoUrgent.value = 5;
    todoDate.value = selectedDate || toYYYYMMDD(new Date());
    todoTime.value = '';
    todoLink.value = '';
    todoCountdownValue.value = '';
    todoCountdownUnit.value = 'minute';
    btnDelete.classList.add('hidden');
    modalOverlay.classList.remove('hidden');
  }

  function openEdit(id) {
    fetch(API + '/' + id)
      .then((r) => r.json())
      .then((t) => {
        todoId.value = t.id;
        modalTitle.textContent = '编辑待办';
        todoTitle.value = t.title || '';
        todoDesc.value = t.description || '';
        todoImportant.value = t.important ?? 5;
        todoUrgent.value = t.urgent ?? 5;
        if (t.date) {
          const idx = t.date.indexOf('T');
          todoDate.value = idx >= 0 ? t.date.slice(0, 10) : t.date.slice(0, 10);
          todoTime.value = idx >= 0 ? t.date.slice(idx + 1).slice(0, 8) : '';
        } else {
          todoDate.value = '';
          todoTime.value = '';
        }
        todoLink.value = t.link || '';
        todoCountdownValue.value = t.countdownValue != null ? t.countdownValue : '';
        todoCountdownUnit.value = t.countdownUnit || 'minute';
        btnDelete.classList.remove('hidden');
        modalOverlay.classList.remove('hidden');
      })
      .catch(console.error);
  }

  function closeModal() {
    modalOverlay.classList.add('hidden');
  }

  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = todoId.value.trim();
    const cv = parseInt(todoCountdownValue.value, 10);
    const countdown = cv > 0 ? { value: cv, unit: todoCountdownUnit.value } : null;
    const datePart = todoDate.value.trim();
    const timePart = (todoTime && todoTime.value) ? todoTime.value.trim() : '';
    const date = datePart ? (timePart ? datePart + 'T' + (timePart.length === 5 ? timePart + ':00' : timePart) : datePart) : null;
    const body = {
      title: todoTitle.value.trim(),
      description: todoDesc.value.trim(),
      important: parseInt(todoImportant.value, 10) || 5,
      urgent: parseInt(todoUrgent.value, 10) || 5,
      date: date,
      link: todoLink.value.trim() || null,
      countdown: countdown,
    };
    if (id) {
      fetch(API + '/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(() => { closeModal(); refreshAll(); })
        .catch(console.error);
    } else {
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(() => { closeModal(); refreshAll(); })
        .catch(console.error);
    }
  });

  function refreshAll() {
    fetchList();
    fetchAllAndFillCanvas();
    fetchExpired();
    fetchDeadlineWarnings();
    fetchDayStats();
  }

  function fetchExpired() {
    fetch(API + '/expired')
      .then((r) => r.json())
      .then(renderExpired)
      .catch(() => { if (expiredList) expiredList.innerHTML = ''; });
  }

  function renderExpired(items) {
    if (!expiredList || !expiredBox) return;
    if (items.length === 0) {
      expiredBox.classList.add('hidden');
      return;
    }
    expiredBox.classList.remove('hidden');
    expiredList.innerHTML = '';
    items.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'expired-item';
      const reason = t.remainingPercent != null && t.remainingPercent <= 0 ? '倒计时已到期' : '已过截止时间';
      const titleSpan = '<span class="expired-item-title">' + escapeHtml(t.title || '未命名') + '</span>';
      const reasonSpan = '<span class="expired-item-reason">' + escapeHtml(reason) + '</span>';
      li.innerHTML =
        '<span class="expired-item-main">' + titleSpan + reasonSpan + '</span>' +
        '<span class="expired-item-actions">' +
        '<button type="button" class="expired-btn btn-done">搞定了</button>' +
        '<button type="button" class="expired-btn btn-delete">不干了</button>' +
        '<button type="button" class="expired-btn btn-snooze">再缓缓</button></span>';
      li.querySelector('.expired-item-main').addEventListener('click', () => openEdit(t.id));
      li.querySelector('.expired-item-actions .btn-done').addEventListener('click', (e) => { e.stopPropagation(); markDone(t.id, e); });
      li.querySelector('.expired-item-actions .btn-delete').addEventListener('click', (e) => { e.stopPropagation(); markDelete(t.id, e); });
      li.querySelector('.expired-item-actions .btn-snooze').addEventListener('click', (e) => { e.stopPropagation(); markSnooze(t.id, e); });
      expiredList.appendChild(li);
    });
  }

  function fetchDeadlineWarnings() {
    fetch(API + '/deadline-warnings')
      .then((r) => r.json())
      .then(renderDeadlineWarnings)
      .catch(() => { if (deadlineWarningsList) deadlineWarningsList.innerHTML = ''; });
  }

  function fetchDayStats() {
    const q = selectedDate ? '?date=' + encodeURIComponent(selectedDate) : '';
    fetch(API + '/day-stats' + q)
      .then((r) => r.json())
      .then((st) => {
        if (todayStatsGrave) todayStatsGrave.textContent = st.grave ?? 0;
        if (todayStatsIcu) todayStatsIcu.textContent = st.icu ?? 0;
        if (todayStatsHealthy) todayStatsHealthy.textContent = st.healthy ?? 0;
        if (todayStatsDone) todayStatsDone.textContent = st.done ?? 0;
        if (dayStatsTitle) dayStatsTitle.textContent = selectedDate ? '该日待办 · ' + selectedDate : '该日待办 · 全部';
      })
      .catch(() => {});
  }

  function renderDeadlineWarnings(items) {
    if (!deadlineWarningsList || !deadlineWarningsBox) return;
    if (items.length === 0) {
      deadlineWarningsBox.classList.add('hidden');
      return;
    }
    deadlineWarningsBox.classList.remove('hidden');
    deadlineWarningsList.innerHTML = '';
    items.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'deadline-warning-item';
      const pct = Math.round(t.remainingPercent);
      li.innerHTML =
        '<span class="deadline-warning-main">' +
        '<span class="deadline-warning-emoji">🔥</span>' +
        '<span class="deadline-warning-text">' + escapeHtml(t.title || '未命名') + '</span>' +
        '<span class="deadline-warning-remain">剩余 ' + (t.remainingText || pct + '%') + '</span>' +
        '</span>' +
        '<span class="deadline-warning-actions">' +
        '<button type="button" class="deadline-btn btn-done">搞定了</button>' +
        '<button type="button" class="deadline-btn btn-delete">不干了</button>' +
        '<button type="button" class="deadline-btn btn-snooze">再缓缓</button></span>';
      li.querySelector('.deadline-warning-main').addEventListener('click', () => openEdit(t.id));
      li.querySelector('.deadline-warning-actions .btn-done').addEventListener('click', (e) => { e.stopPropagation(); markDone(t.id, e); });
      li.querySelector('.deadline-warning-actions .btn-delete').addEventListener('click', (e) => { e.stopPropagation(); markDelete(t.id, e); });
      li.querySelector('.deadline-warning-actions .btn-snooze').addEventListener('click', (e) => { e.stopPropagation(); markSnooze(t.id, e); });
      deadlineWarningsList.appendChild(li);
    });
  }

  btnDelete.addEventListener('click', () => {
    const id = todoId.value.trim();
    if (!id) return;
    if (!confirm('确定删除？')) return;
    fetch(API + '/' + id, { method: 'DELETE' })
      .then(() => { closeModal(); refreshAll(); })
      .catch(console.error);
  });

  btnNew.addEventListener('click', openNew);
  btnCancel.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  sortSelect.addEventListener('change', fetchList);

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /** 按日历区域尺寸设置今日待办框：宽=日历 50%；展开时高=日历 70%，收起时高度自适应 */
  function updateTodayStatsBoxSize() {
    if (!todayStatsBox || !calendarPanel) return;
    const w = calendarPanel.offsetWidth;
    todayStatsBox.style.width = Math.round(w * 0.5) + 'px';
    if (todayStatsBox.classList.contains('collapsed')) {
      todayStatsBox.style.height = 'auto';
    } else {
      const h = calendarPanel.offsetHeight;
      todayStatsBox.style.height = Math.round(h * 0.7) + 'px';
    }
  }

  function setDayStatsCollapsed(collapsed) {
    if (!todayStatsBox || !dayStatsHeader) return;
    if (collapsed) {
      todayStatsBox.classList.add('collapsed');
      todayStatsBox.style.height = 'auto';
      if (dayStatsHeader) dayStatsHeader.setAttribute('aria-expanded', 'false');
    } else {
      todayStatsBox.classList.remove('collapsed');
      updateTodayStatsBoxSize();
      if (dayStatsHeader) dayStatsHeader.setAttribute('aria-expanded', 'true');
    }
    try { localStorage.setItem(DAY_STATS_COLLAPSED_KEY, collapsed ? '1' : ''); } catch (e) {}
  }

  function toggleDayStats() {
    const collapsed = todayStatsBox && todayStatsBox.classList.contains('collapsed');
    setDayStatsCollapsed(!collapsed);
  }

  renderCalendar();
  refreshAll();
  setInterval(refreshAll, 5000);
  try {
    const saved = localStorage.getItem(DAY_STATS_COLLAPSED_KEY);
    if (saved === '1' && todayStatsBox) {
      todayStatsBox.classList.add('collapsed');
      if (dayStatsHeader) dayStatsHeader.setAttribute('aria-expanded', 'false');
    }
  } catch (e) {}
  updateTodayStatsBoxSize();
  setTimeout(updateTodayStatsBoxSize, 100);
  window.addEventListener('resize', updateTodayStatsBoxSize);
  if (dayStatsHeader) {
    dayStatsHeader.addEventListener('click', toggleDayStats);
    dayStatsHeader.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDayStats(); } });
  }
})();
