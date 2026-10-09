import { isRed, SUIT_SYMBOL, type Card as CardT } from '../../core/cards';

const FACE: Record<string, string> = { J: 'J', Q: 'Q', K: 'K' };

export function FrenchFace({ card }: { card: CardT }) {
  const color = isRed(card.suit) ? 'var(--suit-red)' : 'var(--suit-black)';
  const sym = SUIT_SYMBOL[card.suit];
  const court = FACE[card.rank];
  return (
    <svg viewBox="0 0 60 84" aria-hidden="true">
      <rect x="0.5" y="0.5" width="59" height="83" rx="5" fill="var(--card-face)" stroke="var(--card-edge)" />
      <g fill={color} fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700">
        <text x="5" y="16" fontSize="14">{card.rank}</text>
        <text x="5.5" y="28" fontSize="12">{sym}</text>
        <g transform="rotate(180 30 42)">
          <text x="5" y="16" fontSize="14">{card.rank}</text>
          <text x="5.5" y="28" fontSize="12">{sym}</text>
        </g>
        {court ? (
          <>
            <rect x="15" y="16" width="30" height="52" rx="3" fill="none" stroke={color} strokeWidth="1.2" />
            <text x="30" y="40" fontSize="18" textAnchor="middle">{court}</text>
            <text x="30" y="60" fontSize="16" textAnchor="middle">{sym}</text>
          </>
        ) : (
          <text x="30" y="52" fontSize="30" textAnchor="middle">{sym}</text>
        )}
      </g>
    </svg>
  );
}

/** Diagonal lattice lines clipped to a rectangle, computed once (no <clipPath>/<pattern>: ids would collide). */
function lattice(x0: number, y0: number, x1: number, y1: number, step: number): string {
  const segs: string[] = [];
  const clip = (pts: [number, number][]) => pts.filter(([x, y]) => x >= x0 - 1e-6 && x <= x1 + 1e-6 && y >= y0 - 1e-6 && y <= y1 + 1e-6);
  for (const dir of [1, -1]) {
    for (let c = -(x1 - x0) - (y1 - y0); c <= (x1 - x0) + (y1 - y0); c += step) {
      // y - y0 = dir * (x - x0) + c, intersected with the four edges
      const at = (x: number) => y0 + dir * (x - x0) + c;
      const xAt = (y: number) => x0 + (y - y0 - c) / dir;
      const pts = clip([[x0, at(x0)], [x1, at(x1)], [xAt(y0), y0], [xAt(y1), y1]]);
      if (pts.length >= 2) segs.push(`M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}L${pts[1][0].toFixed(2)} ${pts[1][1].toFixed(2)}`);
    }
  }
  return segs.join('');
}

const LATTICE = lattice(7, 7, 53, 77, 6);

export function CardBack() {
  // No <defs>/patterns: ids would collide and break when the first instance is hidden.
  return (
    <svg viewBox="0 0 60 84" aria-hidden="true">
      <rect x="0.5" y="0.5" width="59" height="83" rx="5" fill="var(--card-face)" stroke="var(--card-edge)" />
      <rect x="4" y="4" width="52" height="76" rx="3" fill="var(--card-back)" />
      <path d={LATTICE} stroke="var(--card-back-line)" strokeWidth="0.6" fill="none" />
      <rect x="6" y="6" width="48" height="72" rx="2" fill="none" stroke="var(--card-back-line)" strokeWidth="1.2" />
      <ellipse cx="30" cy="42" rx="12" ry="15" fill="var(--card-back)" stroke="var(--card-back-line)" strokeWidth="1.2" />
      <path d="M30 31 C34 36 38 38 38 43 a4.2 4.2 0 0 1 -8 1.8 a4.2 4.2 0 0 1 -8 -1.8 C22 38 26 36 30 31Z" fill="var(--card-back-line)" />
      <path d="M30 44 V52 M27 52 H33" stroke="var(--card-back-line)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
