import type { Card as CardT, Suit } from '../../core/cards';

/*
 * The Hungarian ("Tell") pattern as sold in Croatia as mađarice: double-headed, Roman numerals,
 * Obers and Unters showing characters from Schiller's Wilhelm Tell, Kings on horseback and the
 * four seasons on the Aces. Redrawn here; no <defs>/ids, since several cards share a page.
 */

/** Hungarian-pattern suits paired with the French ones the engine uses (hearts, bells, acorns, leaves). */
export const HUNGARIAN_SUIT_NAME: Record<Suit, string> = {
  hearts: 'Srce',
  diamonds: 'Zvono',
  clubs: 'Žir',
  spades: 'Zelje',
};

const LINE = '#3b2a1a';
const SKIN = '#f2d3b3';

/** Suit emblem on a 24x24 grid. */
export function Emblem({ suit, className, x = 0, y = 0, size = 24 }: { suit: Suit; className?: string; x?: number; y?: number; size?: number }) {
  const body = {
    hearts: (
      <>
        <path d="M12 21.5C5 15.8 1.8 12 1.8 7.9a5.1 5.1 0 0 1 10.2-1.6 5.1 5.1 0 0 1 10.2 1.6c0 4.1-3.2 7.9-10.2 13.6z" fill="#d23224" stroke="#7d1810" strokeWidth="0.9" />
        <path d="M5 7.6a2.6 2.6 0 0 1 3.4-2.2" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </>
    ),
    diamonds: (
      <>
        <path d="M12 3.6c-4 0-6.3 3.4-6.3 7.4v3.6L3.3 18h17.4l-2.4-3.4V11c0-4-2.3-7.4-6.3-7.4z" fill="#f0bd2c" stroke="#7a4a0c" strokeWidth="0.9" />
        <path d="M5.7 14.6h12.6l1.8 2.6H3.9z" fill="#c8361f" />
        <circle cx="12" cy="2.7" r="1.3" fill="#f0bd2c" stroke="#7a4a0c" strokeWidth="0.7" />
        <circle cx="12" cy="20.3" r="2" fill="#c8361f" stroke="#7a4a0c" strokeWidth="0.7" />
        <path d="M8.6 12.6c0-2.6 1-4.6 2.8-5.6" stroke="#fff" strokeOpacity="0.75" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </>
    ),
    clubs: (
      <>
        <path d="M12 23c-3.9-1.6-5.6-5.2-5.4-9.6h10.8c.2 4.4-1.5 8-5.4 9.6z" fill="#d79a35" stroke="#6b3d12" strokeWidth="0.9" />
        <path d="M9 15.2c.2 2.6 1.1 4.6 2.6 5.8" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        <path d="M4.4 13.8C4.4 9.2 7.7 6.4 12 6.4s7.6 2.8 7.6 7.4z" fill="#7a4a1f" stroke="#3f230b" strokeWidth="0.9" />
        <path d="M7 11.2h10M6 12.9h12M9 8.9l1 4.4M12 7v6.4M15 8.9l-1 4.4" stroke="#3f230b" strokeWidth="0.55" />
        <path d="M12 6.4c0-2 .6-3.6 2.2-4.8" stroke="#3f230b" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </>
    ),
    spades: (
      <>
        <path d="M12 1.5C6.3 6 3.8 11.2 5.2 15.8c1.3 3.9 4.4 5.6 6.8 6 2.4-.4 5.5-2.1 6.8-6C20.2 11.2 17.7 6 12 1.5z" fill="#3d9142" stroke="#174d1d" strokeWidth="0.9" />
        <path d="M12 4.5v19M12 9l-3.4-2.4M12 9l3.4-2.4M12 13l-4.6-3M12 13l4.6-3M12 17l-4.6-2.8M12 17l4.6-2.8" stroke="#174d1d" strokeWidth="0.7" fill="none" strokeLinecap="round" />
      </>
    ),
  }[suit];
  return (
    <svg className={className} x={x} y={y} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {body}
    </svg>
  );
}

/** An emblem centred on (cx, cy). */
function Pip({ suit, cx, cy, size }: { suit: Suit; cx: number; cy: number; size: number }) {
  return <Emblem suit={suit} x={cx - size / 2} y={cy - size / 2} size={size} />;
}

