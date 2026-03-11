import { NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

const PRIMAL_API = 'https://cache2.primal.net/api';

/**
 * Batch-prefetches author metadata for a list of pubkeys via Primal,
 * then seeds the individual useAuthor query cache entries.
 * Falls back to relays for any profiles Primal doesn't have.
 */
export function usePrefetchAuthors(pubkeys: string[]) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const fetchedRef = useRef(new Set<string>());

  useEffect(() => {
    // Only fetch pubkeys we haven't already batch-fetched
    const toFetch = pubkeys.filter((pk) => {
      if (fetchedRef.current.has(pk)) return false;
      const cached = queryClient.getQueryData(['nostr', 'author', pk]);
      if (cached && (cached as Record<string, unknown>).metadata) return false;
      return true;
    });

    if (toFetch.length === 0) return;

    // Mark as in-flight immediately to avoid duplicate fetches
    for (const pk of toFetch) {
      fetchedRef.current.add(pk);
    }

    (async () => {
      const foundPubkeys = new Set<string>();

      // Batch fetch from Primal in chunks of 50
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < toFetch.length; i += 50) {
          chunks.push(toFetch.slice(i, i + 50));
        }

        await Promise.all(chunks.map(async (chunk) => {
          try {
            const response = await fetch(PRIMAL_API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(['user_infos', { pubkeys: chunk }]),
              signal: AbortSignal.timeout(6000),
            });
            const data = await response.json();

            if (Array.isArray(data)) {
              for (const event of data) {
                if (event.kind === 0 && event.pubkey && event.content) {
                  try {
                    const metadata = n.json().pipe(n.metadata()).parse(event.content);
                    queryClient.setQueryData(
                      ['nostr', 'author', event.pubkey],
                      { metadata, event },
                    );
                    foundPubkeys.add(event.pubkey);
                  } catch {
                    // skip unparseable
                  }
                }
              }
            }
          } catch {
            // chunk failed, will fall back to relay
          }
        }));
      } catch {
        // Primal entirely failed
      }

      // Fall back to relays for missing profiles
      const missing = toFetch.filter((pk) => !foundPubkeys.has(pk));
      if (missing.length > 0) {
        try {
          const events = await nostr.query(
            [{ kinds: [0], authors: missing }],
            { signal: AbortSignal.timeout(5000) },
          );
          for (const event of events) {
            try {
              const metadata = n.json().pipe(n.metadata()).parse(event.content);
              queryClient.setQueryData(
                ['nostr', 'author', event.pubkey],
                { metadata, event },
              );
            } catch {
              queryClient.setQueryData(
                ['nostr', 'author', event.pubkey],
                { event },
              );
            }
          }
        } catch {
          // relay also failed — individual useAuthor will retry on its own
        }
      }
    })();
  }, [pubkeys.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
}
