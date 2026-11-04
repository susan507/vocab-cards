# What the app does

The source of truth for how the app behaves. Keep it short and high level; update it whenever a feature is added or changed.

## Books

- Books come from vocabulary websites: Usborne First Thousand Words, DK Illustrated Dictionary, Gente Hoy 1 (SpanishDict).
- A book has chapters, a chapter may have subtopics, in the same order as the source.
- Each word has Spanish, English, and audio and a picture when the source has them.
- A chapter can link to extra material on the source website, opened in the browser.

## Home and book screens

- Home, top to bottom: search, books, starred, learned. Starred and Learned collapse by tapping their title; Learned starts collapsed.
- Search matches chapter and subtopic names in English or Spanish; inside a book it only searches that book.
- Chapters show as tiles. Star a chapter to keep it on home; tick it to mark it learned.
- Settings (gear on home): new words per day for spaced repetition (default 50).
- A book starts with a "Review all" tile: spaced repetition over the whole book.

## Flashcards

- Full screen, one background colour, nothing scrolls. Spanish on top, English below, picture above when there is one.
- Audio plays once when a word appears; tapping anywhere replays it.
- Arrows and an audio icon hint at swiping and tapping; they don't do anything themselves.
- Top bar: close, mode, word list (jump to any word), extra material links when the chapter has them, position.
- Modes:
  - In order: swipe left/right for next/previous.
  - Random: same, shuffled.
  - Spaced repetition: see below.

## Spaced repetition

- Leitner-style Yes/No piles, like studying with physical cards.
- The card shows Spanish (audio, picture); tap to reveal English, then answer No or Yes. No swiping.
- A session runs in rounds, each shuffled. Round 1 is the whole session deck; every answer goes on a Yes or No pile. The next round is the latest No pile, until a round has no No. Then the words missed in round 1 are revised the same way until each gets a Yes. Yes words don't come back in that session. The round and pile sizes show during a session; when it's over, the session says so.
- An unfinished session resumes after closing or reloading, the same day only.
- Chapter session: every word in the chapter (or subtopic), every time.
- "Review all" session: Leitner boxes over the whole book. Words due today plus never-seen words (taken in book order), with new words capped per day by the setting (counted across sessions).
- Only round-1 answers (in any session) move boxes: Yes up one box (a new word counts as box 1), No back to box 1. Box n comes back every 2^(n-1) calendar days (box 7, every 64 days, is the top).
- The ✓ on the card retires a word: it's left out of every session. Retired words show ✓ in the word list; tapping restores them.
- No due counts on home or tiles. A chapter tile shows nothing until its words have been studied; after that a bar shows how fresh they are, full just after studying and shrinking until they're due.

## Profiles

- Optional name + PIN, not real security (the app says so). Each profile keeps its own stars, learned chapters, settings and word progress across devices; guests keep them on the device.

## Platforms

- Web app on GitHub Pages; Android APK on GitHub releases. Each APK version installs on its own or over an older one (v0.3.0 onwards; older versions need uninstalling once).
- The Android app can download a chapter's or book's audio and pictures for offline use.
