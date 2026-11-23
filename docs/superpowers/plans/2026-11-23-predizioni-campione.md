# Predizioni campione Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local driver dropdown predictions for each season 2027–2029, each resolved independently.

**Architecture:** Add a separate card inside the existing Minigiochi section. Load the latest archived season roster for dropdowns, use the champion archive for outcomes, and store predictions in browser storage.

**Tech Stack:** Existing HTML, CSS, JavaScript, static champion data, and `localStorage`.

**Spec:** `docs/superpowers/specs/2026-11-23-predizioni-campione-design.md`

## Global Constraints
- Prediction window: 2027–2029.
- Each year 2027, 2028, and 2029 gets its own prediction and outcome; an error does not disable later years.
- Dropdown candidates come from the latest archived season roster.
- Preserve the existing historical quiz and its records.
- No account, backend, or dependency.

## Review Focus
- Missing or invalid local storage: prediction UI remains usable for the visit; historical quiz remains usable.
- Malformed saved prediction data: ignore invalid entries without affecting valid history.
- Champion not yet in archive: keep prediction pending across reloads.
- Champion appears in archive: resolve each pending prediction exactly once.
- Wrong prediction: close only that year's prediction; later years remain available.

---

### Task 1: Prediction interface and storage flow

**Files:**
- Modify: `index.html` within `#games`.
- Modify: `app.js` alongside champion-game logic.
- Modify: `style.css` for prediction card and responsive layout.

**Interfaces:**
- Consumes: existing `champions` array loaded from `/api/champions` or static data.
- Produces: year-specific dropdown forms and saved history under a new `localStorage` key; each record contains `year`, `driverId`, `name`, `status`, and `timestamp`.

- [x] Add accessible year-specific dropdowns and prediction history markup beside the existing quiz.
- [x] Add storage parsing that validates records and leaves the existing quiz storage untouched.
- [x] Load the latest archived roster and offer a dropdown for each year 2027–2029.
- [x] Resolve each pending prediction independently against champion data on load.
- [x] Keep future predictions pending and render all records with year, name, and pending/correct/incorrect state.
- [x] Style the new card for desktop and mobile using existing game-card patterns.
- [x] Review `app.js` control flow and HTML accessibility; confirm champion quiz keys and behavior remain untouched.
