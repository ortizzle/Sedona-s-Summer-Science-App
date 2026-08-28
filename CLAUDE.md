# Claude Guide — Sedona's Learning Lab (formerly Science Lab)

## Vision

This is a progressive web app (PWA) built to help Sedona (a middle/high school student) master challenging academic material through gamified, mobile-first study tools. It started as a summer science app and is designed to grow into a **multi-subject learning platform** that can be used across all of her schooling years.

**Goals:**
- Make difficult concepts genuinely fun and sticky to learn (gamification, story hooks, mnemonics)
- Track what she actually understands vs. what she's guessing (Mistake Journal / Growth Zone)
- Give her educator (Hani, her dad) a private analytics view of her progress
- Work as a home-screen app on her phone with no login required

---

## Architecture

The app lives in a single file: **`index.html`**, plus three small support files: `manifest.json` (PWA install), `icon.svg`, and `sw.js` (service worker — caches the app shell and CDN assets so the PWA genuinely works offline; bump `CACHE_VERSION` in it if caching behavior changes). There is no build system, no backend, no database. All data is hardcoded as JavaScript arrays at the top of the script block, with `localStorage` used for XP, badge state, and custom cards. Keep this architecture — do not introduce a build step or a backend unless the user explicitly asks.

---

## Storage, Backup & Sync

Progress persistence is versioned and centralized in `index.html`:

