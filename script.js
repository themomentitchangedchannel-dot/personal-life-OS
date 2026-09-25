const STORAGE_KEY = 'personal-life-os-v1';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Ljubljana', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const initial = { tasks: [], routine: [], routineDate: today() };
let state;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  state = saved && Array.isArray(saved.tasks) && Array.isArray(saved.routine) ? saved : initial;
} catch { state = initial; }
if (!Array.isArray(state.events)) state.events = [];
if (!Array.isArray(state.meals)) state.meals = [];
if (!Array.isArray(state.pantryIngredients)) state.pantryIngredients = [];
if (!state.profile || typeof state.profile !== 'object' || Array.isArray(state.profile)) state.profile = {};
if (!Array.isArray(state.measurements)) state.measurements = [];
if (!state.checkinSettings || typeof state.checkinSettings !== 'object') state.checkinSettings = {};
if (state.checkinSettings.deviceEnabled == null)
  state.checkinSettings.deviceEnabled = 'Notification' in window && Notification.permission === 'granted';
if (!state.dailyCheckin || state.dailyCheckin.date !== today())
  state.dailyCheckin = { date: today(), waterMl: 0, steps: 0, notified: {} };
state.routine = state.routine.map(item => ({ ...item,
  completedDates: Array.isArray(item.completedDates) ? item.completedDates
    : item.done && state.routineDate === today() ? [today()] : [] }));
state.routineDate = today();
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
const addDays = (date, count) => isoDate(new Date(dateObject(date).getTime() + count * 86400000));
const longDate = date => new Intl.DateTimeFormat('sl-SI', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateObject(date));
const mealKinds = { breakfast: 'Zajtrk', lunch: 'Kosilo', dinner: 'Večerja', snack: 'Malica' };
const mealWeekStart = date => addDays(date, -((dateObject(date).getUTCDay() + 6) % 7));
let selectedMealDate = today();
let displayedMealWeek = mealWeekStart(today());

const isRecurring = item => !!item.recurrence;
const dayNumber = date => (dateObject(date).getUTCDay() + 6) % 7;
const routineOccursOn = (item, date) => {
  if (item.start && date < item.start) return false;
  if (item.until && date > item.until) return false;
  return !item.weekdays || item.weekdays.includes(dayNumber(date));
};
function occursOn(item, date) {
  if (!isRecurring(item)) return item.date === date;
  if (!item.date || date < item.date || (item.recurrence.until && date > item.recurrence.until)) return false;
  const rule = item.recurrence;
  if (rule.type === 'daily') return true;
  if (rule.type === 'weekly') return rule.weekdays.includes(dayNumber(date));
  if (rule.type === 'monthly') return Number(date.slice(8)) === Number(item.date.slice(8));
  return false;
}
function tasksForDate(date) {
  return state.tasks.filter(item => occursOn(item, date)).map(item => ({ item, date,
    done: isRecurring(item) ? (item.completedDates || []).includes(date) : !!item.done }));
}
function nextOccurrence(item) {
  const start = item.date && item.date > today() ? item.date : today();
  for (let offset = 0; offset < 400; offset++) {
    const date = isoDate(new Date(dateObject(start).getTime() + offset * 86400000));
    if (item.recurrence?.until && date > item.recurrence.until) break;
    if (occursOn(item, date)) return date;
  }
  return null;
}
function visibleTasks() {
  const entries = [];
  for (const item of state.tasks) {
    if (!isRecurring(item)) {
      if (taskView === 'all' || (item.date && (taskView === 'today' ? item.date <= today() : item.date > today())))
        entries.push({ item, date: item.date, done: !!item.done });
    } else if (taskView === 'all') {
      const upcoming = nextOccurrence(item);
      const date = upcoming || item.recurrence.until || item.date;
      entries.push({ item, date, ended: !upcoming, done: upcoming ? (item.completedDates || []).includes(date) : false });
    } else if (taskView === 'today') {
      if (occursOn(item, today())) entries.push({ item, date: today(), done: (item.completedDates || []).includes(today()) });
    } else {
      for (let offset = 1; offset <= 30; offset++) {
        const date = isoDate(new Date(dateObject(today()).getTime() + offset * 86400000));
        if (occursOn(item, date)) entries.push({ item, date, done: (item.completedDates || []).includes(date) });
      }
    }
  }
  return entries.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')
    || (a.item.timeStart || '').localeCompare(b.item.timeStart || ''));
}
const timeText = item => item.timeStart ? `${item.timeStart}${item.timeEnd ? `–${item.timeEnd}` : ''}` : '';

function renderList(kind) {
  const listId = kind === 'tasks' ? 'task' : 'routine';
  const list = document.querySelector(`#${listId}-list`);
  list.replaceChildren();
  const entries = kind === 'tasks' ? visibleTasks() : [...state.routine].sort((a, b) =>
    Number(routineOccursOn(b, today())) - Number(routineOccursOn(a, today()))
      || (a.time || '').localeCompare(b.time || '')).map(item => ({ item,
    done: (item.completedDates || []).includes(today()), inactive: !routineOccursOn(item, today()) }));
  for (const entry of entries) {
    const { item } = entry;
    const row = document.createElement('li');
    const label = document.createElement('label');
    if (entry.done) label.classList.add('done');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = entry.done; checkbox.disabled = !!entry.ended || !!entry.inactive;
    checkbox.addEventListener('change', () => {
      if (kind === 'tasks' && isRecurring(item)) {
        item.completedDates ||= [];
        item.completedDates = checkbox.checked
          ? [...new Set([...item.completedDates, entry.date])]
          : item.completedDates.filter(date => date !== entry.date);
      } else if (kind === 'routine') {
        item.completedDates = checkbox.checked
          ? [...new Set([...(item.completedDates || []), today()])]
          : (item.completedDates || []).filter(date => date !== today());
      } else item.done = checkbox.checked;
      save(); render();
    });
    const title = document.createElement('span'); title.textContent = item.text;
    label.append(checkbox, title);
    if (kind === 'tasks' && isRecurring(item)) {
      const repeat = document.createElement('small'); repeat.className = 'recurrence-label';
      repeat.textContent = '↻'; repeat.title = 'Ponavljajoče se opravilo'; label.append(repeat);
    }
    row.append(label);
    if (kind === 'routine') {
      const schedule = document.createElement('small'); schedule.className = 'routine-schedule';
      const weekdays = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];
      schedule.textContent = `${item.time ? `${item.time} · ` : ''}${item.weekdays ? item.weekdays.map(day => weekdays[day]).join(', ') : 'Vsak dan'}${item.until ? ` · do ${dateText(item.until)}` : ''}${entry.inactive ? ' · ni na sporedu danes' : ''}`;
      row.append(schedule);
    }
    if (kind === 'tasks') {
      if (timeText(item)) {
        const time = document.createElement('span'); time.className = 'time-label'; time.textContent = timeText(item); row.append(time);
      }
      const due = document.createElement('span');
      due.className = 'due-date';
      due.textContent = entry.ended ? 'Zaključeno' : entry.date ? (entry.date === today() ? 'Danes' : dateText(entry.date)) : 'Brez datuma';
      if (entry.ended) due.classList.add('ended-label');
      if (entry.date && entry.date < today() && !entry.done) due.classList.add('overdue');
      row.append(due);
    }
    const remove = document.createElement('button');
    remove.className = kind === 'tasks' && isRecurring(item) ? 'remove series-remove' : 'remove'; remove.type = 'button';
    remove.textContent = kind === 'tasks' && isRecurring(item) ? 'Izbriši serijo' : '×';
    remove.setAttribute('aria-label', `${kind === 'tasks' && isRecurring(item) ? 'Odstrani ponavljanje' : 'Odstrani'}: ${item.text}`);
    remove.addEventListener('click', () => { state[kind] = state[kind].filter(entry => entry.id !== item.id); save(); render(); });
    row.append(remove); list.append(row);
  }
  const empty = document.querySelector(`#${listId}-empty`);
  empty.hidden = entries.length > 0;
  if (kind === 'tasks') empty.textContent = {
    today: 'Za danes ni opravil.', upcoming: 'Prihodnjih opravil še ni.', all: 'Začni z enim majhnim opravilom.'
  }[taskView];
  document.querySelector('#task-range').hidden = taskView !== 'upcoming';
}