/* ---------- Figures ---------- */

type Hat = 'feather' | 'plume' | 'beret' | 'hood' | 'helmet' | 'crown' | 'fur' | 'kerchief';
type Prop = 'crossbow' | 'sword' | 'crook' | 'spear' | 'halberd' | 'staff' | 'horn' | 'sceptre' | 'flowers' | 'scythe';

interface Figure {
  coat: string;
  trim: string;
  hat: Hat;
  hatColor: string;
  hair: string;
  beard?: 'short' | 'full';
  prop?: Prop;
}

/** Half-length figure for the upper half of a card, standing on y=38. */
function Bust({ f }: { f: Figure }) {
  const propSide = f.prop === 'crook' || f.prop === 'staff' || f.prop === 'flowers' ? 19 : 41;
  return (
    <g stroke={LINE} strokeWidth="0.6" strokeLinejoin="round">
      {f.prop && <PropBack prop={f.prop} x={propSide} />}
      <path d="M14.5 38C14.5 28.5 21 23.6 30 23.6S45.5 28.5 45.5 38z" fill={f.coat} />
      <path d="M28.5 24h3v14h-3z" fill={f.trim} />
      <path d="M15.8 32.6h28.4l.6 2.2H15.2z" fill={f.trim} />
      <path d="M24.4 23.9q5.6 4.8 11.2 0-5.6 2.6-11.2 0z" fill="#fbf7ee" />
      <path d="M28.4 18.5h3.2v5.6h-3.2z" fill={SKIN} />
      <ellipse cx="30" cy="15.4" rx="4.2" ry="4.7" fill={SKIN} />
      <path d="M25.8 15.2c-.4-3.6 1.4-5.4 4.2-5.4s4.6 1.8 4.2 5.4c-.6-1.8-1.4-2.6-1.8-3-1 .6-3.8.6-4.8 0-.4.4-1.2 1.2-1.8 3z" fill={f.hair} />
      <circle cx="28.4" cy="15.2" r="0.45" fill={LINE} stroke="none" />
      <circle cx="31.6" cy="15.2" r="0.45" fill={LINE} stroke="none" />
      {f.beard === 'short' && <path d="M26 16.6q.4 5 4 5.3 3.6-.3 4-5.3-1.8 2.4-4 2.4t-4-2.4z" fill={f.hair} />}
      {f.beard === 'full' && <path d="M25.9 16.2q-.2 8.2 4.1 9.2 4.3-1 4.1-9.2-1.8 2.8-4.1 2.8t-4.1-2.8z" fill={f.hair} />}
      {!f.beard && <path d="M29 18.2q1 .7 2 0" fill="none" strokeWidth="0.45" />}
      <HatShape hat={f.hat} color={f.hatColor} />
      {f.prop && <PropFront prop={f.prop} x={propSide} />}
    </g>
  );
}

