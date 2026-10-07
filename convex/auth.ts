import Google from '@auth/core/providers/google';
import { convexAuth } from '@convex-dev/auth/server';

// Google credentials come from the deployment's AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
});
