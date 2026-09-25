const STORAGE_KEY = 'personal-life-os-v1';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Ljubljana', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const initial = { tasks: [], routine: [], routineDate: today() };
let state;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  state = saved && Array.isArray(saved.tasks) && Array.isArray(saved.routine) ? saved : initial;
} catch { state = initial; }
if (state.routineDate !== today()) {
  state.routine = state.routine.map(item => ({ ...item, done: false }));
  state.routineDate = today();
}
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Browser storage can be disabled. */ } };
const shortDate = new Intl.DateTimeFormat('sl-SI', { timeZone: 'Europe/Ljubljana', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
document.querySelector('#top-date').textContent = shortDate;
document.querySelector('#full-date').textContent = shortDate;
function renderList(kind) {
  const listId = kind === 'tasks' ? 'task' : 'routine';
  const list = document.querySelector(`#${listId}-list`);
  list.replaceChildren();
  for (const item of state[kind]) {
    const row = document.createElement('li');
    const label = document.createElement('label');
    if (item.done) label.classList.add('done');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = !!item.done;
    checkbox.addEventListener('change', () => { item.done = checkbox.checked; save(); render(); });
    const title = document.createElement('span'); title.textContent = item.text;
    label.append(checkbox, title);
    const remove = document.createElement('button');
    remove.className = 'remove'; remove.type = 'button'; remove.textContent = '×';
    remove.setAttribute('aria-label', `Odstrani: ${item.text}`);
    remove.addEventListener('click', () => { state[kind] = state[kind].filter(entry => entry.id !== item.id); save(); render(); });
    row.append(label, remove); list.append(row);
  }
  document.querySelector(`#${listId}-empty`).hidden = state[kind].length > 0;
}
function render() {
  renderList('tasks'); renderList('routine');
  const tasksDone = state.tasks.filter(item => item.done).length;
  const routineDone = state.routine.filter(item => item.done).length;
  document.querySelector('#task-count').textContent = `${tasksDone}/${state.tasks.length}`;
  document.querySelector('#routine-count').textContent = `${routineDone}/${state.routine.length}`;
  const total = state.tasks.length + state.routine.length;
  document.querySelector('#day-progress').textContent = `${total ? Math.round((tasksDone + routineDone) / total * 100) : 0}%`;
}
for (const kind of ['tasks', 'routine']) {
  const form = document.querySelector(`#${kind === 'tasks' ? 'task' : 'routine'}-form`);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const input = form.querySelector('input');
    const value = input.value.trim();
    if (!value) return;
    state[kind].push({ id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, text: value, done: false });
    input.value = ''; save(); render(); input.focus();
  });
}
save(); render();
