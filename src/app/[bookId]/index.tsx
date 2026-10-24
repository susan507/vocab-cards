import { Stack, useLocalSearchParams } from 'expo-router';
import { Fragment } from 'react';
import { ScrollView } from 'react-native';
import { ListRow } from '@/components/ListRow';
import { getBook } from '@/lib/books';

export default function ChaptersScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const book = getBook(bookId);
  if (!book) return null;
  return (
    <ScrollView>
      <Stack.Screen options={{ title: book.title }} />
      {book.chapters.map((chapter, c) => {
        const count = chapter.sections.reduce((n, s) => n + s.words.length, 0);
        return (
          <Fragment key={c}>
            <ListRow href={`/${book.id}/${c}`} title={chapter.title} subtitle={`${count} words`} />
            {chapter.sections.length > 1 &&
              chapter.sections.map((section, s) => (
                <ListRow
                  key={s}
                  indent
                  href={`/${book.id}/${c}?section=${s}`}
                  title={section.title ?? `Part ${s + 1}`}
                />
              ))}
          </Fragment>
        );
      })}
    </ScrollView>
  );
}
