import { type NostrEvent, type NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { useCurrentUser } from './useCurrentUser';
import { useContacts } from './useContacts';

export type PackFilter = 'all' | 'following' | 'includes-me' | 'my-packs';

export function useFollowPacks(options?: { filter?: PackFilter; limit?: number }) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { data: contacts } = useContacts(user?.pubkey);

  const filter = options?.filter ?? 'all';
  const limit = options?.limit ?? 12;

  const isReady = filter === 'all'
    || (filter === 'following' && !!contacts && contacts.length > 0)
    || (filter === 'includes-me' && !!user?.pubkey)
    || (filter === 'my-packs' && !!user?.pubkey);

  return useInfiniteQuery<NostrEvent[]>({
    queryKey: ['nostr', 'follow-packs', filter, limit, user?.pubkey, contacts?.length],
    queryFn: async ({ pageParam }) => {
      const baseFilter: NostrFilter = { kinds: [39089], limit };

      if (pageParam) {
        baseFilter.until = pageParam as number;
      }

      switch (filter) {
        case 'following':
          if (!contacts || contacts.length === 0) return [];
          // Limit to 500 authors per query (relay constraint)
          baseFilter.authors = contacts.slice(0, 500);
          break;
        case 'includes-me':
          if (!user?.pubkey) return [];
          baseFilter['#p'] = [user.pubkey];
          break;
        case 'my-packs':
          if (!user?.pubkey) return [];
          baseFilter.authors = [user.pubkey];
          break;
      }

      const events = await nostr.query(
        [baseFilter],
        { signal: AbortSignal.timeout(5000) },
      );

      return events;
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < limit) return undefined;
      const lastEvent = lastPage[lastPage.length - 1];
      if (!lastEvent) return undefined;
      return lastEvent.created_at - 1;
    },
    enabled: isReady,
    staleTime: 60 * 1000,
  });
}
