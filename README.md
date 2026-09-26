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

The mobile-friendly app separates the home overview, routine, combined calendar and tasks, weekly meal planner, personal progress, and data backups into shareable URL tabs. Tasks are added directly to a selected calendar day alongside events, with optional time and recurring schedule. It supports adding, completing and deleting tasks and morning routine steps. Tasks can have a date, optional starting time or same-day time range, and are grouped into Today (including overdue), Upcoming and All. Tasks may repeat daily, on selected weekdays, or monthly on the starting day (months without that day are skipped), optionally ending on an inclusive date. Each occurrence has its own completion state. Upcoming shows the next 30 days of repeating tasks; All shows each repeating series once, including ended series. Existing tasks without a date remain in All. The monthly calendar shows dated tasks, meals, and events with an optional time. The weekly meal planner supports breakfast, lunch, dinner, and snacks on chosen dates. It includes a local set of Slovenian meal ideas by meal type, available offline and addable to the selected day. A personal progress tab records an optional name, height and goal, dated weight and body measurements, a weight trend, and dated progress photos stored in IndexedDB after resizing. Data is stored in this browser's `localStorage`; routine steps can repeat every day or on selected weekdays, with optional time and end date; each day has its own completion state in the Europe/Ljubljana time zone. The routine tab also offers three offline starter programs. The routine tab supports manual water and step check-ins, and Home provides a quick water menu with 0.1, 0.25, and 0.5 L amounts; user-defined daily goals and time-based reminders while the page is open; system notifications require explicit browser permission and a service worker, and can be switched off in the app together with individual or all reminders. Background push while the app is closed requires future server infrastructure. The data section exports a JSON backup and imports entries from a backup without replacing existing entries, including repeat schedules, times, meals, profile, measurements, photos, routine schedules, check-in goals, and current-day water and step totals. Workouts and expenses are marked as upcoming modules. There are no accounts or cloud sync yet.

## Predlogi obrokov

V zavihku Jedilnik izberi vrsto obroka in klikni »Predlagaj mi obrok«. Vsak predlog vsebuje sestavine za eno osebo, čas in korake priprave. Ko predlog dodaš v tedenski jedilnik, recept odpreš s klikom na »Recept« pri obroku.

Sestavine, ki jih imaš doma, označi v zaprtem seznamu »Izberi sestavine« pri predlogih. Izbor se shrani v brskalnik in v varnostno kopijo. Predlogi se razvrstijo po številu manjkajočih sestavin; prikazan je tudi njihov seznam. Iskanje poteka lokalno po vključenih receptih.

## Kalorije in makrohranila

Pri obroku lahko vneseš porcijo, energijo (kcal), beljakovine, ogljikove hidrate in maščobe. Jedilnik sešteje samo obroke z vsemi štirimi hranilnimi vrednostmi in pokaže pokritost, da delni dnevni seštevek ni videti kot celoten vnos. Shranjene obroke lahko urejaš. Posodobljen Worker vrne približno oceno za fotografijo ali en obrok po receptu; uporabnik jo pred shranjevanjem preveri in popravi. Slikovna ocena porcije je nezanesljiva in ni prehranska analiza z laboratorijsko natančnostjo.

## Stroški

V zavihku Stroški lahko dodaš, urediš in odstraniš stroške z datumom, zneskom v EUR, kategorijo in opisom. Mesečni pregled pokaže vsoto in porabo po kategorijah. Zneski so shranjeni kot celi centi. Stroški se shranijo lokalno in so vključeni v izvoz ter uvoz varnostne kopije.