function HatShape({ hat, color }: { hat: Hat; color: string }) {
  switch (hat) {
    case 'feather':
      return (
        <>
          <path d="M33 9.5c2.4-3.6 5.6-5.8 8.6-6.2-1.6 2.6-4.4 5-7.6 6.8z" fill="#f4f0e4" />
          <path d="M26 11.2q0-5 4-5.2t4 5.2z" fill={color} />
          <ellipse cx="30" cy="11.3" rx="6.8" ry="1.4" fill={color} />
        </>
      );
    case 'plume':
      return (
        <>
          <path d="M30 6c-1-3.4 3-5.4 6.4-4.4-1 1.6-.4 2.6-2.4 3.2 1.4.8.4 2.2-1.2 2.4z" fill="#d23224" />
          <path d="M25.5 11.5q-.4-6 4.5-6.2t4.5 6.2z" fill={color} />
          <path d="M24.6 11.4h10.8v1.4H24.6z" fill="#e3b43b" />
        </>
      );
    case 'beret':
      return (
        <>
          <path d="M24 11q.6-4.6 6.6-4.8 5.8.2 7.2 3.8-1.2 1.8-6.8 2z" fill={color} />
          <path d="M34.6 7.4c2-2 4.4-2.8 6.4-2.6-1.6 1.6-3.6 3-5.6 3.4z" fill="#f4f0e4" />
        </>
      );
    case 'hood':
      return <path d="M24.6 19.6c-1.4-6.6.6-12.2 5.4-12.2s6.8 5.6 5.4 12.2l-1.2-5c-.6-2.4-2-3.2-4.2-3.2s-3.6.8-4.2 3.2z" fill={color} />;
    case 'helmet':
      return (
        <>
          <path d="M25.4 12.6q-.4-6.4 4.6-6.6t4.6 6.6z" fill="#b9bec4" />
          <path d="M26.8 6.8q3.2-3.4 6.4 0" fill="none" stroke="#d23224" strokeWidth="1.4" />
          <path d="M24.6 12.4h10.8v1.2H24.6z" fill="#8c939b" />
        </>
      );
    case 'crown':
      return (
        <>
          <path d="M25.6 11.6l-.6-5.4 2.4 2.2L30 4.8l2.6 3.6 2.4-2.2-.6 5.4z" fill="#f0bd2c" />
          <path d="M25.6 10.6h8.8v1.4h-8.8z" fill="#d23224" />
        </>
      );
    case 'fur':
      return (
        <>
          <path d="M26 11q-.2-5.6 4-5.8t4 5.8z" fill={color} />
          <path d="M25 10.4h10v2.4H25z" fill="#d9cdb6" />
        </>
      );
    case 'kerchief':
      return <path d="M25.4 14c-.6-4.8 1.4-7.2 4.6-7.2s5.2 2.4 4.6 7.2c-1-2.2-2.6-3.2-4.6-3.2s-3.6 1-4.6 3.2zM34.4 12.6l3 4.4-2.4.2z" fill={color} />;
  }
}

/** The part of a held item that goes behind the figure. */
function PropBack({ prop, x }: { prop: Prop; x: number }) {
  switch (prop) {
    case 'spear':
      return (
        <>
          <path d={`M${x} 38V6`} stroke="#7a4a1f" strokeWidth="1.1" />
          <path d={`M${x} 1.5l1.4 5h-2.8z`} fill="#b9bec4" />
        </>
      );
    case 'halberd':
      return (
        <>
          <path d={`M${x} 38V5`} stroke="#7a4a1f" strokeWidth="1.1" />
          <path d={`M${x} 1.5l1 4h-2zM${x} 6.5h3.6q.8 2.6-.4 5H${x}z`} fill="#b9bec4" />
        </>
      );
    case 'crook':
    case 'staff':
      return (
        <>
          <path d={`M${x} 38V${prop === 'crook' ? 9 : 7}`} stroke="#7a4a1f" strokeWidth="1.1" fill="none" />
          {prop === 'crook' && <path d={`M${x} 9q0-4 -3-4t-3 3`} stroke="#7a4a1f" strokeWidth="1.1" fill="none" />}
        </>
      );
    case 'scythe':
      return (
        <>
          <path d={`M${x} 38L${x - 2} 4`} stroke="#7a4a1f" strokeWidth="1.1" />
          <path d={`M${x - 2} 4q8-1.8 11 4.6-4.6-3-11-2.4z`} fill="#b9bec4" />
        </>
      );
    default:
      return null;
  }
}

/** The part of a held item (and the hand holding it) in front of the figure. */
function PropFront({ prop, x }: { prop: Prop; x: number }) {
  const hand = <circle cx={x} cy="30" r="1.6" fill={SKIN} />;
  switch (prop) {
    case 'crossbow':
      return (
        <>
          <path d="M37 35.5L45.5 13" stroke="#7a4a1f" strokeWidth="1.6" />
          <path d="M39.4 11.2q5.6-.4 9 4.6" stroke="#5a3a1a" strokeWidth="1.1" fill="none" />
          <path d="M39.4 11.2L48.4 15.8" stroke="#ddd" strokeWidth="0.35" />
          <circle cx="41" cy="25" r="1.6" fill={SKIN} />
        </>
      );
    case 'sword':
      return (
        <>
          <path d={`M${x} 28V8`} stroke="#dfe3e6" strokeWidth="1.3" />
          <path d={`M${x - 3} 28.2h6`} stroke="#c9952a" strokeWidth="1.2" />
          {hand}
        </>
      );
    case 'sceptre':
      return (
        <>
          <path d={`M${x} 31V14`} stroke="#c9952a" strokeWidth="1.1" />
          <circle cx={x} cy="13" r="1.5" fill="#f0bd2c" />
          {hand}
        </>
      );
    case 'horn':
      return (
        <>
          <path d="M22 29q8 5 16-3l2.2 1.4q-1.2-3.2-1.2-5-1.8 1.6-3.4 2.6-7 5.6-13.6 2.6z" fill="#f4e7c4" />
          {hand}
        </>
      );
    case 'flowers':
      return (
        <>
          <path d={`M${x} 30l-2-8M${x} 30l0-9M${x} 30l2-8`} stroke="#3d9142" strokeWidth="0.6" />
          <circle cx={x - 2} cy="21.5" r="1.4" fill="#e86a8c" />
          <circle cx={x} cy="20.4" r="1.4" fill="#f0bd2c" />
          <circle cx={x + 2} cy="21.5" r="1.4" fill="#d23224" />
          {hand}
        </>
      );
    default:
      return hand;
  }
}

