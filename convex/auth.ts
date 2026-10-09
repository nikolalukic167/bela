import Google from '@auth/core/providers/google';
import { Anonymous } from '@convex-dev/auth/providers/Anonymous';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { emailToUsername } from '../src/account/username';
import { TableError } from './lib/errors';
import { acceptName, isOffensive } from './lib/names';
import { onUserStored } from './lib/uniqueNames';
import type { MutationCtx } from './_generated/server';

// Three ways in; none is required for local play:
//  - Guest: a display name, no credentials. The session lives in the browser.
//  - Username + password: a persistent account without Google (no email, no verification).
//  - Google: credentials come from the deployment's AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // Only offered when the deployment has Google credentials, so guest/username sign-in works without them.
    ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
    Anonymous({
      profile: (params) => ({ isAnonymous: true, name: acceptName(params.name) }),
    }),
    Password({
      profile: (params) => {
        const email = typeof params.email === 'string' ? params.email.toLowerCase() : '';
        const username = emailToUsername(email);
        if (!username) throw new TableError('INVALID_INPUT');
        // The username is the display name. Checked at sign-up only, so a later change to the
        // word list never locks anyone out of an existing account.
        if (params.flow === 'signUp' && isOffensive(username)) throw new TableError('NAME_NOT_ALLOWED');
        return { email, name: username };
      },
    }),
  ],
  callbacks: {
    // Runs in the mutation that stores the user: unique display names (architecture §14.1).
    afterUserCreatedOrUpdated: (ctx, args) => onUserStored(ctx as unknown as MutationCtx, args),
  },
});
