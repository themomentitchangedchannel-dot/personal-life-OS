const STORAGE_KEY = 'personal-life-os-v1';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Ljubljana', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const initial = { tasks: [], routine: [], routineDate: today() };
let state;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  state = saved && Array.isArray(saved.tasks) && Array.isArray(saved.routine) ? saved : initial;
} catch { state = initial; }
if (!Array.isArray(state.events)) state.events = [];
if (state.routineDate !== today()) {
  state.routine = state.routine.map(item => ({ ...item, done: false }));
  state.routineDate = today();
}
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Storage may be disabled. */ } };
const dateText = date => {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('sl-SI', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};
const fullDate = new Intl.DateTimeFormat('sl-SI', { timeZone: 'Europe/Ljubljana', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
document.querySelector('#top-date').textContent = fullDate;
document.querySelector('#full-date').textContent = fullDate;
document.querySelector('#task-date').value = today();
let taskView = 'today';
let selectedDate = today();
let displayedMonth = selectedDate.slice(0, 7);
const isoDate = date => date.toISOString().slice(0, 10);
const dateObject = date => new Date(`${date}T12:00:00Z`);
const longDate = date => new Intl.DateTimeFormat('sl-SI', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateObject(date));

function taskMatchesView(item) {
  if (taskView === 'all') return true;
  if (!item.date) return false;
  return taskView === 'today' ? item.date <= today() : item.date > today();
}

function renderList(kind) {
  const listId = kind === 'tasks' ? 'task' : 'routine';
  const list = document.querySelector(`#${listId}-list`);
  list.replaceChildren();
  const entries = kind === 'tasks'
    ? state.tasks.filter(taskMatchesView).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
    : state.routine;
  for (const item of entries) {
    const row = document.createElement('li');
    const label = document.createElement('label');
    if (item.done) label.classList.add('done');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = !!item.done;
    checkbox.addEventListener('change', () => { item.done = checkbox.checked; save(); render(); });
    const title = document.createElement('span'); title.textContent = item.text;
    label.append(checkbox, title);
    row.append(label);
    if (kind === 'tasks') {
      const due = document.createElement('span');
      due.className = 'due-date';
      due.textContent = item.date ? (item.date === today() ? 'Danes' : dateText(item.date)) : 'Brez datuma';
      if (item.date && item.date < today() && !item.done) due.classList.add('overdue');
      row.append(due);
    }
    const remove = document.createElement('button');
    remove.className = 'remove'; remove.type = 'button'; remove.textContent = '×';
    remove.setAttribute('aria-label', `Odstrani: ${item.text}`);
    remove.addEventListener('click', () => { state[kind] = state[kind].filter(entry => entry.id !== item.id); save(); render(); });
    row.append(remove); list.append(row);
  }
  const empty = document.querySelector(`#${listId}-empty`);
  empty.hidden = entries.length > 0;
  if (kind === 'tasks') empty.textContent = {
    today: 'Za danes ni opravil.', upcoming: 'Prihodnjih opravil še ni.', all: 'Začni z enim majhnim opravilom.'
  }[taskView];
}

function render() {
  renderList('tasks'); renderList('routine');
  renderCalendar();
  const dueToday = state.tasks.filter(item => item.date && item.date <= today());
  const tasksDone = dueToday.filter(item => item.done).length;
  const routineDone = state.routine.filter(item => item.done).length;
  document.querySelector('#task-count').textContent = `${tasksDone}/${dueToday.length}`;
  document.querySelector('#routine-count').textContent = `${routineDone}/${state.routine.length}`;
  const total = dueToday.length + state.routine.length;
  document.querySelector('#day-progress').textContent = `${total ? Math.round((tasksDone + routineDone) / total * 100) : 0}%`;
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === taskView));
  }
}