function render() {
  renderList('tasks'); renderList('routine');
  renderCalendar();
  renderMeals();
  renderProgress();
  renderCheckin();
  const dueToday = state.tasks.filter(item => isRecurring(item) ? occursOn(item, today()) : item.date && item.date <= today());
  const tasksDone = dueToday.filter(item => isRecurring(item) ? (item.completedDates || []).includes(today()) : item.done).length;
  const todayRoutine = state.routine.filter(item => routineOccursOn(item, today()));
  const routineDone = todayRoutine.filter(item => (item.completedDates || []).includes(today())).length;
  document.querySelector('#task-count').textContent = `${tasksDone}/${dueToday.length}`;
  document.querySelector('#routine-count').textContent = `${routineDone}/${todayRoutine.length}`;
  document.querySelector('#routine-today-label').textContent = `Danes: ${routineDone}/${todayRoutine.length}`;
  const total = dueToday.length + todayRoutine.length;
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
    const tasks = tasksForDate(key).length;
    const events = state.events.filter(item => item.date === key).length;
    const meals = state.meals.filter(item => item.date === key).length;
    if (tasks || events || meals) {
      const dots = document.createElement('span'); dots.className = 'calendar-dots';
      if (tasks) { const dot = document.createElement('i'); dots.append(dot); }
      if (events) { const dot = document.createElement('i'); dot.className = 'event-dot'; dots.append(dot); }
      if (meals) { const dot = document.createElement('i'); dot.className = 'meal-dot'; dots.append(dot); }
      button.append(dots);
      button.setAttribute('aria-label', `${longDate(key)}: ${tasks} opravil, ${events} dogodkov, ${meals} obrokov`);
    }
    button.addEventListener('click', () => { selectedDate = key; displayedMonth = key.slice(0, 7); renderCalendar(); });
    grid.append(button);
  }
  document.querySelector('#selected-day-title').textContent = longDate(selectedDate);
  document.querySelector('#task-date').value = selectedDate;
  const dayList = document.querySelector('#day-list'); dayList.replaceChildren();
  const entries = [
    ...tasksForDate(selectedDate).map(({ item, done }) => ({ ...item, done, kind: 'task' })),
    ...state.events.filter(item => item.date === selectedDate).map(item => ({ ...item, kind: 'event' })),
    ...state.meals.filter(item => item.date === selectedDate).map(item => ({ ...item,
      text: `${mealKinds[item.kind]}: ${item.text}`, kind: 'meal' }))
  ].sort((a, b) => (a.time || a.timeStart || '99:99').localeCompare(b.time || b.timeStart || '99:99'));
  for (const item of entries) {
    const row = document.createElement('li');
    if (item.done) row.classList.add('completed');
    const marker = document.createElement('span'); marker.className = `kind ${item.kind === 'event' ? 'event' : item.kind === 'meal' ? 'meal' : ''}`;
    const title = document.createElement('span'); title.className = 'day-title'; title.textContent = item.text;
    if (item.kind === 'task') {
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = item.done;
      checkbox.setAttribute('aria-label', `Opravljeno: ${item.text}`);
      checkbox.addEventListener('change', () => {
        const task = state.tasks.find(entry => entry.id === item.id);
        if (!task) return;
        if (isRecurring(task)) {
          task.completedDates ||= [];
          task.completedDates = checkbox.checked
            ? [...new Set([...task.completedDates, selectedDate])]
            : task.completedDates.filter(date => date !== selectedDate);
        } else task.done = checkbox.checked;
        save(); render();
      });
      row.append(checkbox);
    }
    row.append(marker, title);
    const displayTime = item.kind === 'event' ? item.time : timeText(item);
    if (displayTime) { const time = document.createElement('span'); time.className = 'day-time'; time.textContent = displayTime; row.append(time); }
    if (item.kind === 'event' || item.kind === 'task') {
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove'; remove.textContent = '×';
      remove.setAttribute('aria-label', `${item.kind === 'task' ? isRecurring(item) ? 'Odstrani ponavljanje' : 'Odstrani opravilo' : 'Odstrani dogodek'}: ${item.text}`);
      remove.addEventListener('click', () => {
        const kind = item.kind === 'task' ? 'tasks' : 'events';
        state[kind] = state[kind].filter(entry => entry.id !== item.id); save(); render();
      });
      row.append(remove);
    }
    dayList.append(row);
  }
  document.querySelector('#day-empty').hidden = entries.length > 0;
}

function renderMeals() {
  const end = addDays(displayedMealWeek, 6);
  document.querySelector('#meal-week-title').textContent = `${dateText(displayedMealWeek)} – ${dateText(end)}`;
  const week = document.querySelector('#meal-week'); week.replaceChildren();
  const weekdayNames = ['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'];
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(displayedMealWeek, offset);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'meal-day';
    button.setAttribute('aria-label', longDate(date));
    button.setAttribute('aria-pressed', String(date === selectedMealDate));
    const heading = document.createElement('strong'); heading.textContent = weekdayNames[offset];
    const number = document.createElement('small'); number.textContent = dateText(date);
    button.append(heading, number);
    for (const meal of state.meals.filter(item => item.date === date)
      .sort((a, b) => Object.keys(mealKinds).indexOf(a.kind) - Object.keys(mealKinds).indexOf(b.kind))) {
      const chip = document.createElement('span'); chip.className = 'meal-chip';
      chip.textContent = `${mealKinds[meal.kind]}: ${meal.text}`; button.append(chip);
    }
    button.addEventListener('click', () => { selectedMealDate = date; clearSuggestion(); renderMeals(); });
    week.append(button);
  }
  document.querySelector('#meal-day-title').textContent = longDate(selectedMealDate);
  const list = document.querySelector('#meal-list'); list.replaceChildren();
  const entries = state.meals.filter(item => item.date === selectedMealDate)
    .sort((a, b) => Object.keys(mealKinds).indexOf(a.kind) - Object.keys(mealKinds).indexOf(b.kind));
  for (const item of entries) {
    const row = document.createElement('li');
    const kind = document.createElement('span'); kind.className = 'meal-kind'; kind.textContent = mealKinds[item.kind];
    const title = document.createElement('span'); title.className = 'meal-name'; title.textContent = item.text;
    const remove = document.createElement('button'); remove.className = 'remove'; remove.type = 'button'; remove.textContent = '×';
    remove.setAttribute('aria-label', `Odstrani obrok: ${item.text}`);
    remove.addEventListener('click', () => { state.meals = state.meals.filter(meal => meal.id !== item.id); save(); render(); });
    row.append(kind, title);
    const recipe = mealRecipes.find(entry => entry.id === item.recipeId);
    if (recipe) {
      const details = document.createElement('details'); details.className = 'planned-recipe';
      const summary = document.createElement('summary'); summary.textContent = 'Recept';
      details.append(summary, recipeContent(recipe)); row.append(details);
    }
    row.append(remove); list.append(row);
  }
  document.querySelector('#meal-empty').hidden = entries.length > 0;
}

