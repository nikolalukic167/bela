import Google from '@auth/core/providers/google';
import { Anonymous } from '@convex-dev/auth/providers/Anonymous';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { emailToUsername } from '../src/account/username';
import { cleanName } from './lib/auth';
import { MAX_NAME_LENGTH, MIN_NAME_LENGTH } from './lib/config';
import { TableError } from './lib/errors';

// Three ways in; none is required for local play:
//  - Guest: a display name, no credentials. The session lives in the browser.
//  - Username + password: a persistent account without Google (no email, no verification).
//  - Google: credentials come from the deployment's AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // Only offered when the deployment has Google credentials, so guest/username sign-in works without them.
    ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
    Anonymous({
      profile: (params) => ({ isAnonymous: true, name: cleanName(params.name, MIN_NAME_LENGTH, MAX_NAME_LENGTH) }),
    }),
    Password({
      profile: (params) => {
        const email = typeof params.email === 'string' ? params.email.toLowerCase() : '';
        const username = emailToUsername(email);
        if (!username) throw new TableError('INVALID_INPUT');
        return { email, name: username };
      },
    }),
  ],
});
