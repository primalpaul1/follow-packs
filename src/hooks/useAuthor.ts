import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

const PRIMAL_API = 'https://cache2.primal.net/api';

async function fetchFromPrimal(pubkey: string): Promise<{ event?: NostrEvent; metadata?: NostrMetadata }> {
  const response = await fetch(PRIMAL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(['user_profile', { pubkey }]),
    signal: AbortSignal.timeout(4000),
  });

  const data = await response.json();

  if (Array.isArray(data)) {
    for (const event of data) {
      if (event.kind === 0 && event.pubkey === pubkey && event.content) {
        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);
          return { metadata, event };
        } catch {
          return { event };
        }
      }
    }
  }

  return {};
}

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata }>({
    queryKey: ['nostr', 'author', pubkey ?? ''],
    queryFn: async () => {
      if (!pubkey) {
        return {};
      }

      // Try Primal cache first (fast, reliable), fall back to relays
      try {
        const primalResult = await fetchFromPrimal(pubkey);
        if (primalResult.metadata) {
          return primalResult;
        }
      } catch {
        // Primal failed, fall through to relay
      }

      const [event] = await nostr.query(
        [{ kinds: [0], authors: [pubkey!], limit: 1 }],
        { signal: AbortSignal.timeout(5000) },
      );

      if (!event) {
        return {};
      }

      try {
        const metadata = n.json().pipe(n.metadata()).parse(event.content);
        return { metadata, event };
      } catch {
        return { event };
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
