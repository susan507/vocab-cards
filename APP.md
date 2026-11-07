# What the app does

The source of truth for how the app behaves. Keep it short and high level; update it whenever a feature is added or changed.

## Books

- Books come from vocabulary websites: Usborne First Thousand Words, DK Illustrated Dictionary, Gente Hoy 1 (SpanishDict).
- A book has chapters, a chapter may have subtopics, in the same order as the source.
- Each word has Spanish, English, and audio and a picture when the source has them.
- A chapter can link to extra material on the source website, opened in the browser.
- Private books: a book file (e.g. Gente al día 1, made from a glossary the user owns) can be imported in Settings and removed there. It's never part of the app or website. Signed in, it's saved privately to the profile; as a guest, on the device only. It then shows and works like the built-in books, offline too once loaded.

## Home and book screens

- Home, top to bottom: search, books, starred, learned. Starred and Learned collapse by tapping their title; Learned starts collapsed.
- Search matches chapter and subtopic names in English or Spanish; inside a book it only searches that book.
- Chapters show as tiles, the same on home and in a book: word count, extra-material and download icons on one line. Star a chapter to keep it on home; tick it to mark it learned.
- Settings (gear on home): imported books and a colour theme (12 light and dark presets, default Paper) that applies everywhere at once.
- A book starts with a "Review all" tile: spaced repetition over the whole book.

## Flashcards

- Full screen, one background colour, nothing scrolls. The prompt language on top, the other below, picture above when there is one.
- Direction: Spanish → English (default) or English → Spanish, one setting for every chapter and mode, kept per profile.
- Audio (Spanish) plays once when a word appears; tapping anywhere replays it. Except in English → Spanish spaced repetition, where it waits for the reveal tap. Words without a recording are read out by the device's Spanish text-to-speech.
- Arrows and an audio icon hint at swiping and tapping; they don't do anything themselves.
- Nothing on the flashcard screen can be selected (no text selection or lookup pop-ups), so taps only replay, reveal or press buttons, and No/Yes always answer on the first tap.
- Tapping the big word (whichever language is on top) also copies it to the clipboard, to look it up elsewhere; "Copied" shows briefly. It still isn't selectable.
- Top bar: close, mode, direction, word list (jump to any word), extra material links when the chapter has them, position.
- Modes:
  - In order: swipe left/right for next/previous.
  - Random: same, shuffled.
  - Spaced repetition: see below.

## Spaced repetition

- Leitner-style Yes/No piles, like studying with physical cards.
- The card shows the prompt side; tap to reveal the other side, then answer No or Yes. No swiping.
- The picture would give the answer away in Spanish → English, so it appears with the English on reveal; in English → Spanish it shows from the start.
- Each direction is a separate deck: its own boxes, retired words, saved session and tile freshness bars. Progress from before directions counts as Spanish → English.
- A session runs in rounds, each shuffled. Round 1 is the whole session deck; every answer goes on a Yes or No pile. The next round is the latest No pile, until a round has no No. Then the words missed in round 1 are revised the same way until each gets a Yes. Yes words don't come back in that session. The round and pile sizes show during a session; when it's over, the session says so.
- An unfinished session resumes after closing or reloading, the same day only, once at least one card has been answered; an untouched one, or one saved by an older app version, is rebuilt with the current rules (word progress is kept).
- Signed in, sessions in progress (chapter sessions and the "Review all" state, per direction) sync across devices: start on the phone, carry on on the laptop. Opening a deck fetches its latest save, and the most recent save wins, including finishing a session elsewhere. Offline, the device's own copy is used. Guests keep sessions on the device.
- Leitner boxes: box n comes back every 2^(n-1) calendar days (box 7, every 64 days, is the top). A word's "how overdue" is the days since its last answer ÷ its box interval; 1 or more is due.
- Only a word's first answer of the day (in any session) moves its box; re-drills later that day don't. No → box 1. Yes → up one box, or further when it was remembered after a long gap (to the largest box whose interval fits the gap: box 2 last seen 10 days ago goes to box 4). A never-seen word goes to box 2 on Yes, box 1 on No.
- Chapter session: the chapter's (or subtopic's) due and box-1 words, most overdue first, then never-seen words in book order. A fresh chapter is the whole chapter; coming back the same day gives just the words answered No.
- Nothing due in a chapter: "All caught up", roughly when the next word is due, and two ways to study anyway: the ~20 shakiest words (lowest boxes, most overdue first) or the whole chapter.
- "Review all": one ongoing queue of every word already studied in the book (no new words), most overdue first, re-sorted each time it's opened; stop whenever. Yes takes a word out for today; No puts it on a No pile. At 10 words, or on tapping "Drill No pile", the pile is drilled in shuffled rounds until each word gets a Yes, then the queue carries on. The pile and progress through the queue survive leaving or reloading, the same day. When the queue runs out: "All caught up".
- The ✓ on the card retires a word: it's left out of every session. Retired words show ✓ in the word list; tapping restores them. Both apply to the current direction.
- No due counts on home or tiles. A chapter tile shows nothing until its words have been studied; after that a bar shows how fresh they are, full just after studying and shrinking until they're due.

## Profiles

- Optional name + PIN, not real security (the app says so). Each profile keeps its own stars, learned chapters, settings and word progress across devices; guests keep them on the device.

## Platforms

- Web app on GitHub Pages; Android APK on GitHub releases. Each APK version installs on its own or over an older one (v0.3.0 onwards; older versions need uninstalling once).
- The Android app can download a chapter's or book's audio and pictures for offline use.
