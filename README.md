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

## Data

```
raw/                      captured source data, for sources that can't be fetched
scripts/import/<source>.ts  turns source data into a book JSON
src/data/books/*.json     generated books (committed; loaded lazily when a deck opens)
src/data/catalog.json     titles and word counts only, bundled eagerly (npm run catalog)
src/lib/types.ts          the Book → Chapter → Section → Word format
src/lib/books.ts          book registry, catalog, search and deck builders
```

The app only ever reads `Book` JSON (see `src/lib/types.ts`). Each word has `es`, `en`, an optional `audio` URL and an optional `image`. Chapters keep the source's order. A chapter without subtopics has a single section with no title.

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

### Adding a new source

Write `scripts/import/<source>.ts` that outputs a `Book` to `src/data/books/<id>.json` and calls `writeCatalog()`, then add a loader to `LOADERS` in `src/lib/books.ts`. On the web each book is a separate chunk fetched when a deck opens; native bundles them all for offline use. `npm test` fails if `catalog.json` is out of date with the book files.

## Profiles backend

Profiles are a name and PIN, not real security. The app signs in with Supabase Auth using `<name>@vocab-cards.local` and a password derived from the PIN. `supabase/migrations/` creates `profiles` (filled by a trigger on sign-up), `topic_marks` and `word_progress`. Row level security lets each signed-in user touch only their own rows, and `anon` gets no table access.

- **Apply:** the Supabase GitHub integration runs new migrations when they merge to `main`. To apply by hand, paste the migration into the SQL editor or run `psql "<connection string>" -f supabase/migrations/<file>.sql`.
- **Dashboard step:** in Authentication → Providers → Email, turn off "Confirm email".
- **Test:** `npm run test:db` applies the migrations to a temporary local Postgres with a stub `auth` schema and checks the access rules. It needs `initdb`, `pg_ctl` and `psql` on the PATH, and it isn't part of `npm test`.

## Roadmap

- Native app with offline audio (downloaded with `expo-file-system`)
- Spaced repetition: mark each word as known or unknown
- Review modes: shuffle, and pick one, several or all chapters. The card screen already takes a plain `Word[]` deck, so these only need new deck builders.
- Images on cards (`Word.image` is already rendered when present)
