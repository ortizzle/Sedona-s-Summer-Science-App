---
name: add-science-session
description: >
  Use this skill whenever the user wants to add a new study session, topic, or unit
  to Sedona's Science Lab app. Triggers on: "add session", "next session",
  "session 3", "add physics/chemistry content", "new topic", "load unit",
  "prepare for Sunday's session", or any mention of adding study material to the app.
  This skill covers the full workflow: git tagging, pulling Drive materials,
  writing SESSIONS/CARDS/QS data, and verifying in preview.
---

# Add Science Session

## Overview

Sedona's Science Lab is a single-file HTML app at:
`/Users/christopher_ortiz/Downloads/projects/Sedona's Summer Science App/index.html`

All study content lives in three JS arrays near the top of the `<script>` block:
- `SESSIONS[]` — session metadata and lesson summary content
- `CARDS[]` — flashcard data, filtered by session in Flashcards mode
- `QS[]` — quiz questions used in Levels, Quick Questions, and Sprint Quiz

The schedule and all source materials live in Google Drive folder:
`1zNSZDN3kqo_5ICrWixRtJZDzZBR6CYpk`

---

## Step 1 — Tag the current session in git

Before touching any content, tag the current state so the previous session is permanently preserved:

```bash
cd "/Users/christopher_ortiz/Downloads/projects/Sedona's Summer Science App"
git tag session-N -m "Session N — <current session title>"
git push origin session-N
```

Replace N with the **current** (outgoing) session number, not the new one being added.

---

## Step 2 — Pull materials from Google Drive

Use the Drive MCP tool to find the relevant unit materials:

1. Search for flashcard lists or unit notes matching the new session's topic:
   - `parentId = '1UZLp_8drU3L8rvDkbhbqFjHCzEhmKi0E'` (Chemistry documents folder)
   - `parentId = '1zNSZDN3kqo_5ICrWixRtJZDzZBR6CYpk'` (root folder — physics quizlet is here)
2. Also read the schedule doc (`1ud4r79AgRpFKk4pGKAqm8H1H5iS4PKLl7gdkKVPvzdc`) to get the exact date and subject for the new session
3. Read the full content of the relevant flashcard/notes doc using `read_file_content`

---

## Step 3 — Determine the new session's ID range

**Session numbering convention — never reuse or collide:**

| Subject     | Session | ID range (CARDS) | ID range (QS) |
|-------------|---------|-----------------|---------------|
| Chemistry   | 1       | 1–35            | 1–99          |
| Physics     | 2       | 101–199         | 201–299       |
| Chemistry   | 3       | 36–99           | 100–199 (lv only) |
| Physics     | 4       | 300–399         | 400–499       |
| Chemistry   | 5       | 500–599         | 500–599       |
| ...         | ...     | +100 per session| +100 per session|

Before writing, grep the file to find the highest existing IDs:
```bash
grep -o "id:[0-9]*" index.html | sort -t: -k2 -n | tail -5
```

---

## Step 4 — Add the SESSIONS entry

Find the `SESSIONS` array and add a new object **before** the two `combined:true` entries at the end:

```js
{
  num: N,                          // session number (integer)
  title: 'Topic Name',             // short title shown in banner
  date: 'Monday, June 2',          // from the schedule doc
  subject: 'Chemistry',            // or 'Physics'
  unit: 'Unit 3 — Atomic Structure', // from curriculum
  why: 'One compelling sentence about why this topic matters in the real world.',
  concepts: [
    {title: '⚛️ Concept Name', body: 'Brief explanation, 1-2 sentences.'},
    // 4-6 concepts total
  ],
  formulas: 'Formula1 = ...\nFormula2 = ...',  // \n between lines
},
```

---

## Step 5 — Add CARDS (flashcards)

Add to the `CARDS` array, inside the `// ── Session N: Subject — Topic ──` comment block.

Each card:
```js
{session:N, id:UNIQUE_ID, term:'Term Name', eq:'equation or null', def:'Definition shown on back of card.', hint:'Hint text shown on front.'},
```

**Minimum 12 cards per session.** Cover:
- Core vocabulary/definitions
- Key formulas (use `eq` field for the formula)
- Common misconceptions
- "Why it matters" connections

---

## Step 6 — Add QS (questions)

Add to the `QS` array inside the appropriate session comment block.

**Required distribution:**
- At least 12 easy (`lv:1`) — recall, definitions, single-step
- At least 8 medium (`lv:2`) — apply a formula, two-step reasoning
- At least 5 hard (`lv:3`) — multi-step, unfamiliar scenarios, edge cases

Each question:
```js
{session:N, id:UNIQUE_ID, lv:1,
 q:'Question text ending with ?',
 opts:['Option A','Option B','Option C','Option D'],
 ans:INDEX,   // 0, 1, 2, or 3 — MUST vary across questions
 hint:'One sentence hint that guides without giving it away.',
 ex:{
   main:'Full explanation of why the answer is correct and what concept it demonstrates.',
   tip:'Exam-focused tip, e.g. "On any exam, X always means Y."',
   mnemonic:'Memory trick or phrase to remember this.'
 }
},
```

**Critical — answer position variety:**
Distribute `ans` values roughly evenly across 0, 1, 2, 3. Never put 3+ questions in a row with the same `ans` value. Check your distribution before finishing:
```
ans:0 → ~25% of questions
ans:1 → ~25%
ans:2 → ~25%
ans:3 → ~25%
```

---

## Step 7 — Verify in preview

The preview server auto-starts. After editing:

1. Use `preview_eval` to reload: `location.reload()`
2. Check the home screen shows the new session banner
3. Switch to the new session in Hani's Hangout:
   ```js
   S.haniUnlocked=true; go('hani');
   document.getElementById('hani-lock-view').style.display='none';
   renderHaniDash();
   ```
4. Tap the new session button — verify the toast fires and home screen updates
5. Navigate to Levels: `go('lv')` — confirm new questions appear
6. Navigate to Flashcards: `go('fc')` — confirm new cards load

---

## Step 8 — Commit

Git auto-commits every file edit via the PostToolUse hook. No manual commit needed.
**The user pushes from GitHub Desktop** — never push automatically.

Remind the user to push when done.

---

## What NOT to change

- The two `combined:true` entries at the end of `SESSIONS[]` — they auto-count content
- The lesson modal HTML — it rebuilds dynamically from `SESSIONS` data
- The `applySession()` function — no changes needed for new sessions
- Any CSS — session content is purely data

---

## ID collision reference

If unsure about ID ranges, check the file directly:

```bash
# Highest CARD id
grep "session:[0-9]*,id:" index.html | grep -o "id:[0-9]*" | sort -t: -k2 -n | tail -3

# Highest QS id  
grep "session:[0-9]*,id:[0-9]*,lv:" index.html | grep -o "id:[0-9]*" | sort -t: -k2 -n | tail -3
```

Always use the next available block of 100 for a new session to leave room to grow.
