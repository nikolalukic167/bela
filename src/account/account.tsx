import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react';
import { ConvexReactClient, useConvexAuth, useQuery } from 'convex/react';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { api } from '../../convex/_generated/api';

export interface Profile {
  name: string;
  image: string | null;
}

export type Account =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'signedOut'; signInWithGoogle: () => void }
  | { status: 'signedIn'; profile: Profile | null; signOut: () => void };

const Ctx = createContext<Account>({ status: 'unavailable' });

/** Set at build time by `convex deploy --cmd-url-env-var-name VITE_CONVEX_URL`. */
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;
const client = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

/** Accounts are optional: without a Convex URL the app runs fully offline. */
export function AccountProvider({ children }: { children: ReactNode }) {
  if (!client) return <Ctx.Provider value={{ status: 'unavailable' }}>{children}</Ctx.Provider>;
  return (
    <ConvexAuthProvider client={client}>
      <ConvexAccount>{children}</ConvexAccount>
    </ConvexAuthProvider>
  );
}

function ConvexAccount({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const profile = useQuery(api.users.me, isAuthenticated ? {} : 'skip');

  const value = useMemo<Account>(() => {
    if (isLoading) return { status: 'loading' };
    if (!isAuthenticated) {
      // Come back to the same page (incl. #route); Convex appends ?code=… before the hash.
      return { status: 'signedOut', signInWithGoogle: () => void signIn('google', { redirectTo: window.location.href }) };
    }
    return { status: 'signedIn', profile: profile ?? null, signOut: () => void signOut() };
  }, [isLoading, isAuthenticated, profile, signIn, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): Account {
  return useContext(Ctx);
}
