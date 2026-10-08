import type { Card as CardT, Suit } from '../../core/cards';

/** Hungarian-pattern suits paired with the French ones the engine uses (hearts, bells, acorns, leaves). */
export const HUNGARIAN_SUIT_NAME: Record<Suit, string> = {
  hearts: 'Srce',
  diamonds: 'Zvono',
  clubs: 'Žir',
  spades: 'Zelje',
};

const INK: Record<Suit, string> = { hearts: '#c23a2e', diamonds: '#c9821a', clubs: '#6b4a1e', spades: '#2f7d3f' };

/** Suit emblem on a 24x24 grid. */
export function Emblem({ suit, className, x = 0, y = 0, size = 24 }: { suit: Suit; className?: string; x?: number; y?: number; size?: number }) {
  const ink = INK[suit];
  const body = {
    hearts: <path d="M12 21C5 15 2 11.5 2 8a5 5 0 0 1 10-1.5A5 5 0 0 1 22 8c0 3.5-3 7-10 13z" fill={ink} />,
    diamonds: (
      <>
        <path d="M12 2.5a2 2 0 0 1 2 2v.6c3 1 5 4 5 7.4v3l2 2.5H3L5 15.5v-3c0-3.4 2-6.4 5-7.4v-.6a2 2 0 0 1 2-2z" fill={ink} />
        <circle cx="12" cy="20.5" r="2.2" fill={ink} />
        <path d="M8 13c0-2.5 1.2-4.5 3-5.3" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </>
    ),
    clubs: (
      <>
        <path d="M12 22C8 20 6.5 16.5 6.5 12.5h11c0 4-1.5 7.5-5.5 9.5z" fill={ink} />
        <path d="M4.5 12.5C4.5 8 8 5.2 12 5.2s7.5 2.8 7.5 7.3z" fill={ink} fillOpacity="0.72" />
        <path d="M12 5.2V2" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    spades: (
      <>
        <path d="M12 2C6 7 4 12 5.5 16.5 7 20 10 21.5 12 22c2-.5 5-2 6.5-5.5C20 12 18 7 12 2z" fill={ink} />
        <path d="M12 6v15" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.2" />
      </>
    ),
  }[suit];
  return (
    <svg className={className} x={x} y={y} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {body}
    </svg>
  );
}

const LABEL: Record<string, string> = { J: 'D', Q: 'G', K: 'K', A: 'A' }; // Dolnik, Gornjak, Kralj, As

const COL_L = 21;
const COL_R = 39;
const PIPS: Record<string, [number, number][]> = {
  '7': [[COL_L, 22], [COL_L, 42], [COL_L, 62], [COL_R, 22], [COL_R, 42], [COL_R, 62], [30, 32]],
  '8': [[COL_L, 22], [COL_L, 42], [COL_L, 62], [COL_R, 22], [COL_R, 42], [COL_R, 62], [30, 32], [30, 52]],
  '9': [[COL_L, 20], [COL_L, 34], [COL_L, 50], [COL_L, 64], [COL_R, 20], [COL_R, 34], [COL_R, 50], [COL_R, 64], [30, 42]],
  '10': [[COL_L, 20], [COL_L, 34], [COL_L, 50], [COL_L, 64], [COL_R, 20], [COL_R, 34], [COL_R, 50], [COL_R, 64], [30, 27], [30, 57]],
};

export function HungarianFace({ card }: { card: CardT }) {
  const { suit, rank } = card;
  const ink = INK[suit];
  const label = LABEL[rank] ?? rank;
  const pips = PIPS[rank];
  return (
    <svg viewBox="0 0 60 84" aria-hidden="true">
      <rect x="0.5" y="0.5" width="59" height="83" rx="5" fill="var(--card-face)" stroke="var(--card-edge)" />
      <g fill={ink} fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700">
        <text x="5" y="15" fontSize="13">{label}</text>
        <Emblem suit={suit} x={4} y={17} size={11} />
        <g transform="rotate(180 30 42)">
          <text x="5" y="15" fontSize="13">{label}</text>
          <Emblem suit={suit} x={4} y={17} size={11} />
        </g>
      </g>
      {pips ? (
        pips.map(([cx, cy], i) => <Emblem key={i} suit={suit} x={cx - 6.5} y={cy - 6.5} size={13} />)
      ) : rank === 'A' ? (
        <Emblem suit={suit} x={14} y={27} size={32} />
      ) : (
        <g>
          <rect x="15" y="16" width="30" height="52" rx="3" fill={ink} fillOpacity="0.1" stroke={ink} strokeWidth="1.2" />
          {rank === 'K' && <path d="M20 29l3-8 4 5 3-7 3 7 4-5 3 8z" fill={ink} />}
          <text x="30" y={rank === 'K' ? 46 : 38} fontSize="18" textAnchor="middle" fill={ink} fontFamily="Georgia, serif" fontWeight="700">{label}</text>
          <Emblem suit={suit} x={19} y={rank === 'K' ? 47 : 40} size={22} />
        </g>
      )}
    </svg>
  );
}
