import { useState, useCallback } from 'react';
import type { NostrMetadata } from '@nostrify/nostrify';
import { NSchema as n } from '@nostrify/nostrify';

export interface UserSearchResult {
  pubkey: string;
  metadata?: NostrMetadata;
}

const PRIMAL_API = 'https://cache2.primal.net/api';

/**
 * Hook for searching Nostr users by name.
 * Uses the Primal caching API for fast, reliable search.
 */
export function useUserSearch() {
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(PRIMAL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(["user_search", { query, limit: 10 }]),
        signal: AbortSignal.timeout(8000),
      });

      const data = await response.json();

      // Primal returns an array of Nostr events
      // Kind 0 events contain the user metadata
      const parsed: UserSearchResult[] = [];

      if (Array.isArray(data)) {
        for (const event of data) {
          if (event.kind === 0 && event.pubkey && event.content) {
            try {
              const metadata = n.json().pipe(n.metadata()).parse(event.content);
              parsed.push({
                pubkey: event.pubkey,
                metadata,
              });
            } catch {
              parsed.push({ pubkey: event.pubkey });
            }
          }
        }
      }

      setResults(parsed);
    } catch (err) {
      // Silently handle abort errors (user typed more characters)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('User search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

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
