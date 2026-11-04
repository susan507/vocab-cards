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
- Settings on home: new words per day for spaced repetition (default 50; in progress).

## Flashcards

- Full screen, one background colour, nothing scrolls. Spanish on top, English below, picture above when there is one.
- Audio plays once when a word appears; tapping anywhere replays it.
- Arrows and an audio icon hint at swiping and tapping; they don't do anything themselves.
- Top bar: close, mode, word list (jump to any word), extra material links when the chapter has them, position.
- Modes:
  - In order: swipe left/right for next/previous.
  - Random: same, shuffled.
  - Spaced repetition: see below.

## Spaced repetition (in progress)

- Uses FSRS (ts-fsrs). Works on a chapter, or on a whole book via "Review all" in the book.
- The card shows Spanish (audio, picture); tap to reveal English, then rate: New, Not sure, Familiar, I know this (FSRS Again, Hard, Good, Easy). The rating moves on; no swiping.
- "I know this" on a word seen for the first time retires it: it never comes back. A ✓ on the card retires a word already being learned. Retired words show ✓ in the word list; tapping restores them.
- New words per day are capped by the setting; due words come first. When nothing is left, the session says so.
- No due counts anywhere. A chapter tile shows nothing until its words have been studied; after that a bar shows how well they're remembered, full when fresh and shrinking as time passes.

## Profiles

- Optional name + PIN, not real security (the app says so). Each profile keeps its own stars, learned chapters, settings and word progress across devices; guests keep them on the device.

## Platforms

- Web app on GitHub Pages; Android APK on GitHub releases. Each APK version installs on its own or over an older one (v0.3.0 onwards; older versions need uninstalling once).
- The Android app can download a chapter's or book's audio and pictures for offline use.
