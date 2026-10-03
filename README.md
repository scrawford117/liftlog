# LiftLog

A phone-first workout planner and tracker (installable PWA, works offline).

- **Today**: streak, this week's progress, today's planned workout or rest day
- **Workout**: sets pre-filled with working weights, tap to check off, edit weight/reps per set, rest timer, weight-increase suggestions
- **Calendar**: done / rest / missed days, per-day plan overrides, log past workouts
- **Programs**: weekly schedule, programs → days → exercises (supersets, retire, increments)
- **Progress**: top set & estimated 1RM per exercise, PRs, weekly volume, history
- **Settings**: units, progression threshold, JSON backup export/import

Seeded from the Workout Notes files (`src/db/seed.ts`).

```bash
npm install
npm run dev        # http://localhost:5173 ; add -- --host to open on your phone over Wi-Fi
npm test           # streak + progression logic
npm run build      # static site in dist/ (deploy anywhere with HTTPS to install on your phone)
```