/* ---------- Card parts ---------- */

/** Ribbon across the middle of each half, carrying a name. */
function Banner({ text, color }: { text: string; color: string }) {
  return (
    <>
      <path d="M7.5 37.6h45l-2 2 2 2h-45l2-2z" fill={color} stroke={LINE} strokeWidth="0.45" />
      <text x="30" y="40.9" fontSize="3.3" textAnchor="middle" fill="#fff" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" letterSpacing="0.15">
        {text}
      </text>
    </>
  );
}

/** Draws the upper half, then the same half turned for the lower one. */
function DoubleHeaded({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <g transform="rotate(180 30 42)">{children}</g>
    </>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 60 84" aria-hidden="true">
      <rect x="0.5" y="0.5" width="59" height="83" rx="5" fill="var(--card-face)" stroke="var(--card-edge)" />
      <rect x="2.6" y="2.6" width="54.8" height="78.8" rx="3.4" fill="none" stroke={LINE} strokeWidth="0.5" />
      {children}
    </svg>
  );
}

/* ---------- Cards ---------- */

const ROMAN: Record<string, string> = { '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X' };

/** Pips of the upper half; `center` adds one on the card's middle line. */
const PIPS: Record<string, { half: [number, number][]; center?: boolean; size: number }> = {
  '7': { half: [[17, 21], [30, 21], [43, 21]], center: true, size: 10.5 },
  '8': { half: [[21, 18], [39, 18], [21, 32], [39, 32]], size: 10.5 },
  '9': { half: [[21, 17], [39, 17], [21, 30], [39, 30]], center: true, size: 10 },
  '10': { half: [[17, 18], [30, 18], [43, 18], [21, 32], [39, 32]], size: 9.5 },
};

function Numeral({ suit, rank }: { suit: Suit; rank: string }) {
  const { half, center, size } = PIPS[rank];
  return (
    <Frame>
      <DoubleHeaded>
        <g fill={LINE} fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="6.4">
          <text x="5.2" y="9.6">{ROMAN[rank]}</text>
          <text x="54.8" y="9.6" textAnchor="end">{ROMAN[rank]}</text>
        </g>
        {half.map(([cx, cy], i) => (
          <Pip key={i} suit={suit} cx={cx} cy={cy} size={size} />
        ))}
      </DoubleHeaded>
      {center && <Pip suit={suit} cx={30} cy={42} size={size} />}
    </Frame>
  );
}