- **`serializeProgress()` / `applyProgress()` / `migrateProgress()`** — the single payload format used by localStorage, file export/import, and sync codes. Every payload carries `v: SCHEMA_VERSION`. **If you change the saved shape, bump `SCHEMA_VERSION` and add a migration step to `migrateProgress()`** so older devices upgrade in place.
- **Keys**: `sedona_asl_s1` (main), `sedona_asl_s1_backup` (rolling backup written once per launch; auto-restored if the main key is corrupt), `sedona_custom_cards` (Hani's card edits).
- **Cross-device sync**: `makeSyncCode()` / `decodeSyncCode()` produce a gzip+base64 code with prefix `SSL2:` (`SSL2R:` = uncompressed fallback). Copy it on one device, paste it on the other via the "Backup & Cross-Device Sync" card in Hani's portal. No account, no server. A future cloud adapter (e.g. Drive) must reuse `serializeProgress()` — do not invent a second format.
- **Backup reminders**: `S.lastBackupTs` is set by any export/share/sync-code copy; the portal warns when it's missing or older than 7 days.

---

## Data Structures

### SESSIONS
Each study session corresponds to one tutoring meeting. A session belongs to one subject.

```js
{
  num: 1,                     // session number (unique across all subjects)
  title: 'Atoms, Isotopes & Ions',
  date: 'Friday, May 30',
  subject: 'Chemistry',       // display name; also used as a filter key
  unit: 'NGSS Unit 3',        // course unit label
  why: '...',                 // 2–3 sentence motivational hook shown to student
  concepts: [
    { title: '⚛️ Concept Name', body: 'Explanation...' }
  ],
  formulas: 'A = p + n\n...',  // newline-separated formulas shown on study screen
  story: {
    emoji: '⚗️',
    hook: 'One-line opener...',
    body: 'Multi-paragraph narrative to read before studying.',
    readyLabel: 'Button text →',
  },
  resources: [
    { icon: '📝', title: 'Resource Name', url: '...', desc: '...', src: 'Google Drive' }
  ],
}
```

`combined: true` sessions are whole-subject review modes (e.g. "All Chemistry"). Filter them out when building single-subject session lists.

**Content scoping rule — subjects never mingle.** All cumulative views (Sprint Quiz "All X — Cumulative", flashcard "All"/"Prev Sessions" scopes, Card Match fallbacks, `getQSFilter()`) build from **previous sessions of the same subject only**. Physics never deals History flashcards. The single exception is sessions flagged `mixedReview: true` (the summer comp-rehearsal Session 10), which intentionally span subjects — never make cross-subject the default again.

**Session numbering (8th-grade plan).** The internal `num` stays globally unique forever — it is the join key for `CARDS`/`QS` and the saved-progress data, and must never collide or be renumbered. For 8th grade, each subject's sessions should *display* as Session 1..N within that subject (derived from the session's position among its subject's sessions), while `num` keeps incrementing globally under the hood. Summer sessions 1–13 keep their historical numbers. Also expected for 8th grade: sessions will likely bundle **one week of class notes per session** rather than one tutoring meeting per session — confirm the exact rhythm with Hani when the first real unit lands.

### CARDS (Flashcards)
```js
{ session: 1, id: 1, term: 'Term', eq: 'A = B', def: 'Definition', hint: 'Memory hook' }
```
- `eq` is optional; rendered in a monospace code-block style on the card
- `hint` is a short mnemonic or memory trick (not the definition)
- `id` values must be unique within a session

### QS (Quiz Questions)
```js
{
  session: 1, id: 1, lv: 1,   // lv: 1=Easy, 2=Medium, 3=Hard
  q: 'Question text',
  opts: ['A','B','C','D'],     // always 4 options
  ans: 2,                      // 0-indexed index of the correct answer
  hint: 'Hint shown if student asks',
  ex: {
    main: 'Full explanation of why the answer is correct',
    tip: 'Test-taking tip',
    mnemonic: 'Optional memory aid'
  }
}
```
- Level 1: recall/definition questions
- Level 2: application/calculation questions  
- Level 3: analysis/multi-step reasoning questions
- Aim for at least 6–8 questions per level per session

### BADGES_DEF
Badges are unlocked by gameplay events (streaks, session completion, mastery). When adding a new subject, add a subject-specific badge (e.g., "First Physics session complete").

---

## How to Add a New Subject

1. **Create sessions** — Add entries to `SESSIONS[]`. Increment `num` globally (don't restart from 1 per subject — it's the internal join key; per-subject "Session 1..N" is a display concern, see the numbering plan above). Set `subject` to the new subject's display name (e.g., `'Biology'`, `'Algebra'`). Content stays subject-scoped automatically — never add cross-subject content to a subject's sessions.

2. **Create flashcards** — Add entries to `CARDS[]` with matching `session` numbers. Write 15–30 cards per session. Cards should prioritize: vocabulary, formulas, common misconceptions, mnemonics.

3. **Create quiz questions** — Add entries to `QS[]`. Write 6–8 questions per level (1, 2, 3) per session. Level 1 = recall, Level 2 = apply, Level 3 = reason/analyze.

4. **Register the subject** — Add an entry to `SUBJECTS_META` (icon, `cardFront` watermark text, `cardBack` emblem). Flashcard theming picks it up automatically; unknown subjects fall back to a neutral look.

5. **Tag mini-game content** — `TF_STATEMENTS`, `RANK_QUESTIONS`, and `SPOT_QUESTIONS` entries carry a `subj` field, and `SORT_SETS` a `subject` field. Games lead with the active subject's entries, so add at least a handful per new subject. The periodic table widget is chemistry-specific; similar reference tools can be added per subject (number line for math, timeline for history) behind a `getSession().subject` check.

6. **Educator portal** — Hani's Hangout (the password-protected educator view) automatically reflects any new sessions and questions because it reads from the same `SESSIONS`/`QS` arrays.

---

## Educator Portal (Hani's Hangout)

Password-protected section (parent/educator view) that shows:
- Total study time, sessions completed, quiz accuracy
- Per-question performance: strong (≥70% correct) vs. weak (<70%) topics
- Time spent per question
- AI-generated insight summary

**Future educator portal goals:**
- Session-by-session progress chart over time
- Comparison across subjects (which subject needs more attention)
- Recommended next session based on weak topics
- Exportable progress summary (PDF or share link)

The password is stored as a hardcoded hash in the script. Do not log it or expose it in plaintext.

---

## UX Principles

- **Mobile-first, touch-friendly.** All tap targets ≥ 44px. No hover-only interactions.
- **Gamified.** XP, levels, streaks, badges, confetti — these matter. Don't remove gamification elements to simplify.
- **Story-first.** Every session starts with a narrative hook that connects the material to the student's real life. Write these in second person, present tense, with genuine enthusiasm.
- **Sign-in flow**: Sedona picks subject & session first (subject-grouped picker), then reads the story hook. The 5-question mood check-in appears once per day, gated on the first quiz launch (`launchQuiz` → `showQuizCheckin`) — that's where feeling/confidence data is most meaningful for interpreting results.
- **Mistake-tolerant.** The Growth Zone (Mistake Journal) surfaces wrong answers without shame. Wrong answers get rich explanations with tips and mnemonics.
- **One file.** The PWA works offline and installs from the home screen. Do not introduce dependencies that require a server or build step.
- **Sedona's voice.** She's a sharp student who responds well to wit and real-world stakes. Avoid condescending tone. Assume she can handle "why this is actually cool" explanations.

---

## Subjects Covered

| Subject | Sessions | Status |
|---------|----------|--------|
| Chemistry | 1, 3 | Active — NGSS Unit 3 |
| Physics | 2, 4 | Active — Motion, Forces, Energy |
| History | 13 | Demo placeholder (Age of Exploration) — replace with real class content when 8th grade starts |

When adding new subjects in future school years, add a row to this table.

---

## Source Materials Workflow

Study content is sourced from:
- **Google Drive** — class notes, slides, flashcard lists (linked in `resources[]` per session)
- **PhET Simulations** — interactive science tools (phet.colorado.edu)
- **Educator input** — Hani reviews and approves content before it's added

When building a new session, pull the Google Drive materials first to ground the cards and questions in the actual class content. Do not invent facts — anchor everything to the provided notes/slides.

---

## Adding a New Subject From Scratch (Checklist)

- [ ] Confirm subject name, grade level, and course unit with Hani
- [ ] Get source materials (notes, slides, flashcard lists) from Google Drive
- [ ] Write SESSIONS entry with `why`, `concepts`, `formulas`, `story`, `resources`
- [ ] Write 15–30 CARDS entries (vocab, formulas, common mistakes)
- [ ] Write 18–24 QS entries (6–8 per level, levels 1–3)
- [ ] Add the subject to SUBJECTS_META (icon + card watermarks)
- [ ] Add subject-tagged entries to TF_STATEMENTS / SORT_SETS / RANK_QUESTIONS / SPOT_QUESTIONS
- [ ] Add a subject badge to BADGES_DEF
- [ ] Test on mobile (iPhone): home screen, flashcards, quiz, educator portal
- [ ] Verify Hani's Hangout shows the new session data correctly
