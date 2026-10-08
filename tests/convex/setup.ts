import { convexTest } from 'convex-test';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.*s');

export function newBackend() {
  return convexTest(schema, modules);
}
export type Backend = ReturnType<typeof newBackend>;

/** A signed-in client for a fresh user. Convex Auth's subject is "<userId>|<sessionId>". */
export async function signUp(t: Backend, name: string, flags: { isAdmin?: boolean } = {}) {
  const userId = await t.run((ctx) => ctx.db.insert('users', { name, isAnonymous: true, ...flags }));
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) };
}

export const OPTIONS = { target: 501 as const, direction: 'ccw' as const, belaAlwaysCounts: false, tie: 'hangs' as const, botLevel: 'medium' as const };
