// run: bun src/features/board/lib/board-layout.check.ts
import assert from 'node:assert/strict';
import { layoutBoard } from './board-layout';

const notes = Array.from({ length: 11 }, (_, i) => ({ id: `n${i}`, height: 90 + ((i * 37) % 80) }));

for (const width of [280, 320, 350, 760, 1072]) {
  const tidy = layoutBoard(notes, width, 'tidy');
  const scatter = layoutBoard(notes, width, 'scatter');
  assert.equal(tidy.places.size, notes.length);
  assert.equal(scatter.places.size, notes.length);

  for (const layout of [tidy, scatter]) {
    for (const place of layout.places.values()) {
      assert.ok(place.x >= 0 && place.x + layout.noteWidth <= width, `x in bounds at ${width}`);
      assert.ok(place.y >= 0 && place.y < layout.height, `y in bounds at ${width}`);
    }
  }

  // tidy never overlaps within a column
  const byColumn = new Map<number, { y: number; h: number }[]>();
  for (const note of notes) {
    const place = tidy.places.get(note.id)!;
    assert.equal(place.r, 0);
    const column = byColumn.get(place.x) ?? [];
    column.push({ y: place.y, h: note.height });
    byColumn.set(place.x, column);
  }
  for (const column of byColumn.values()) {
    column.sort((a, b) => a.y - b.y);
    for (let i = 1; i < column.length; i++) {
      assert.ok(column[i].y >= column[i - 1].y + column[i - 1].h, `tidy overlap at ${width}`);
    }
  }

  // same input, same mess
  assert.deepEqual(layoutBoard(notes, width, 'scatter'), scatter);
}

// phones get two columns
assert.equal(new Set([...layoutBoard(notes, 342, 'tidy').places.values()].map((p) => p.x)).size, 2);

console.log('board layout ok');
