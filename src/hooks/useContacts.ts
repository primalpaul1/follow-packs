import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

export function useContacts(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<string[]>({
    queryKey: ['nostr', 'contacts', pubkey ?? ''],
    queryFn: async () => {
      if (!pubkey) return [];

      const [event] = await nostr.query(
        [{ kinds: [3], authors: [pubkey], limit: 1 }],
        { signal: AbortSignal.timeout(3000) },
      );

      if (!event) return [];

      return event.tags
        .filter(([tag]) => tag === 'p')
        .map(([, value]) => value)
        .filter(Boolean);
    },
    enabled: !!pubkey,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
