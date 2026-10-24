import { ScrollView } from 'react-native';
import { ListRow } from '@/components/ListRow';
import { BOOKS } from '@/lib/books';

export default function BooksScreen() {
  return (
    <ScrollView>
      {BOOKS.map(book => (
        <ListRow
          key={book.id}
          href={`/${book.id}`}
          title={book.title}
          subtitle={book.source.name}
        />
      ))}
    </ScrollView>
  );
}
