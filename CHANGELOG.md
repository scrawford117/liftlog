# Changelog

LiftLog uses [semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
Bump **minor** for new features, **patch** for fixes, and note any change to the saved-data
format (it's migrated automatically on update).

## 0.2.0 — 2026-10-04
- **Cardio**: new Cardio exercise type with run, treadmill, bike, rower, swim and more. Plan distance, time and intervals; log distance and time, and see your pace.
- **Interval timer** for sprints/HIIT: work/rest countdown with beeps and a 3-2-1 lead-in.
- Starter **Cardio** program (Easy Run, Sprints, Bike). Add cardio to any day with **+ Cardio**.
- Progress: distance and pace charts, best pace, and this week's cardio totals.
- Streaks: rest days no longer start a streak on their own, and a finished workout with no completed sets doesn't count.
- "Minimise" is now "← Back". Fixed the date field overflowing on iPhone.
- Settings shows the app version.
- Data: database schema v2 (adds cardio). Existing data is upgraded automatically.

## 0.1.1 — 2026-10-03
- Rest timer alerts: chime (works with the silent switch on), vibration on Android, background notification, and keep-screen-on during workouts.

## 0.1.0 — 2026-10-03
- First release: programs from Workout Notes, workout logger, rest timer, calendar, streaks, progression suggestions, progress charts, JSON backup.
