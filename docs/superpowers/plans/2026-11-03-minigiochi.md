# Minigiochi Implementation Plan

> **For agentic workers:** Execute inline, task by task.

**Goal:** Add offline F1 champion guessing game with capped attempts and a personal streak leaderboard.

**Architecture:** Export champion/year pairs from existing SQLite standings into a small static JSON bundle. Load it through the current static-data helper and save completed games in `localStorage`.

**Tech Stack:** Existing HTML, CSS, JavaScript, Python static data exporter.

**Spec:** `docs/superpowers/specs/2026-11-03-minigiochi-design.md`

## Global Constraints
- Keep the site static and usable from GitHub Pages or `index.html` opened from disk.
- Save personal history locally; do not add a backend.
- Allow at most 10 guesses per year and record one result per completed run.
- Rank runs by longest streak, fewest total guesses, then earliest timestamp.
- Keep only top five qualifying runs; keep latest-game summary separately.

## Review Focus
- Missing local storage: game remains playable and reports persistence failure.
- Corrupt saved data: ignore invalid records without breaking the game.
- Names with accents or punctuation: compare normalized names.

### Task 1: Static champions data
**Files:** Modify `build_static.py`; generate `static-api/champions.json` and bundled `static-api/local.js`.

### Task 2: Game interface and behavior
**Files:** Modify `index.html`, `app.js`, `style.css`.
Add navigation, accessible game form, random champion round, personal history, local persistence, and responsive styling.