for (const [buttonId, shift] of [['meal-prev', -7], ['meal-next', 7]]) {
  document.querySelector(`#${buttonId}`).addEventListener('click', () => {
    displayedMealWeek = addDays(displayedMealWeek, shift);
    selectedMealDate = displayedMealWeek;
    clearSuggestion();
    renderMeals();
  });
}
document.querySelector('#meal-today').addEventListener('click', () => {
  selectedMealDate = today(); displayedMealWeek = mealWeekStart(today()); clearSuggestion(); renderMeals();
});
document.querySelector('#meal-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector('#meal-title');
  const value = input.value.trim(); if (!value) return;
  const kind = document.querySelector('#meal-kind').value;
  state.meals.push({ id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, date: selectedMealDate,
    kind, text: value, recipeId: currentSuggestion?.kind === kind && currentSuggestion.title === value ? currentSuggestion.id : undefined });
  input.value = ''; clearSuggestion(); save(); render(); input.focus();
});
let currentSuggestion = null;
function clearSuggestion() {
  currentSuggestion = null;
  document.querySelector('#suggestion-result').hidden = true;
  document.querySelector('#suggestion-empty').hidden = true;
}
const ingredientNames = {
  jajce: /jajc|jajč|jajic/i, mleko: /mlek|napitk/i, ovseni: /ovsen/i,
  banana: /banan/i, orehi: /oreh/i, jogurt: /jogurt/i, sadje: /sad|jagod|borovn|malin/i,
  skuta: /skut/i, kruh: /kruh|toast/i, riž: /riž/i, piščanec: /piščan/i,
  zelenjava: /zelenjav/i, korenje: /koren/i, paprika: /paprik/i, čebula: /čebul/i,
  špinača: /špinač/i, paradižnik: /paradiž/i, kumara: /kumar/i, solata: /solat/i,
  česen: /česn/i, olje: /olj/i, testenine: /testenin/i, tuna: /tun/i,
  leča: /leč/i, fižol: /fižol/i, losos: /losos/i, brokoli: /brokol/i,
  kuskus: /kuskus/i, krompir: /krompir/i, sir: /sir|parmezan/i,
  tortilja: /tortil/i, humus: /humus/i, bučka: /bučk/i, jabolko: /jabolk/i,
  voda: /vod|jušne osnove/i, limona: /limon/i, med: /medu|med$/i,
  cimet: /cimet/i, drobnjak: /drobnjak/i
};
function ingredientKey(value) {
  const normalized = value.toLocaleLowerCase('sl-SI').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const canonical = normalized.replace(/^\s*[\d¼½¾.,/\s]+\s*(g|kg|ml|l|žlička|žlici|žlice|rezini|rezina|pest|strok|večji|velika|ščepec)?\s*/i, '').trim();
  for (const [name, pattern] of Object.entries(ingredientNames)) {
    const simple = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (new RegExp(pattern.source.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), 'i').test(canonical)) return simple;
  }
  return canonical.replace(/\b(in|ali|sveže|sveža|mlade|kuhane|suhega|odcejene)\b/g, '').trim();
}
function ingredientMatches(input, required) {
  if (input === required) return true;
  // Ujemanje na koren besede pokrije npr. »jajca« in »jajce«.
  return input.length >= 4 && required.length >= 4 && (input.startsWith(required.slice(0, 4)) || required.startsWith(input.slice(0, 4)));
}
const pantryKeys = [...new Set(mealRecipes.flatMap(recipe => recipe.ingredients.map(ingredientKey)))].sort((a, b) => a.localeCompare(b, 'sl'));
const pantryLabels = Object.fromEntries(Object.keys(ingredientNames).map(name =>
  [name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), name]));