/** Ober and Unter: characters from Wilhelm Tell, with the Hungarian name order. */
const COURTS: Record<Suit, { Q: { name: string; f: Figure }; J: { name: string; f: Figure } }> = {
  hearts: {
    Q: { name: 'GESZLER HERMANN', f: { coat: '#c8361f', trim: '#f0bd2c', hat: 'plume', hatColor: '#2c2c3a', hair: '#4a3020', beard: 'full', prop: 'sword' } },
    J: { name: 'KUONI PÁSZTOR', f: { coat: '#7d5a32', trim: '#3d9142', hat: 'hood', hatColor: '#5e7a3a', hair: '#8a6a40', beard: 'short', prop: 'crook' } },
  },
  diamonds: {
    Q: { name: 'STÜSSI VADÁSZ', f: { coat: '#3d7a3a', trim: '#c8361f', hat: 'feather', hatColor: '#3d5a2a', hair: '#5a3a1a', beard: 'short', prop: 'horn' } },
    J: { name: 'REDING ITELL', f: { coat: '#2f5a9a', trim: '#f0bd2c', hat: 'beret', hatColor: '#c8361f', hair: '#3a2614', beard: 'short', prop: 'sword' } },
  },
  spades: {
    Q: { name: 'RUDENZ ULRICH', f: { coat: '#e0a92a', trim: '#2f5a9a', hat: 'beret', hatColor: '#2f5a9a', hair: '#b07a3a', prop: 'sword' } },
    J: { name: 'FÜRST WALTER', f: { coat: '#6a4a8a', trim: '#e0a92a', hat: 'hood', hatColor: '#8a3a2a', hair: '#e6e1d6', beard: 'full', prop: 'staff' } },
  },
  clubs: {
    Q: { name: 'TELL VILMOS', f: { coat: '#4f7a34', trim: '#c8361f', hat: 'feather', hatColor: '#6b4a1e', hair: '#5a3a1a', beard: 'full', prop: 'crossbow' } },
    J: { name: 'HARRAS RUDOLF', f: { coat: '#c8361f', trim: '#2f5a9a', hat: 'helmet', hatColor: '#999', hair: '#3a2614', beard: 'short', prop: 'halberd' } },
  },
};

function Court({ suit, rank }: { suit: Suit; rank: 'Q' | 'J' }) {
  const { name, f } = COURTS[suit][rank];
  // The Ober carries his suit sign at the top, the Unter lower down.
  const signY = rank === 'Q' ? 8.5 : 30;
  return (
    <Frame>
      <DoubleHeaded>
        <Bust f={f} />
        <Pip suit={suit} cx={8.6} cy={signY} size={9} />
        <Pip suit={suit} cx={51.4} cy={signY} size={9} />
        <Banner text={name} color={f.coat} />
      </DoubleHeaded>
    </Frame>
  );
}

const HORSE: Record<Suit, { body: string; cloth: string }> = {
  hearts: { body: '#f4f0e4', cloth: '#c8361f' },
  diamonds: { body: '#8a5a2a', cloth: '#e0a92a' },
  spades: { body: '#5a3a24', cloth: '#3d7a3a' },
  clubs: { body: '#d9cdb6', cloth: '#2f5a9a' },
};

/** King on horseback: the horse's head on the left, the crowned king beside it. */
function King({ suit }: { suit: Suit }) {
  const horse = HORSE[suit];
  const king: Figure = { coat: '#c8361f', trim: '#f4f0e4', hat: 'crown', hatColor: '#f0bd2c', hair: '#6a4a2a', beard: 'full', prop: 'sceptre' };
  return (
    <Frame>
      <DoubleHeaded>
        <g stroke={LINE} strokeWidth="0.6" strokeLinejoin="round">
          <path d="M6 38c.4-7 2-12.4 5.2-16.6L9.4 16l2.8 1 1-3.4 2 3c3.4.6 5.6 3 5.2 6.4L21 38z" fill={horse.body} />
          <circle cx="13.4" cy="20.6" r="0.6" fill={LINE} stroke="none" />
          <path d="M6.2 33.4h14.6l.2 4.6H6z" fill={horse.cloth} />
          <path d="M11.2 21.4l5.4 4.4" stroke="#7a4a1f" strokeWidth="0.8" />
        </g>
        <g transform="translate(4 0)">
          <Bust f={king} />
        </g>
        <path d="M24 31.4h20" stroke="#f4f0e4" strokeWidth="1.6" />
        <Pip suit={suit} cx={8.6} cy={8.5} size={9} />
        <Pip suit={suit} cx={51.4} cy={8.5} size={9} />
        <Banner text="KIRÁLY" color={horse.cloth} />
      </DoubleHeaded>
    </Frame>
  );
}

