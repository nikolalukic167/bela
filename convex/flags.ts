import { query } from './_generated/server';
import { allFlags } from './lib/flags';

/** Public (architecture §9.2): which features are switched on, so the client can hide the rest. */
export const list = query({
  args: {},
  handler: (ctx) => allFlags(ctx),
});
