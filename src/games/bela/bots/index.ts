// Every Bela bot, by id, plus the difficulty levels offered to players.
// Bots only ever receive a SeatView (own hand + public information).
import type { Rng } from '../../../core/rng';
import { chooseAction as heuristicAction } from '../bot';
import type { BelaAction } from '../state';
import type { SeatView } from '../view';
import { HEURISTIC_BID, LEARNED_BID, chooseTrumpCall, type BidConfig } from './bidding';
import { ISMCTS_DEFAULT, ismctsPlay, type IsmctsConfig } from './ismcts';
import { PIMC_DEFAULT, pimcPlay, type PimcConfig } from './pimc';
import { ALL_FEATURES, trackerAction } from './tracker';

export type Bot = (v: SeatView, rng: Rng) => BelaAction;

const randomAction: Bot = (v, rng) => {
  if (v.phase === 'handOver') return { type: 'next' };
  return v.legal[Math.floor(rng() * v.legal.length)];
};

/** Level 0 bidding with someone else's card play. */
function withBidding(bid: BidConfig, play: Bot): Bot {
  return (v, rng) => (v.phase === 'trump' ? chooseTrumpCall(v, bid) : play(v, rng));
}

export function pimcBot(cfg: Partial<PimcConfig> = {}, bid: BidConfig = HEURISTIC_BID): Bot {
  const full = { ...PIMC_DEFAULT, ...cfg };
  return withBidding(bid, (v, rng) =>
    v.phase === 'play' ? { type: 'play', card: pimcPlay(v, rng, full) } : heuristicAction(v, rng),
  );
}

export function ismctsBot(cfg: Partial<IsmctsConfig> = {}, bid: BidConfig = HEURISTIC_BID): Bot {
  const full = { ...ISMCTS_DEFAULT, ...cfg };
  return withBidding(bid, (v, rng) =>
    v.phase === 'play' ? { type: 'play', card: ismctsPlay(v, rng, full) } : heuristicAction(v, rng),
  );
}

/**
 * Weaken a bot: with probability `rate`, play a random legal card instead
 * (bidding is left alone). Cheaper than building separate weak bots.
 */
export function withMistakes(bot: Bot, rate: number): Bot {
  return (v, rng) => {
    if (v.phase === 'play' && v.playable.length > 1 && rng() < rate) {
      return { type: 'play', card: v.playable[Math.floor(rng() * v.playable.length)] };
    }
    return bot(v, rng);
  };
}

/**
 * Research bots by spec string, e.g. "pimc", "pimc:samples=8,exact=4",
 * "tracker:bid=learned", "heuristic:mistakes=0.2". Used by the arena scripts.
 *
 * Keys: bid=heuristic|learned, th=<bid threshold>, match=0|1 (match-aware bidding),
 * mistakes=<rate>; tracker: off=<feature>+<feature>, samples, risk; pimc: samples, exact, rollouts, evidence=0|1;
 * ismcts: iters, c, noise, evidence=0|1.
 */
export function makeBot(spec: string): Bot {
  const [base, args = ''] = spec.split(':');
  const p = Object.fromEntries(args.split(',').filter(Boolean).map((kv) => kv.split('='))) as Record<string, string>;
  const num = (k: string, d: number) => (p[k] !== undefined ? Number(p[k]) : d);
  const learned = p.bid === 'learned';
  const bid: BidConfig = {
    ...(learned ? LEARNED_BID : HEURISTIC_BID),
    threshold: num('th', (learned ? LEARNED_BID : HEURISTIC_BID).threshold),
    matchAware: num('match', learned ? 1 : 0) === 1,
  };
  let bot: Bot;
  switch (base) {
    case 'random':
      bot = randomAction;
      break;
    case 'heuristic':
      bot = withBidding(bid, heuristicAction);
      break;
    case 'tracker': {
      // off=drawTrumps+safeWin switches features off (see TrackerFeatures).
      const off = (p.off ?? '').split('+').filter(Boolean);
      const features = {
        ...ALL_FEATURES,
        ...Object.fromEntries(off.map((name) => [name, false])),
        samples: num('samples', ALL_FEATURES.samples),
        risk: num('risk', ALL_FEATURES.risk),
      };
      bot = withBidding(bid, (v, rng) => trackerAction(v, rng, features));
      break;
    }
    case 'pimc':
      bot = pimcBot(
        {
          samples: num('samples', PIMC_DEFAULT.samples),
          exactCards: num('exact', PIMC_DEFAULT.exactCards),
          rollouts: num('rollouts', PIMC_DEFAULT.rollouts),
          biddingEvidence: num('evidence', 1) === 1,
          utility: { matchBonus: num('bonus', PIMC_DEFAULT.utility.matchBonus) },
        },
        bid,
      );
      break;
    case 'ismcts':
      bot = ismctsBot(
        {
          iterations: num('iters', ISMCTS_DEFAULT.iterations),
          exploration: num('c', ISMCTS_DEFAULT.exploration),
          noise: num('noise', ISMCTS_DEFAULT.noise),
          biddingEvidence: num('evidence', 1) === 1,
          utility: { matchBonus: num('bonus', ISMCTS_DEFAULT.utility.matchBonus) },
        },
        bid,
      );
      break;
    default:
      throw new Error(`Unknown bot ${spec}`);
  }
  return p.mistakes ? withMistakes(bot, Number(p.mistakes)) : bot;
}

/** Difficulty levels players can pick. */
export const BOT_LEVELS = ['easy', 'medium', 'hard', 'expert'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];
export const DEFAULT_BOT_LEVEL: BotLevel = 'medium';

// Time limits keep the browser responsive; the arena uses fixed sample counts.
const LEVEL_BOTS: Record<BotLevel, Bot> = {
  easy: withMistakes(heuristicAction, 0.3),
  medium: heuristicAction,
  hard: withBidding(LEARNED_BID, (v, rng) => trackerAction(v, rng)),
  expert: pimcBot({ samples: 40, maxMs: 700 }, LEARNED_BID),
};

/** The bot behind a difficulty level (unknown levels fall back to the default). */
export const levelBot: Bot = (v, rng) => (LEVEL_BOTS[v.options.botLevel ?? DEFAULT_BOT_LEVEL] ?? LEVEL_BOTS[DEFAULT_BOT_LEVEL])(v, rng);
