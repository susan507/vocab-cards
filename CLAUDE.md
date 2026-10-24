@AGENTS.md

# Vocab Cards

Spanish flashcards: Expo + Expo Router + TypeScript. Web first (static SPA on GitHub Pages under `/vocab-cards`), native app later from the same code. See README for the data layout.

## Rules

- The app reads only the `Book` format in `src/lib/types.ts`. Source-specific parsing belongs in `scripts/import/<source>.ts`, never in app code.
- Keep the source's word and chapter order exactly.
- Never commit audio (`*.mp3` is gitignored). Web streams `Word.audio` URLs; native will download them on-device.
- `Deck` takes a plain `Word[]`. Add new study modes (shuffle, multi-chapter, spaced repetition) as deck builders in `src/lib/books.ts`, not inside `Deck`.
- Start audio synchronously inside gesture/key handlers. Mobile browsers block playback that starts outside a user gesture.
- Web output is `single` (SPA), not `static`: `expo-audio` can't render on the server. `build:web` copies `index.html` to `404.html` so deep links work on Pages.
- `scripts/` has its own tsconfig with Node types. App code must not use Node APIs.
- Use an established open-source library before hand-rolling UI/interaction code (sn-app's stack is the reference: gesture-handler, reanimated, expo-file-system, async-storage). Add one only when it's actually needed.
- Before declaring work done: `npm run typecheck && npm run lint && npm test && npm run build:web`. Formatting is oxfmt (runs automatically on edit via the Claude hook; `npm run format`).
- Branch off `main` for features. `main` deploys automatically.

## Conventions (from sn-app / sn-web)

- `import type { X }` for type-only imports, as a separate top-level statement.
- No TypeScript `enum`s: use an UPPER_CASE `as const` object plus a same-named type.
- Prefer `type` over `interface`, `const` over `let`.
- Comments explain intent, invariants or non-obvious constraints, never history or what the code plainly says. Default to no comment.