state.pantryIngredients = state.pantryIngredients.filter(key => pantryKeys.includes(key));
const pantryOptions = document.querySelector('#pantry-options');
function renderPantryCount() {
  const count = state.pantryIngredients.length;
  document.querySelector('#pantry-count').textContent = `(${count} ${count === 1 ? 'izbrana' : count === 2 ? 'izbrani' : 'izbranih'})`;
}
for (const key of pantryKeys) {
  const label = document.createElement('label');
  const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = key;
  checkbox.checked = state.pantryIngredients.includes(key);
  checkbox.addEventListener('change', () => {
    state.pantryIngredients = [...pantryOptions.querySelectorAll('input:checked')].map(input => input.value);
    save(); renderPantryCount(); clearSuggestion();
  });
  const name = pantryLabels[key] || key;
  label.append(checkbox, document.createTextNode(name[0].toLocaleUpperCase('sl-SI') + name.slice(1)));
  pantryOptions.append(label);
}
document.querySelector('#pantry-clear').addEventListener('click', () => {
  pantryOptions.querySelectorAll('input:checked').forEach(input => { input.checked = false; });
  state.pantryIngredients = []; save(); renderPantryCount(); clearSuggestion();
});
renderPantryCount();
function recipeContent(recipe) {
  const container = document.createElement('div'); container.className = 'recipe-details';
  const info = document.createElement('p'); info.textContent = `${recipe.minutes} min · za 1 osebo`;
  const ingredientsTitle = document.createElement('strong'); ingredientsTitle.textContent = 'Sestavine';
  const ingredients = document.createElement('ul');
  recipe.ingredients.forEach(text => { const item = document.createElement('li'); item.textContent = text; ingredients.append(item); });
  const stepsTitle = document.createElement('strong'); stepsTitle.textContent = 'Priprava';
  const steps = document.createElement('ol');
  recipe.steps.forEach(text => { const item = document.createElement('li'); item.textContent = text; steps.append(item); });
  container.append(info, ingredientsTitle, ingredients, stepsTitle, steps);
  return container;
}
function suggestMeal() {
  const kind = document.querySelector('#meal-kind').value;
  const availableIngredients = state.pantryIngredients;
  const alreadyPlanned = new Set(state.meals.filter(item => item.date === selectedMealDate).map(item => item.text));
  let choices = mealRecipes.filter(recipe => recipe.kind === kind).map(recipe => ({ recipe,
    missing: recipe.ingredients.filter(ingredient => !availableIngredients.some(input => ingredientMatches(input, ingredientKey(ingredient)))) }));
  if (availableIngredients.length) {
    choices = choices.filter(entry => entry.missing.length < entry.recipe.ingredients.length)
      .sort((a, b) => a.missing.length - b.missing.length || a.recipe.minutes - b.recipe.minutes);
  } else choices.sort(() => Math.random() - 0.5);
  const fresh = choices.filter(entry => entry.recipe.id !== currentSuggestion?.id && !alreadyPlanned.has(entry.recipe.title));
  const next = (fresh.length ? fresh : choices.filter(entry => entry.recipe.id !== currentSuggestion?.id))[0] || choices[0];
  const empty = document.querySelector('#suggestion-empty');
  if (!next) {
    clearSuggestion();
    empty.textContent = availableIngredients.length
      ? 'Med recepti za ta obrok ni ujemanja. Poskusi dodati še kakšno sestavino ali izberi drugo vrsto obroka.'
      : 'Ni več predlogov za ta obrok.';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  const { recipe, missing } = next;
  currentSuggestion = recipe;
  document.querySelector('#suggestion-kind').textContent = `PREDLOG ZA ${mealKinds[kind].toUpperCase()}`;
  document.querySelector('#suggestion-text').textContent = recipe.title;
  document.querySelector('#suggestion-match').textContent = availableIngredients.length
    ? missing.length ? `Imaš ${recipe.ingredients.length - missing.length} od ${recipe.ingredients.length} sestavin. Manjka še: ${missing.join(', ')}.` : 'Vse sestavine imaš doma.'
    : '';
  document.querySelector('#suggestion-recipe').replaceChildren(...recipeContent(recipe).childNodes);
  document.querySelector('#suggestion-result').hidden = false;
}
document.querySelector('#suggest-meal').addEventListener('click', suggestMeal);
document.querySelector('#next-suggestion').addEventListener('click', suggestMeal);
document.querySelector('#meal-kind').addEventListener('change', clearSuggestion);
document.querySelector('#use-suggestion').addEventListener('click', () => {
  if (!currentSuggestion) return;
  document.querySelector('#meal-kind').value = currentSuggestion.kind;
  document.querySelector('#meal-title').value = currentSuggestion.title;
  document.querySelector('#meal-form').requestSubmit();
});

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

const measurementFields = { weight: ['Teža', 'kg', 20, 500], waist: ['Pas', 'cm', 30, 250], bodyFat: ['Telesna maščoba', '%', 1, 80], chest: ['Prsni koš', 'cm', 40, 250], hips: ['Boki', 'cm', 40, 250], arm: ['Nadlaket', 'cm', 15, 100], thigh: ['Stegno', 'cm', 25, 150], calf: ['Meča', 'cm', 15, 100] };
const measurementForm = document.querySelector('#measurement-form');
measurementForm.elements.date.value = today();
const profileForm = document.querySelector('#profile-form');
for (const key of ['name', 'height', 'goal']) profileForm.elements[key].value = state.profile[key] ?? '';
profileForm.addEventListener('submit', event => {
  event.preventDefault();
  const height = profileForm.elements.height.value;
  state.profile = { name: profileForm.elements.name.value.trim(), goal: profileForm.elements.goal.value.trim(), height: height ? Number(height) : null };
  save(); document.querySelector('#profile-status').textContent = 'Osnovni podatki so shranjeni.';
});
measurementForm.addEventListener('submit', event => {
  event.preventDefault();
  const error = document.querySelector('#measurement-error');
  const values = {};
  for (const key of Object.keys(measurementFields)) {
    const raw = measurementForm.elements[key].value;
    if (raw !== '') values[key] = Number(raw);
  }
  if (!Object.keys(values).length) { error.textContent = 'Vpiši vsaj eno meritev.'; error.hidden = false; return; }
  error.hidden = true;
  state.measurements.push({ id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, date: measurementForm.elements.date.value, ...values });
  measurementForm.reset(); measurementForm.elements.date.value = today();
  save(); render();
});
function renderProgress() {
  const entries = [...state.measurements].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const list = document.querySelector('#measurement-list'); list.replaceChildren();
  document.querySelector('#measurement-empty').hidden = entries.length > 0;
  for (const item of entries) {
    const row = document.createElement('li');
    const date = document.createElement('strong'); date.textContent = longDate(item.date);
    const details = document.createElement('span');
    details.textContent = Object.entries(measurementFields).filter(([key]) => item[key] != null)
      .map(([key, [label, unit]]) => `${label}: ${item[key]} ${unit}`).join(' · ');
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove';
    remove.textContent = '×'; remove.setAttribute('aria-label', `Odstrani meritev: ${longDate(item.date)}`);
    remove.addEventListener('click', () => { state.measurements = state.measurements.filter(entry => entry.id !== item.id); save(); render(); });
    row.append(date, details, remove); list.append(row);
  }
  const weights = entries.filter(item => Number.isFinite(item.weight)).reverse();
  const summary = document.querySelector('#progress-summary'); summary.replaceChildren();
  if (weights.length) {
    const first = weights[0].weight; const last = weights.at(-1).weight;
    for (const [label, value] of [['Začetna teža', `${first} kg`], ['Zadnja teža', `${last} kg`], ['Sprememba', `${last > first ? '+' : ''}${Math.round((last - first) * 10) / 10} kg`]]) {
      const card = document.createElement('div'); const caption = document.createElement('span');
      caption.textContent = label; const number = document.createElement('strong'); number.textContent = value;
      card.append(caption, number); summary.append(card);
    }
  }
  const chartWrap = document.querySelector('#progress-chart-wrap'); chartWrap.hidden = weights.length < 2;
  const chart = document.querySelector('#progress-chart'); chart.replaceChildren();
  if (weights.length < 2) return;
  const min = Math.min(...weights.map(item => item.weight)); const max = Math.max(...weights.map(item => item.weight));
  const range = Math.max(max - min, 1);
  const points = weights.map((item, index) => [30 + index * 540 / (weights.length - 1), 150 - (item.weight - min) * 120 / range]);
  const ns = 'http://www.w3.org/2000/svg';
  const line = document.createElementNS(ns, 'polyline'); line.setAttribute('points', points.map(point => point.join(',')).join(' '));
  line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#5e8968'); line.setAttribute('stroke-width', '3'); chart.append(line);
  for (const [x, y] of points) { const dot = document.createElementNS(ns, 'circle'); dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', '5'); dot.setAttribute('fill', '#304c3d'); chart.append(dot); }
  chart.setAttribute('aria-label', `Teža od ${weights[0].weight} kg (${longDate(weights[0].date)}) do ${weights.at(-1).weight} kg (${longDate(weights.at(-1).date)})`);
}

function refreshDailyCheckin() {
  if (state.dailyCheckin?.date !== today()) {
    state.dailyCheckin = { date: today(), waterMl: 0, steps: 0, notified: {} };
    save(); return true;
  }
  state.dailyCheckin.notified ||= {};
  return false;
}
function renderCheckin() {
  refreshDailyCheckin();
  const { waterMl, steps, notified } = state.dailyCheckin;
  const { waterGoalMl, stepsGoal } = state.checkinSettings;
  document.querySelector('#water-total').textContent = `${(waterMl / 1000).toLocaleString('sl-SI', { maximumFractionDigits: 2 })} L`;
  document.querySelector('#home-water-total').textContent = document.querySelector('#water-total').textContent;
  document.querySelector('#steps-total').textContent = steps.toLocaleString('sl-SI');
  document.querySelector('#water-target').textContent = waterGoalMl
    ? `Cilj: ${(waterGoalMl / 1000).toLocaleString('sl-SI', { maximumFractionDigits: 2 })} L` : 'Določi svoj dnevni cilj.';
  document.querySelector('#steps-target').textContent = stepsGoal ? `Cilj: ${stepsGoal.toLocaleString('sl-SI')} korakov` : 'Določi svoj dnevni cilj.';
  document.querySelector('#water-progress').value = waterGoalMl ? Math.min(100, waterMl / waterGoalMl * 100) : 0;
  document.querySelector('#steps-progress').value = stepsGoal ? Math.min(100, steps / stepsGoal * 100) : 0;
  const messages = [];
  if (state.checkinSettings.waterEnabled && notified.water && waterGoalMl && waterMl < waterGoalMl) messages.push('Si danes spil dovolj vode?');
  if (state.checkinSettings.stepsEnabled && notified.steps && stepsGoal && steps < stepsGoal) messages.push('Si danes naredil dovolj korakov?');
  document.querySelector('#daily-reminders').replaceChildren(...messages.map(message => {
    const paragraph = document.createElement('p'); paragraph.textContent = message; return paragraph;
  }));
  document.querySelector('#notification-permission').textContent = state.checkinSettings.deviceEnabled
    ? 'Izklopi obvestila v napravi' : 'Omogoči obvestila v napravi';
}
const settingsForm = document.querySelector('#checkin-settings');
const checkinStatus = document.querySelector('#checkin-status');
const settings = state.checkinSettings;
settingsForm.elements.waterGoal.value = settings.waterGoalMl ? settings.waterGoalMl / 1000 : '';
settingsForm.elements.stepsGoal.value = settings.stepsGoal || '';
settingsForm.elements.waterEnabled.checked = !!settings.waterEnabled;
settingsForm.elements.stepsEnabled.checked = !!settings.stepsEnabled;
settingsForm.elements.waterTime.value = settings.waterTime || '15:00';
settingsForm.elements.stepsTime.value = settings.stepsTime || '20:00';
settingsForm.addEventListener('submit', event => {
  event.preventDefault();
  const form = settingsForm.elements;
  state.checkinSettings = { waterGoalMl: form.waterGoal.value ? Math.round(Number(form.waterGoal.value) * 1000) : null,
    stepsGoal: form.stepsGoal.value ? Number(form.stepsGoal.value) : null,
    waterEnabled: form.waterEnabled.checked, stepsEnabled: form.stepsEnabled.checked,
    waterTime: form.waterTime.value, stepsTime: form.stepsTime.value,
    deviceEnabled: !!state.checkinSettings.deviceEnabled };
  save(); renderCheckin(); checkReminders();
  checkinStatus.textContent = 'Cilji in opomniki so shranjeni.';
});
document.querySelector('#water-tiny').addEventListener('click', () => {
  refreshDailyCheckin(); state.dailyCheckin.waterMl = Math.min(20000, state.dailyCheckin.waterMl + 100); save(); renderCheckin();
});
document.querySelector('#water-small').addEventListener('click', () => {
  refreshDailyCheckin(); state.dailyCheckin.waterMl = Math.min(20000, state.dailyCheckin.waterMl + 250); save(); renderCheckin();
});
document.querySelector('#water-large').addEventListener('click', () => {
  refreshDailyCheckin(); state.dailyCheckin.waterMl = Math.min(20000, state.dailyCheckin.waterMl + 500); save(); renderCheckin();
});
document.querySelector('#home-water-toggle').addEventListener('click', () => {
  const options = document.querySelector('#home-water-options');
  options.hidden = !options.hidden;
  document.querySelector('#home-water-toggle').setAttribute('aria-expanded', String(!options.hidden));
});
document.querySelectorAll('[data-water-amount]').forEach(button => button.addEventListener('click', () => {
  refreshDailyCheckin(); state.dailyCheckin.waterMl = Math.min(20000, state.dailyCheckin.waterMl + Number(button.dataset.waterAmount));
  save(); renderCheckin();
  document.querySelector('#home-water-options').hidden = true;
  document.querySelector('#home-water-toggle').setAttribute('aria-expanded', 'false');
  document.querySelector('#home-water-status').textContent = `Danes: ${document.querySelector('#home-water-total').textContent} vode.`;
  document.querySelector('#home-water-toggle').focus();
}));
document.querySelector('#water-set').addEventListener('click', () => {
  const input = document.querySelector('#water-entry');
  if (!input.value || !input.checkValidity()) return;
  refreshDailyCheckin(); state.dailyCheckin.waterMl = Math.round(Number(input.value) * 1000);
  input.value = ''; save(); renderCheckin();
});
document.querySelector('#steps-set').addEventListener('click', () => {
  const input = document.querySelector('#steps-entry');
  if (!input.value || !input.checkValidity()) return;
  refreshDailyCheckin(); state.dailyCheckin.steps = Number(input.value);
  input.value = ''; save(); renderCheckin();
});
async function checkReminders() {
  if (refreshDailyCheckin()) renderCheckin();
  const currentTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Ljubljana' }).format(new Date());
  const checks = [
    ['water', 'waterEnabled', 'waterTime', 'waterGoalMl', 'waterMl', 'Si danes spil dovolj vode?'],
    ['steps', 'stepsEnabled', 'stepsTime', 'stepsGoal', 'steps', 'Si danes naredil dovolj korakov?']
  ];
  for (const [key, enabled, time, goal, amount, message] of checks) {
    if (!state.checkinSettings[enabled] || !state.checkinSettings[goal]
      || currentTime < (state.checkinSettings[time] || '23:59')
      || state.dailyCheckin[amount] >= state.checkinSettings[goal] || state.dailyCheckin.notified[key]) continue;
    state.dailyCheckin.notified[key] = true; save(); renderCheckin();
    if (state.checkinSettings.deviceEnabled && 'Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        await registration.showNotification('Personal Life OS', { body: message, tag: `checkin-${key}-${today()}` });
      } catch { /* The in-app reminder remains visible. */ }
    }
  }
}
document.querySelector('#notification-permission').addEventListener('click', async () => {
  if (state.checkinSettings.deviceEnabled) {
    state.checkinSettings.deviceEnabled = false; save(); renderCheckin();
    checkinStatus.textContent = 'Obvestila v napravi so izklopljena. Dovoljenje strani lahko prekličeš v nastavitvah brskalnika.';
    return;
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    checkinStatus.textContent = 'Ta brskalnik ne podpira obvestil v napravi. Opomniki v aplikaciji še vedno delujejo.'; return;
  }
  try {
    const permission = await Notification.requestPermission();
    state.checkinSettings.deviceEnabled = permission === 'granted'; save(); renderCheckin();
    checkinStatus.textContent = permission === 'granted'
      ? 'Obvestila v napravi so omogočena, ko je aplikacija odprta.'
      : 'Obvestila v napravi niso omogočena. Opomniki v aplikaciji še vedno delujejo.';
    if (permission === 'granted') await navigator.serviceWorker.register('./sw.js');
  } catch { checkinStatus.textContent = 'Obvestil v napravi ni bilo mogoče omogočiti.'; }
});
document.querySelector('#disable-reminders').addEventListener('click', () => {
  state.checkinSettings.waterEnabled = false;
  state.checkinSettings.stepsEnabled = false;
  state.checkinSettings.deviceEnabled = false;
  settingsForm.elements.waterEnabled.checked = false;
  settingsForm.elements.stepsEnabled.checked = false;
  save(); renderCheckin();
  checkinStatus.textContent = 'Vsi opomniki so izklopljeni. Znova jih vklopiš z označitvijo in shranjevanjem nastavitev.';
});
setInterval(checkReminders, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
checkReminders();

// Photos live in IndexedDB so they do not fill the small localStorage quota.
const photosDb = new Promise((resolve, reject) => {
  if (!window.indexedDB) { reject(new Error('Ta brskalnik ne podpira shranjevanja fotografij.')); return; }
  const request = indexedDB.open('personal-life-os-photos', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('Shranjevanje fotografij ni na voljo.'));
});
async function photosRequest(method, value) {
  const db = await photosDb;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('photos', method === 'getAll' ? 'readonly' : 'readwrite');
    const request = method === 'getAll' ? transaction.objectStore('photos').getAll()
      : transaction.objectStore('photos')[method](value);
    request.onsuccess = () => { if (method === 'getAll') resolve(request.result); };
    transaction.oncomplete = () => { if (method !== 'getAll') resolve(); };
    transaction.onerror = () => reject(new Error('Fotografije ni mogoče shraniti ali prebrati.'));
  });
}
const photoForm = document.querySelector('#photo-form');
const photoStatus = document.querySelector('#photo-status');
photoForm.elements.date.value = today();
function compressedPhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const source = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(source);
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    image.onerror = () => { URL.revokeObjectURL(source); reject(new Error('Slike ni mogoče prebrati.')); };
    image.src = source;
  });
}
async function renderPhotos() {
  const photos = (await photosRequest('getAll')).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const gallery = document.querySelector('#photo-grid'); gallery.replaceChildren();
  document.querySelector('#photo-empty').hidden = photos.length > 0;
  for (const photo of photos) {
    const card = document.createElement('figure');
    const image = document.createElement('img'); image.src = photo.image; image.loading = 'lazy';
    image.alt = `Napredek, ${longDate(photo.date)}${photo.caption ? `: ${photo.caption}` : ''}`;
    const caption = document.createElement('figcaption'); caption.textContent = `${longDate(photo.date)}${photo.caption ? ` · ${photo.caption}` : ''}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove';
    remove.textContent = 'Odstrani'; remove.setAttribute('aria-label', `Odstrani fotografijo: ${longDate(photo.date)}`);
    remove.addEventListener('click', async () => {
      try { await photosRequest('delete', photo.id); await renderPhotos(); photoStatus.textContent = 'Fotografija je odstranjena.'; }
      catch (error) { photoStatus.textContent = error.message; }
    });
    card.append(image, caption, remove); gallery.append(card);
  }
}
photoForm.addEventListener('submit', async event => {
  event.preventDefault(); photoStatus.textContent = '';
  const file = photoForm.elements.photo.files[0];
  if (!file || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) || file.size > 15_000_000) {
    photoStatus.textContent = 'Izberi sliko JPG, PNG, WebP ali AVIF, veliko največ 15 MB.'; return;
  }
  const button = photoForm.querySelector('button[type=submit]'); button.disabled = true;
  try {
    const existing = await photosRequest('getAll');
    if (existing.length >= 100) throw new Error('Shranjenih je lahko največ 100 fotografij.');
    const image = await compressedPhoto(file);
    if (image.length > 1_500_000) throw new Error('Slika je po obdelavi še vedno prevelika. Izberi manjšo fotografijo.');
    await photosRequest('put', { id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      date: photoForm.elements.date.value, caption: photoForm.elements.caption.value.trim(), image });
    photoForm.reset(); photoForm.elements.date.value = today();
    photoStatus.textContent = 'Fotografija je shranjena.'; await renderPhotos();
  } catch (error) { photoStatus.textContent = error.message; }
  finally { button.disabled = false; }
});
renderPhotos().catch(error => { photoStatus.textContent = error.message; });

const backupStatus = document.querySelector('#backup-status');
let pendingImport = null;
document.querySelector('#backup-export').addEventListener('click', async () => {
  try {
  const photos = await photosRequest('getAll');
  const backup = { format: 'personal-life-os', version: 1, exportedAt: new Date().toISOString(),
    routineDate: state.routineDate, tasks: state.tasks, routine: state.routine, events: state.events, meals: state.meals,
    profile: state.profile, measurements: state.measurements, photos, pantryIngredients: state.pantryIngredients,
    dailyCheckin: state.dailyCheckin, checkinSettings: state.checkinSettings };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = `personal-life-os-${today()}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  backupStatus.textContent = 'Kopija je pripravljena za prenos.';
  } catch (error) { backupStatus.textContent = error.message; }
});

