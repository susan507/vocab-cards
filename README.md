# Vocab Cards

Spanish vocabulary flashcards with audio. Pick a book, then a chapter or subtopic. Each card shows Spanish on top and English below.

- **Swipe left or right** (or press ← →) to go to the next or previous word
- **Tap** (or press Space) to replay the audio
- The audio plays once whenever a new word appears

Live site: https://susan507.github.io/vocab-cards/

## Stack

Expo (SDK 58), React Native, TypeScript and Expo Router. The same code runs on the web (react-native-web, exported as a static SPA) and later as the native iOS/Android app.

## Development

```sh
npm install
npm run web          # dev server in the browser
npm run typecheck
npm test             # importer tests
npm run build:web    # static build in dist/
```

Pushing to `main` runs CI: typecheck, test, build, then deploy to GitHub Pages.

## Android release APK

Built locally and attached to a GitHub release for sideloading.

1. Bump `version` in `app.json` (x.y.z). `app.config.ts` derives `android.versionCode` from it (`0.3.0` → `300`); Android only installs an update with a higher versionCode.
2. `npm run build:android` → `android/app/build/outputs/apk/release/app-release.apk` (arm64-v8a + armeabi-v7a, so 32-bit phones can install it too; about 15 MB bigger than arm64-only).
3. Rename it `vocab-cards-vX.Y.Z.apk` and attach it to the release.

Release APKs are signed with a dedicated keystore kept outside the repo, `~/.android/vocab-cards-release.jks`, configured in `~/.gradle/gradle.properties`:

```properties
VOCAB_CARDS_STORE_FILE=/Users/<you>/.android/vocab-cards-release.jks
VOCAB_CARDS_STORE_PASSWORD=...
VOCAB_CARDS_KEY_ALIAS=vocab-cards
VOCAB_CARDS_KEY_PASSWORD=...
```

Without these the build fails rather than produce an unsigned APK. Back up the keystore and passwords: every release must be signed with the same key, or Android refuses to update an installed copy ("App not installed" / signatures do not match). If the key is lost, users must uninstall once (losing local data) and install the new build. v0.1.0 and v0.2.0 were signed with React Native's public debug key, so anyone who has them must uninstall once before installing v0.3.0 or later.

Installing on a phone: open the downloaded APK, allow installs from the browser/Files app when asked, then at the Play Protect "App scan recommended" prompt choose **Scan app** (it reports "looks safe") and **Install**.

## Data

```
raw/                      captured source data, for sources that can't be fetched
scripts/import/<source>.ts  turns source data into a book JSON
src/data/books/*.json     generated books (committed; loaded lazily when a deck opens)
src/data/catalog.json     titles and word counts only, bundled eagerly (npm run catalog)
src/lib/types.ts          the Book → Chapter → Section → Word format
src/lib/books.ts          book registry, catalog, search and deck builders
```

The app only ever reads `Book` JSON (see `src/lib/types.ts`). Each word has a stable `id` (unique within its book; `wordKey` makes the global key), `es`, `en`, an optional `audio` URL and an optional `image` URL (shown above the Spanish). A chapter can list `links` to outside pages, opened from the deck's link button. Native offline downloads fetch both audio and images. Chapters keep the source's order. A chapter without subtopics has a single section with no title.

Audio is not committed. The web version streams it from the source URL, and the native app will download it on the device for offline use.

### Importing: Usborne First Thousand Words in Spanish

The Quicklinks page sits behind a Cloudflare check, so it's captured from a real browser:

1. Open the [Quicklinks page](https://usborne.com/gb/quicklinks/quicklink/first-thousand-words-in-spanish) and run this in the console:
   ```js
   copy(
     window.linksConfig.pages
       .flatMap(p => Object.values(p.lists))
       .filter(l => l.type === 'audiolinks')
       .flatMap(l => l.topics)
       .sort((a, b) => a.position - b.position)
       .map(
         t =>
           '#' +
           t.title +
           '\n' +
           t.links.map(k => k.url.split('/').pop().replace('.mp3', '') + '|' + k.title).join('\n'),
       )
       .join('\n'),
   );
   ```
2. Paste the result into `raw/usborne-ftw-es.txt`, below the `# ` header comment lines.
3. Run `npm run import:usborne`.

Fixes for source typos live in `FIXES` in `scripts/import/usborne.ts`.

### Importing: DK Illustrated Dictionary (Spanish)

Run `npm run import:dk`. It fetches the Spanish and English `content.json` behind the [DK audio app](https://apps.dk.com/idic/en/audio/es) and joins them by unit and exercise number. Each DK unit becomes a section, and its heading (exercise 0) is also the section's first card. Fixes for misnumbered or blank English entries live in `FIXES` in `scripts/import/dk.ts`.

### Importing: Gente Hoy 1 (SpanishDict)

Run `npm run import:gente`. It reads the `window.SD_COMPONENT_DATA` JSON embedded in the [textbook page](https://www.spanishdict.com/textbooks/26) and each unit's vocabulary list pages. Each unit becomes a chapter, its vocabulary lists become sections (newest first, as the site shows them), and its "Topics" become the chapter's `links`. Word ids are SpanishDict's vocab list entry ids. Images whose URL no longer loads are dropped. Fixes for wrong articles or senses live in `FIXES` in `scripts/import/gente.ts`.

### Importing: Gente al día 1 (private)

The source is a copyrighted glossary PDF from a paid Campus Difusión account, so the book is never committed or bundled. Run `npm run import:gente-al-dia -- <path to gad1_isbk_glos_EN.pdf>` (needs poppler's `pdftohtml`). It writes `private/gente-al-dia-1.json` (gitignored) with one chapter per unit, each word under its lowest unit tag, and prints per-unit counts and any lines it couldn't parse. Import that file in the app's Settings. Tests use invented entries only.

### Adding a new source

Write `scripts/import/<source>.ts` that outputs a `Book` to `src/data/books/<id>.json` and calls `writeCatalog()`, then add a loader to `LOADERS` in `src/lib/books.ts`. On the web each book is a separate chunk fetched when a deck opens; native bundles them all for offline use. `npm test` fails if `catalog.json` is out of date with the book files.

## Profiles backend

Profiles are a name and PIN, not real security. The app signs in with Supabase Auth using `<name>@vocab-cards.local` and a password derived from the PIN. `supabase/migrations/` creates `profiles` (filled by a trigger on sign-up), `topic_marks`, `word_progress` and `private_books` (imported book files, one JSON per user and book). Row level security lets each signed-in user touch only their own rows, and `anon` gets no table access.

- **Apply:** the Supabase GitHub integration runs new migrations when they merge to `main`. To apply by hand, paste the migration into the SQL editor or run `psql "<connection string>" -f supabase/migrations/<file>.sql`.
- **Dashboard step:** in Authentication → Providers → Email, turn off "Confirm email".
- **Test:** `npm run test:db` applies the migrations to a temporary local Postgres with a stub `auth` schema and checks the access rules. It needs `initdb`, `pg_ctl` and `psql` on the PATH, and it isn't part of `npm test`.

## Roadmap

- Native app with offline audio (downloaded with `expo-file-system`)
- Spaced repetition: mark each word as known or unknown
- Review modes: shuffle, and pick one, several or all chapters. The card screen already takes a plain `Word[]` deck, so these only need new deck builders.
