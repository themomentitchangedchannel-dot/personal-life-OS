# Personal Life OS

Personal Life OS is a modern personal organization application designed to bring everyday life into one simple system.

## Vision

One place to manage the most important parts of daily life without jumping between multiple apps.

## Planned modules

- 🍽️ Meal planning
- 💪 Workouts and fitness
- 🌅 Morning routines and habits
- 📅 Calendar
- ✅ To-do lists
- 💰 Expenses and budgeting
- 📊 Personal dashboard and progress overview

## Product direction

- Slovenian as the default language
- Multilingual architecture from the beginning
- Mobile-first responsive design
- Simple and modern user experience
- Built so additional modules can be added later
- Prepared for a broader international audience

## Run locally

Open `index.html` in a browser, or serve the folder with `python3 -m http.server 8000` and visit `http://localhost:8000`.

## Current version

The mobile-friendly app separates the home overview, routine, combined calendar and tasks, weekly meal planner, personal progress, and data backups into shareable URL tabs. Tasks are added directly to a selected calendar day alongside events, with optional time and recurring schedule. It supports adding, completing and deleting tasks and morning routine steps. Tasks can have a date, optional starting time or same-day time range, and are grouped into Today (including overdue), Upcoming and All. Tasks may repeat daily, on selected weekdays, or monthly on the starting day (months without that day are skipped), optionally ending on an inclusive date. Each occurrence has its own completion state. Upcoming shows the next 30 days of repeating tasks; All shows each repeating series once, including ended series. Existing tasks without a date remain in All. The monthly calendar shows dated tasks, meals, and events with an optional time. The weekly meal planner supports breakfast, lunch, dinner, and snacks on chosen dates. It includes a local set of Slovenian meal ideas by meal type, available offline and addable to the selected day. A personal progress tab records an optional name, height and goal, dated weight and body measurements, a weight trend, and dated progress photos stored in IndexedDB after resizing. Data is stored in this browser's `localStorage`; routine checkmarks reset each day in the Europe/Ljubljana time zone. The data section exports a JSON backup and imports entries from a backup without replacing existing entries, including repeat schedules, times, meals, profile, measurements and photos. Workouts and expenses are marked as upcoming modules. There are no accounts or cloud sync yet.