/** Ace (Daus): the season of its suit, as on the Tell pattern. */
const SEASONS: Record<Suit, { name: string; sky: string; ground: string; f: Figure }> = {
  hearts: { name: 'TAVASZ', sky: '#e4f1f6', ground: '#8cc06a', f: { coat: '#e86a8c', trim: '#f4f0e4', hat: 'kerchief', hatColor: '#f0bd2c', hair: '#8a5a2a', prop: 'flowers' } },
  diamonds: { name: 'NYÁR', sky: '#f8edc4', ground: '#d9b04a', f: { coat: '#f4f0e4', trim: '#c8361f', hat: 'feather', hatColor: '#d9b04a', hair: '#5a3a1a', beard: 'short', prop: 'scythe' } },
  spades: { name: 'ŐSZ', sky: '#f3e3cf', ground: '#a0763a', f: { coat: '#7d5a32', trim: '#e0a92a', hat: 'beret', hatColor: '#3d7a3a', hair: '#3a2614', beard: 'short' } },
  clubs: { name: 'TÉL', sky: '#dde7f0', ground: '#f4f6f8', f: { coat: '#6a4a3a', trim: '#d9cdb6', hat: 'fur', hatColor: '#4a3020', hair: '#4a3020', beard: 'full' } },
};

function Scenery({ suit }: { suit: Suit }) {
  switch (suit) {
    case 'hearts': // spring: a tree in blossom
      return (
        <g>
          <path d="M45 34V22" stroke="#6b3d12" strokeWidth="1.2" />
          <circle cx="45" cy="20" r="4.2" fill="#f4c6d4" />
          <circle cx="43.6" cy="18.8" r="0.8" fill="#e86a8c" />
          <circle cx="46.4" cy="21" r="0.8" fill="#e86a8c" />
        </g>
      );
    case 'diamonds': // summer: sun and a sheaf
      return (
        <g>
          <circle cx="17" cy="15" r="3" fill="#f0bd2c" />
          <path d="M45 34l-2.6-9M45 34V24.4M45 34l2.6-9" stroke="#b8862a" strokeWidth="1.1" />
          <path d="M42.6 30h4.8" stroke="#7a4a0c" strokeWidth="0.8" />
        </g>
      );
    case 'spades': // autumn: grapes and the pressing vat
      return (
        <g stroke={LINE} strokeWidth="0.5">
          <path d="M40 36v-6.4h10V36z" fill="#9a6a34" />
          <path d="M40 31.6h10M40 34h10" />
          {[[16, 19], [18, 19], [17, 21], [15, 21], [19, 21], [16, 23], [18, 23], [17, 25]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="1.1" fill="#6a2a6a" />
          ))}
        </g>
      );
    case 'clubs': // winter: a campfire in the snow
      return (
        <g>
          <path d="M41 35.6l8-2.4M41 33.2l8 2.4" stroke="#6b3d12" strokeWidth="1.2" />
          <path d="M45 33.6c-3-2.4-1.4-5 0-7.8.4 2 2.6 3 1.8 5.4 1-.6 1.4-1.4 1.4-2.2 1 2.4-.4 4.4-3.2 4.6z" fill="#e8742a" />
          {[[15, 15], [20, 20], [42, 15], [48, 20], [17, 25], [36, 12]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="0.6" fill="#fff" />
          ))}
        </g>
      );
  }
}

function Ace({ suit }: { suit: Suit }) {
  const s = SEASONS[suit];
  return (
    <Frame>
      <DoubleHeaded>
        <path d="M10.5 37.6V17q0-8.6 19.5-8.6T49.5 17v20.6z" fill={s.sky} stroke={LINE} strokeWidth="0.5" />
        <path d="M10.75 37.6V31q9-3 19.25-1.6t18.75 1V37.6z" fill={s.ground} />
        <Scenery suit={suit} />
        <g transform="translate(9.6 6.4) scale(0.68)">
          <Bust f={s.f} />
        </g>
        <Pip suit={suit} cx={7.2} cy={7.4} size={8} />
        <Pip suit={suit} cx={52.8} cy={7.4} size={8} />
        <Banner text={s.name} color="#8a5a2a" />
      </DoubleHeaded>
    </Frame>
  );
}

export function HungarianFace({ card }: { card: CardT }) {
  const { suit, rank } = card;
  if (rank === 'A') return <Ace suit={suit} />;
  if (rank === 'K') return <King suit={suit} />;
  if (rank === 'Q' || rank === 'J') return <Court suit={suit} rank={rank} />;
  return <Numeral suit={suit} rank={rank} />;
}
