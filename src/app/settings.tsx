import * as DocumentPicker from 'expo-document-picker';
import { File as FsFile } from 'expo-file-system';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTileStyles } from '@/components/Tile';
import { isBundled, parseBook, useBooks } from '@/lib/books';
import { importBook, removeImportedBook, useProfile } from '@/lib/prefs';
import { makeStyles, THEMES, useThemeChoice } from '@/theme';

export default function SettingsScreen() {
  const { theme: current, set: setTheme } = useThemeChoice();
  const styles = useStyles();
  const tileStyles = useTileStyles();
  return (
    <ScrollView contentContainerStyle={[tileStyles.screen, styles.form]}>
      <ImportedBooks />
      <Text style={[styles.label, styles.section]}>Theme</Text>
      <View style={styles.swatches} accessibilityRole="radiogroup">
        {THEMES.map(t => {
          const selected = t === current;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="radio"
              accessibilityLabel={t.name}
              accessibilityState={{ checked: selected }}
              onPress={() => setTheme(t)}
              style={({ pressed }) => [
                styles.swatch,
                { backgroundColor: t.bg, borderColor: selected ? current.accent : t.border },
                selected && styles.selected,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.chip, { backgroundColor: t.surface, borderColor: t.border }]}>
                <View style={[styles.dot, { backgroundColor: t.accent }]} />
              </View>
              <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                {selected ? '✓ ' : ''}
                {t.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/** Reads a picked file's text; `null` when the picker was cancelled. */
async function pickTextFile() {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  // The web picker hands over a browser File; native gives a file URI.
  return asset.file ? asset.file.text() : new FsFile(asset.uri).text();
}

/** Books imported from a file: saved to the profile when signed in, otherwise on this device only. */
function ImportedBooks() {
  const profile = useProfile();
  const imported = useBooks().filter(b => !isBundled(b.id));
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const styles = useStyles();
  const run = async (action: () => Promise<string | null | undefined>) => {
    setBusy(true);
    try {
      setMessage((await action()) ?? undefined);
    } catch (e) {
      setMessage(`Couldn’t read the file: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  const onImport = () =>
    run(async () => {
      const text = await pickTextFile();
      if (text === null || profile === undefined) return undefined;
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return 'That file isn’t JSON.';
      }
      const book = parseBook(json);
      if (typeof book === 'string') return book;
      return (await importBook(profile, book)) ?? `Imported “${book.title}”.`;
    });
  return (
    <>
      <Text style={styles.label}>Imported books</Text>
      {imported.map(b => (
        <View key={b.id} style={styles.bookRow}>
          <Text style={styles.bookTitle} numberOfLines={1}>
            {b.title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${b.title}`}
            disabled={busy}
            onPress={() => run(() => removeImportedBook(profile ?? null, b.id))}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.danger}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        disabled={busy || profile === undefined}
        onPress={onImport}
        style={({ pressed }) => [styles.button, styles.importButton, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Import a book file</Text>
      </Pressable>
      {message ? <Text style={styles.note}>{message}</Text> : null}
      <Text style={styles.note}>
        A book JSON file made by one of the import scripts.{' '}
        {profile
          ? `It’s saved privately to ${profile.name}.`
          : 'As a guest it stays on this device; sign in to keep it with your profile.'}
      </Text>
    </>
  );
}

const useStyles = makeStyles(theme => ({
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bookTitle: { flex: 1, color: theme.text, fontSize: 15 },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  importButton: { alignSelf: 'flex-start' },
  buttonText: { color: theme.text, fontSize: 15 },
  danger: { color: theme.danger, fontSize: 15 },
  form: { gap: 12, maxWidth: 420 },
  label: { color: theme.text, fontSize: 15, fontWeight: '600' },
  section: { marginTop: 12 },
  note: { color: theme.muted, fontSize: 13 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 104, padding: 8, gap: 6, borderRadius: 10, borderWidth: 1 },
  selected: { borderWidth: 2, padding: 7 },
  pressed: { opacity: 0.6 },
  chip: {
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { fontSize: 12, fontWeight: '600' },
}));