function renderCalendar() {
  const grid = document.querySelector('#calendar-grid');
  grid.replaceChildren();
  const monthStart = dateObject(`${displayedMonth}-01`);
  document.querySelector('#calendar-month').textContent = new Intl.DateTimeFormat('sl-SI', {
    month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(monthStart);
  for (const name of ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned']) {
    const weekday = document.createElement('span');
    weekday.className = 'calendar-weekday'; weekday.textContent = name; grid.append(weekday);
  }
  const offset = (monthStart.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  for (let index = 0; index < cells; index++) {
    const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), index - offset + 1, 12));
    const key = isoDate(date);
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = String(date.getUTCDate());
    button.setAttribute('aria-label', longDate(key));
    button.setAttribute('aria-pressed', String(key === selectedDate));
    if (key.slice(0, 7) !== displayedMonth) button.classList.add('other-month');
    if (key === today()) button.classList.add('today');
    if (key === selectedDate) button.classList.add('selected');
    const tasks = state.tasks.filter(item => item.date === key).length;
    const events = state.events.filter(item => item.date === key).length;
    if (tasks || events) {
      const dots = document.createElement('span'); dots.className = 'calendar-dots';
      if (tasks) { const dot = document.createElement('i'); dots.append(dot); }
      if (events) { const dot = document.createElement('i'); dot.className = 'event-dot'; dots.append(dot); }
      button.append(dots);
      button.setAttribute('aria-label', `${longDate(key)}: ${tasks} opravil, ${events} dogodkov`);
    }
    button.addEventListener('click', () => { selectedDate = key; displayedMonth = key.slice(0, 7); renderCalendar(); });
    grid.append(button);
  }
  document.querySelector('#selected-day-title').textContent = longDate(selectedDate);
  const dayList = document.querySelector('#day-list'); dayList.replaceChildren();
  const entries = [
    ...state.tasks.filter(item => item.date === selectedDate).map(item => ({ ...item, kind: 'task' })),
    ...state.events.filter(item => item.date === selectedDate).map(item => ({ ...item, kind: 'event' }))
  ].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  for (const item of entries) {
    const row = document.createElement('li');
    if (item.done) row.classList.add('completed');
    const marker = document.createElement('span'); marker.className = `kind ${item.kind === 'event' ? 'event' : ''}`;
    const title = document.createElement('span'); title.className = 'day-title'; title.textContent = item.text;
    row.append(marker, title);
    if (item.kind === 'event') {
      if (item.time) { const time = document.createElement('span'); time.className = 'day-time'; time.textContent = item.time; row.append(time); }
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = '×';
      remove.setAttribute('aria-label', `Odstrani dogodek: ${item.text}`);
      remove.addEventListener('click', () => { state.events = state.events.filter(entry => entry.id !== item.id); save(); render(); });
      row.append(remove);
    }
    dayList.append(row);
  }
  document.querySelector('#day-empty').hidden = entries.length > 0;
}

for (const [buttonId, shift] of [['calendar-prev', -1], ['calendar-next', 1]]) {
  document.querySelector(`#${buttonId}`).addEventListener('click', () => {
    const date = dateObject(`${displayedMonth}-01`);
    displayedMonth = isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + shift, 1, 12))).slice(0, 7);
    selectedDate = `${displayedMonth}-01`;
    renderCalendar();
  });
}
document.querySelector('#calendar-today').addEventListener('click', () => {
  selectedDate = today(); displayedMonth = selectedDate.slice(0, 7); renderCalendar();
});
document.querySelector('#event-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector('#event-title');
  const value = input.value.trim();
  if (!value) return;
  state.events.push({ id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, text: value,
    date: selectedDate, time: document.querySelector('#event-time').value });
  input.value = ''; document.querySelector('#event-time').value = '';
  save(); render(); input.focus();
});

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  taskView = button.dataset.view;
  render();
}));
for (const kind of ['tasks', 'routine']) {
  const form = document.querySelector(`#${kind === 'tasks' ? 'task' : 'routine'}-form`);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const input = form.querySelector('input:not([type="date"])');
    const value = input.value.trim();
    if (!value) return;
    const entry = { id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, text: value, done: false };
    if (kind === 'tasks') {
      entry.date = document.querySelector('#task-date').value || null;
      taskView = entry.date ? (entry.date <= today() ? 'today' : 'upcoming') : 'all';
      document.querySelector('#task-date').value = today();
    }
    state[kind].push(entry);
    input.value = ''; save(); render(); input.focus();
  });
}
save(); render();