const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && isoDate(dateObject(value)) === value;
const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
function validatedEntries(entries, kind, backupRoutineDate) {
  if (!Array.isArray(entries) || entries.length > 5000) throw new Error('Neveljavno število vnosov.');
  return entries.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.text !== 'string'
      || !item.text.trim() || item.text.length > 120) throw new Error('Kopija vsebuje neveljaven vnos.');
    const clean = { id: item.id, text: item.text.trim() };
    if (kind === 'meals') {
      if (!validDate(item.date) || !Object.hasOwn(mealKinds, item.kind))
        throw new Error('Kopija vsebuje neveljaven obrok.');
      clean.date = item.date; clean.kind = item.kind;
    } else if (kind === 'events') {
      if (!validDate(item.date) || (item.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)))
        throw new Error('Kopija vsebuje neveljaven datum ali uro.');
      clean.date = item.date; clean.time = item.time || '';
    } else {
      clean.done = kind === 'routine' && backupRoutineDate !== today() ? false : item.done === true;
      if (kind === 'routine') {
        if ((item.start != null && !validDate(item.start)) || (item.until != null && (!validDate(item.until) || (item.start && item.until < item.start)))
          || (item.time && !validTime(item.time)) || (item.weekdays != null && (!Array.isArray(item.weekdays)
            || !item.weekdays.length || item.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)))
          || (item.completedDates != null && (!Array.isArray(item.completedDates) || item.completedDates.length > 5000
            || item.completedDates.some(date => !validDate(date)))))
          throw new Error('Kopija vsebuje neveljavno rutino.');
        clean.start = item.start || null; clean.until = item.until || null;
        clean.time = item.time || '';
        if (item.weekdays) clean.weekdays = [...new Set(item.weekdays)];
        clean.completedDates = item.completedDates ? [...new Set(item.completedDates)] : clean.done ? [today()] : [];
      }
      if (kind === 'tasks') {
        if (item.date != null && !validDate(item.date)) throw new Error('Kopija vsebuje neveljaven datum.');
        clean.date = item.date || null;
        if ((item.timeStart && !validTime(item.timeStart)) || (item.timeEnd && (!validTime(item.timeEnd)
          || !item.timeStart || item.timeEnd <= item.timeStart)))
          throw new Error('Kopija vsebuje neveljavno uro.');
        if (item.timeStart) clean.timeStart = item.timeStart;
        if (item.timeEnd) clean.timeEnd = item.timeEnd;
        if (item.recurrence) {
          const rule = item.recurrence;
          if (!clean.date || !['daily', 'weekly', 'monthly'].includes(rule.type)
            || !Array.isArray(rule.weekdays) || rule.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)
            || (rule.type === 'weekly' && rule.weekdays.length === 0)
            || (rule.until != null && (!validDate(rule.until) || rule.until < clean.date))
            || !Array.isArray(item.completedDates) || item.completedDates.length > 5000
            || item.completedDates.some(date => !validDate(date)))
            throw new Error('Kopija vsebuje neveljavno ponavljanje.');
          clean.recurrence = { type: rule.type, weekdays: [...new Set(rule.weekdays)], until: rule.until || null };
          clean.completedDates = [...new Set(item.completedDates)];
        }
      }
    }
    return clean;
  });
}
function validatedProfile(profile) {
  if (profile == null) return {};
  if (typeof profile !== 'object' || Array.isArray(profile)
    || (profile.name != null && (typeof profile.name !== 'string' || profile.name.length > 80))
    || (profile.goal != null && (typeof profile.goal !== 'string' || profile.goal.length > 160))
    || (profile.height != null && (!Number.isFinite(profile.height) || profile.height < 80 || profile.height > 250)))
    throw new Error('Kopija vsebuje neveljavne osnovne podatke.');
  return { name: (profile.name || '').trim(), goal: (profile.goal || '').trim(), height: profile.height ?? null };
}
function validatedMeasurements(entries) {
  if (entries == null) return [];
  if (!Array.isArray(entries) || entries.length > 5000) throw new Error('Neveljavno število meritev.');
  return entries.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || !validDate(item.date))
      throw new Error('Kopija vsebuje neveljaven datum meritve.');
    const clean = { id: item.id, date: item.date };
    for (const [key, [, , min, max]] of Object.entries(measurementFields)) {
      if (item[key] == null) continue;
      if (!Number.isFinite(item[key]) || item[key] < min || item[key] > max)
        throw new Error('Kopija vsebuje neveljavno meritev.');
      clean[key] = item[key];
    }
    if (Object.keys(clean).length === 2) throw new Error('Kopija vsebuje prazno meritev.');
    return clean;
  });
}
function validatedPhotos(photos) {
  if (photos == null) return [];
  if (!Array.isArray(photos) || photos.length > 100) throw new Error('Neveljavno število fotografij.');
  return photos.map(photo => {
    if (!photo || typeof photo.id !== 'string' || !photo.id || !validDate(photo.date)
      || typeof photo.caption !== 'string' || photo.caption.length > 120
      || typeof photo.image !== 'string' || photo.image.length > 1_500_000
      || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo.image))
      throw new Error('Kopija vsebuje neveljavno fotografijo.');
    return { id: photo.id, date: photo.date, caption: photo.caption, image: photo.image };
  });
}
function validatedCheckinSettings(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Neveljavne nastavitve opomnikov.');
  const result = {};
  for (const [key, max] of [['waterGoalMl', 20000], ['stepsGoal', 100000]]) {
    if (value[key] != null && (!Number.isInteger(value[key]) || value[key] < 1 || value[key] > max))
      throw new Error('Kopija vsebuje neveljaven cilj.');
    result[key] = value[key] ?? null;
  }
  for (const key of ['waterTime', 'stepsTime']) {
    if (value[key] != null && !validTime(value[key])) throw new Error('Kopija vsebuje neveljavno uro opomnika.');
    result[key] = value[key] || (key === 'waterTime' ? '15:00' : '20:00');
  }
  result.waterEnabled = value.waterEnabled === true;
  result.stepsEnabled = value.stepsEnabled === true;
  return result;
}
function validatedDailyCheckin(value) {
  if (value == null || value.date !== today()) return null;
  if (!Number.isInteger(value.waterMl) || value.waterMl < 0 || value.waterMl > 20000
    || !Number.isInteger(value.steps) || value.steps < 0 || value.steps > 100000)
    throw new Error('Kopija vsebuje neveljaven dnevni vnos.');
  return { date: today(), waterMl: value.waterMl, steps: value.steps, notified: {} };
}
document.querySelector('#backup-file').addEventListener('change', async event => {
  pendingImport = null;
  document.querySelector('#import-preview').hidden = true;
  backupStatus.textContent = '';
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 80_000_000) throw new Error('Datoteka je prevelika (največ 80 MB).');
    const backup = JSON.parse(await file.text());
    if (backup?.format !== 'personal-life-os' || backup.version !== 1)
      throw new Error('Ta datoteka ni podprta kopija Personal Life OS.');
    pendingImport = Object.fromEntries(['tasks', 'routine', 'events', 'meals'].map(kind => [kind,
      validatedEntries(kind === 'meals' && backup.meals == null ? [] : backup[kind], kind, backup.routineDate)]));
    pendingImport.profile = validatedProfile(backup.profile);
    pendingImport.measurements = validatedMeasurements(backup.measurements);
    pendingImport.photos = validatedPhotos(backup.photos);
    pendingImport.checkinSettings = validatedCheckinSettings(backup.checkinSettings);
    pendingImport.dailyCheckin = validatedDailyCheckin(backup.dailyCheckin);
    pendingImport.pantryIngredients = Array.isArray(backup.pantryIngredients)
      ? backup.pantryIngredients.filter(key => typeof key === 'string' && pantryKeys.includes(key)).slice(0, pantryKeys.length) : [];
    const counts = ['tasks', 'routine', 'events', 'meals'].map(kind =>
      pendingImport[kind].filter(item => !state[kind].some(existing => existing.id === item.id)).length);
    document.querySelector('#import-summary').textContent =
      `Za dodajanje: ${counts[0]} opravil, ${counts[1]} korakov rutine, ${counts[2]} dogodkov, ${counts[3]} obrokov, ${pendingImport.measurements.filter(item => !state.measurements.some(existing => existing.id === item.id)).length} meritev, ${pendingImport.photos.length} fotografij (že shranjene se preskočijo). Osnovni podatki iz kopije dopolnijo prazna polja.`;
    document.querySelector('#import-preview').hidden = false;
  } catch (error) { backupStatus.textContent = error instanceof Error ? error.message : 'Datoteke ni mogoče prebrati.'; }
  event.target.value = '';
});
document.querySelector('#backup-cancel').addEventListener('click', () => {
  pendingImport = null; document.querySelector('#import-preview').hidden = true; backupStatus.textContent = '';
});
document.querySelector('#backup-import').addEventListener('click', async () => {
  if (!pendingImport) return;
  const toImport = pendingImport;
  const importButton = document.querySelector('#backup-import'); importButton.disabled = true;
  try {
  const existingPhotos = await photosRequest('getAll');
  const existingIds = new Set(existingPhotos.map(photo => photo.id));
  if (existingPhotos.length + toImport.photos.filter(photo => !existingIds.has(photo.id)).length > 100)
    throw new Error('Za uvoz je dovolj prostora za največ 100 fotografij.');
  for (const photo of toImport.photos) if (!existingIds.has(photo.id)) await photosRequest('put', photo);
  for (const kind of ['tasks', 'routine', 'events', 'meals']) {
    const ids = new Set(state[kind].map(item => item.id));
    for (const item of toImport[kind]) if (!ids.has(item.id)) { state[kind].push(item); ids.add(item.id); }
  }
  const measurementIds = new Set(state.measurements.map(item => item.id));
  for (const item of toImport.measurements) if (!measurementIds.has(item.id)) { state.measurements.push(item); measurementIds.add(item.id); }
  for (const key of ['name', 'height', 'goal']) if (!state.profile[key] && toImport.profile[key]) state.profile[key] = toImport.profile[key];
  state.pantryIngredients = [...new Set([...state.pantryIngredients, ...toImport.pantryIngredients])];
  pantryOptions.querySelectorAll('input').forEach(input => { input.checked = state.pantryIngredients.includes(input.value); });
  renderPantryCount(); clearSuggestion();
  for (const key of ['name', 'height', 'goal']) profileForm.elements[key].value = state.profile[key] ?? '';
  if (toImport.dailyCheckin) {
    state.dailyCheckin.waterMl = Math.max(state.dailyCheckin.waterMl, toImport.dailyCheckin.waterMl);
    state.dailyCheckin.steps = Math.max(state.dailyCheckin.steps, toImport.dailyCheckin.steps);
  }
  if (!Object.keys(state.checkinSettings).length) state.checkinSettings = toImport.checkinSettings;
  else {
    if (!state.checkinSettings.waterGoalMl && toImport.checkinSettings.waterGoalMl) state.checkinSettings.waterGoalMl = toImport.checkinSettings.waterGoalMl;
    if (!state.checkinSettings.stepsGoal && toImport.checkinSettings.stepsGoal) state.checkinSettings.stepsGoal = toImport.checkinSettings.stepsGoal;
  }
  for (const key of ['waterGoal', 'stepsGoal']) settingsForm.elements[key].value =
    key === 'waterGoal' ? (state.checkinSettings.waterGoalMl || 0) / 1000 || '' : state.checkinSettings.stepsGoal || '';
  for (const key of ['waterEnabled', 'stepsEnabled']) settingsForm.elements[key].checked = !!state.checkinSettings[key];
  for (const key of ['waterTime', 'stepsTime']) settingsForm.elements[key].value = state.checkinSettings[key] || (key === 'waterTime' ? '15:00' : '20:00');
  pendingImport = null;
  document.querySelector('#import-preview').hidden = true;
  backupStatus.textContent = 'Podatki so dodani. Obstoječi vnosi so ohranjeni.';
  save(); render(); await renderPhotos();
  } catch (error) { backupStatus.textContent = error.message; }
  finally { importButton.disabled = false; }
});

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  taskView = button.dataset.view;
  render();
}));
document.querySelector('#task-repeat').addEventListener('change', event => {
  const weekly = event.target.value === 'weekly';
  document.querySelector('#task-weekdays').hidden = !weekly;
  document.querySelector('#task-until-wrap').hidden = event.target.value === 'none';
  document.querySelector('#task-form-error').hidden = true;
  if (weekly && !document.querySelector('#task-weekdays input:checked')) {
    const date = document.querySelector('#task-date').value || today();
    document.querySelector(`#task-weekdays input[value="${dayNumber(date)}"]`).checked = true;
  }
});
const routineForm = document.querySelector('#routine-form');
routineForm.querySelector('#routine-start').value = today();
document.querySelector('#routine-repeat').addEventListener('change', event => {
  const weekly = event.target.value === 'weekly';
  document.querySelector('#routine-weekdays').hidden = !weekly;
  if (weekly && !document.querySelector('#routine-weekdays input:checked'))
    document.querySelector(`#routine-weekdays input[value="${dayNumber(document.querySelector('#routine-start').value || today())}"]`).checked = true;
});
routineForm.addEventListener('submit', event => {
  event.preventDefault();
  const start = document.querySelector('#routine-start').value;
  const until = document.querySelector('#routine-until').value;
  const weekly = document.querySelector('#routine-repeat').value === 'weekly';
  const weekdays = [...document.querySelectorAll('#routine-weekdays input:checked')].map(day => Number(day.value));
  const error = document.querySelector('#routine-error');
  if (until && until < start) { error.textContent = 'Končni datum mora biti na dan začetka ali pozneje.'; error.hidden = false; return; }
  if (weekly && (!weekdays.length || (until && !Array.from({ length: Math.min(7, Math.round((dateObject(until) - dateObject(start)) / 86400000) + 1) }, (_, i) => addDays(start, i)).some(date => weekdays.includes(dayNumber(date)))))) {
    error.textContent = 'V izbranem obdobju izberi vsaj en dan ponavljanja.'; error.hidden = false; return;
  }
  error.hidden = true;
  state.routine.push({ id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    text: document.querySelector('#routine-input').value.trim(), start, until: until || null,
    time: document.querySelector('#routine-time').value, ...(weekly ? { weekdays } : {}), completedDates: [] });
  routineForm.reset(); document.querySelector('#routine-start').value = today();
  document.querySelector('#routine-weekdays').hidden = true;
  save(); render(); document.querySelector('#routine-input').focus();
});
const routinePrograms = {
  morning: ['Kozarec vode', 'Kratek razteg', 'Zapiši najpomembnejšo nalogo dneva'],
  evening: ['Pripravi stvari za jutri', 'Uredi prostor', 'Čas brez zaslona pred spanjem'],
  movement: ['Kratek sprehod', 'Vaje za gibljivost', 'Trening moči']
};
document.querySelectorAll('[data-program]').forEach(button => button.addEventListener('click', () => {
  const suggestions = routinePrograms[button.dataset.program];
  let added = 0;
  for (const text of suggestions) {
    if (state.routine.some(item => item.text.toLocaleLowerCase('sl') === text.toLocaleLowerCase('sl'))) continue;
    state.routine.push({ id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      text, start: today(), until: null, time: '',
      ...(text === 'Trening moči' ? { weekdays: [0, 2, 4] } : {}), completedDates: [] });
    added++;
  }
  save(); render();
  document.querySelector('#routine-program-status').textContent = added
    ? `Dodani so ${added} novi koraki. Urediš jih lahko tako, da jih odstraniš in vneseš z želenim urnikom.`
    : 'Koraki tega programa so že dodani.';
}));
for (const kind of ['tasks']) {
  const form = document.querySelector(`#${kind === 'tasks' ? 'task' : 'routine'}-form`);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const input = form.querySelector('input:not([type="date"])');
    const value = input.value.trim();
    if (!value) return;
    const entry = { id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, text: value, done: false };
    if (kind === 'tasks') {
      const repeatType = document.querySelector('#task-repeat').value;
      const start = document.querySelector('#task-date').value;
      const until = document.querySelector('#task-until').value;
      const timeStart = document.querySelector('#task-time-start').value;
      const timeEnd = document.querySelector('#task-time-end').value;
      const error = document.querySelector('#task-form-error');
      if (repeatType !== 'none' && !start) {
        error.textContent = 'Za ponavljanje izberi začetni datum.'; error.hidden = false; return;
      }
      const weekdays = [...document.querySelectorAll('#task-weekdays input:checked')].map(day => Number(day.value));
      if (repeatType === 'weekly' && !weekdays.length) {
        error.textContent = 'Izberi vsaj en dan v tednu.'; error.hidden = false; return;
      }
      if (repeatType !== 'none' && until && until < start) {
        error.textContent = 'Končni datum mora biti na dan začetka ali pozneje.'; error.hidden = false; return;
      }
      if (timeEnd && (!timeStart || timeEnd <= timeStart)) {
        error.textContent = 'Za obdobje izberi uro začetka in poznejšo uro konca.'; error.hidden = false; return;
      }
      error.hidden = true;
      entry.date = start || null;
      if (timeStart) entry.timeStart = timeStart;
      if (timeEnd) entry.timeEnd = timeEnd;
      if (repeatType !== 'none') entry.recurrence = { type: repeatType, weekdays: repeatType === 'weekly' ? weekdays : [], until: until || null };
      if (repeatType !== 'none') entry.completedDates = [];
      if (isRecurring(entry) && !nextOccurrence(entry)) {
        error.textContent = 'V izbranem obdobju ni termina za to opravilo.'; error.hidden = false; return;
      }
      const nextDate = isRecurring(entry) ? nextOccurrence(entry) : entry.date;
      const horizon = isoDate(new Date(dateObject(today()).getTime() + 30 * 86400000));
      taskView = !entry.date ? 'all' : nextDate <= today() ? 'today'
        : isRecurring(entry) && nextDate > horizon ? 'all' : 'upcoming';
      document.querySelector('#task-date').value = selectedDate;
      document.querySelector('#task-repeat').value = 'none';
      document.querySelector('#task-weekdays').hidden = true;
      document.querySelector('#task-until-wrap').hidden = true;
      document.querySelector('#task-until').value = '';
      document.querySelector('#task-time-start').value = '';
      document.querySelector('#task-time-end').value = '';
      document.querySelectorAll('#task-weekdays input').forEach(day => { day.checked = false; });
    }
    state[kind].push(entry);
    input.value = ''; save(); render(); input.focus();
  });
}
const tabNames = new Set(['domov', 'rutina', 'koledar', 'jedilnik', 'napredek', 'podatki']);
function showTab() {
  const requested = decodeURIComponent(location.hash.slice(1));
  const active = requested === 'opravila' ? 'koledar' : tabNames.has(requested) ? requested : 'domov';
  for (const section of document.querySelectorAll('[data-tab-view]')) section.hidden = section.dataset.tabView !== active;
  for (const link of document.querySelectorAll('[data-tab]')) {
    if (link.dataset.tab === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', showTab);
document.querySelectorAll('[data-tab]').forEach(link => link.addEventListener('click', () => {
  if (location.hash === link.getAttribute('href')) showTab();
}));
save(); render(); showTab();
