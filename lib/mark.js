// The 8-bit brand character, drawn on an 8x8 pixel grid. Copied from
// src/lib/mark.ts in the clairn marketing site; keep the two grids identical,
// along with app/icon.svg (a static copy of the same shape).

// `X` is a lit pixel; anything else is empty.
export const MARK_GRID = [
  '..XXXX..',
  '.XXXXXX.',
  'XXXXXXXX',
  'XX.XX.XX',
  'XXXXXXXX',
  'XXX..XXX',
  '.XXXXXX.',
  'XX....XX',
];

// The grid is square, so this is both the column and the row count.
export const MARK_CELLS = MARK_GRID.length;

// Horizontal runs of lit pixels, so the mark is 12 rectangles instead of 48.
const MARK_RUNS = MARK_GRID.flatMap((line, row) => {
  const runs = [];
  for (let col = 0; col < line.length; col += 1) {
    if (line[col] !== 'X') continue;
    const start = col;
    while (line[col + 1] === 'X') col += 1;
    runs.push({ col: start, row, length: col - start + 1 });
  }
  return runs;
});

// The character as one path, one subpath per run. A single path rasterizes as
// one shape, so there are no antialiasing seams where two runs meet.
export function markPath(cell) {
  return MARK_RUNS.map(({ col, row, length }) => {
    const width = length * cell;
    return `M${col * cell} ${row * cell}h${width}v${cell}h${-width}z`;
  }).join('');
}
