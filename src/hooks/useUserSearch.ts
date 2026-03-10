import { useState, useCallback } from 'react';
import type { NostrMetadata, NostrEvent } from '@nostrify/nostrify';
import { NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';

export interface UserSearchResult {
  pubkey: string;
  metadata?: NostrMetadata;
}

/**
 * Hook for searching Nostr users by name.
 * Uses a relay query with search filter for user discovery.
 */
export function useUserSearch() {
  const { nostr } = useNostr();
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      // Use relay search capability to find user profiles
      const searchRelay = nostr.relay('wss://relay.nostr.band');

      const events: NostrEvent[] = await searchRelay.query(
        [{ kinds: [0], search: query, limit: 10 }],
        { signal: AbortSignal.timeout(5000) },
      );

      const parsed: UserSearchResult[] = [];

      for (const event of events) {
        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);
          parsed.push({
            pubkey: event.pubkey,
            metadata,
          });
        } catch {
          // Skip unparseable metadata
          parsed.push({ pubkey: event.pubkey });
        }
      }

      setResults(parsed);
    } catch (err) {
      console.error('User search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [nostr]);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return {
    results,
    isSearching,
    search,
    clearResults,
  };
}
