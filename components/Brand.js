import { MARK_CELLS, markPath } from '@/lib/mark';

// One unit per pixel, so the glyph stays sharp at any size that is a multiple
// of 8px. Size it with CSS.
const PATH = markPath(1);

export function MarkGlyph({ className }) {
  return (
    <svg
      viewBox={`0 0 ${MARK_CELLS} ${MARK_CELLS}`}
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
      className={className ? `markGlyph ${className}` : 'markGlyph'}
    >
      <path d={PATH} />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <MarkGlyph />
      Clairn
    </span>
  );
}
