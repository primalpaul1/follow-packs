import { useNostr } from '@nostrify/react';
import { useNostrLogin } from '@nostrify/react/login';
import { useQuery } from '@tanstack/react-query';
import { NSchema as n, NostrEvent, NostrMetadata } from '@nostrify/nostrify';

const PRIMAL_API = 'https://cache2.primal.net/api';

export interface Account {
  id: string;
  pubkey: string;
  event?: NostrEvent;
  metadata: NostrMetadata;
}

export function useLoggedInAccounts() {
  const { nostr } = useNostr();
  const { logins, setLogin, removeLogin } = useNostrLogin();

  const { data: authors = [] } = useQuery({
    queryKey: ['nostr', 'logins', logins.map((l) => l.id).join(';')],
    queryFn: async () => {
      const pubkeys = logins.map((l) => l.pubkey);
      let events: NostrEvent[] = [];

      // Try Primal cache first
      try {
        const primalEvents: NostrEvent[] = [];
        await Promise.all(pubkeys.map(async (pubkey) => {
          const response = await fetch(PRIMAL_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(['user_profile', { pubkey }]),
            signal: AbortSignal.timeout(4000),
          });
          const data = await response.json();
          if (Array.isArray(data)) {
            for (const event of data) {
              if (event.kind === 0 && event.pubkey === pubkey) {
                primalEvents.push(event);
              }
            }
          }
        }));
        events = primalEvents;
      } catch {
        // Fall through to relay
      }

      // Fall back to relays for any missing profiles
      const foundPubkeys = new Set(events.map((e) => e.pubkey));
      const missingPubkeys = pubkeys.filter((pk) => !foundPubkeys.has(pk));
      if (missingPubkeys.length > 0) {
        try {
          const relayEvents = await nostr.query(
            [{ kinds: [0], authors: missingPubkeys }],
            { signal: AbortSignal.timeout(5000) },
          );
          events = [...events, ...relayEvents];
        } catch {
          // ignore
        }
      }

      return logins.map(({ id, pubkey }): Account => {
        const event = events.find((e) => e.pubkey === pubkey);
        try {
          const metadata = n.json().pipe(n.metadata()).parse(event?.content);
          return { id, pubkey, metadata, event };
        } catch {
          return { id, pubkey, metadata: {}, event };
        }
      });
    },
    retry: 2,
  });

  // Current user is the first login
  const currentUser: Account | undefined = (() => {
    const login = logins[0];
    if (!login) return undefined;
    const author = authors.find((a) => a.id === login.id);
    return { metadata: {}, ...author, id: login.id, pubkey: login.pubkey };
  })();

  // Other users are all logins except the current one
  const otherUsers = (authors || []).slice(1) as Account[];

  return {
    authors,
    currentUser,
    otherUsers,
    setLogin,
    removeLogin,
  };
}