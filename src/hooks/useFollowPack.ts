import { type NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

export interface FollowPackData {
  event: NostrEvent;
  title: string;
  description: string;
  image: string;
  members: string[];
}

function parsePackEvent(event: NostrEvent): FollowPackData {
  const title = event.tags.find(([t]) => t === 'title')?.[1] ?? '';
  const description = event.tags.find(([t]) => t === 'description')?.[1] ?? '';
  const image = event.tags.find(([t]) => t === 'image')?.[1] ?? '';
  const members = event.tags.filter(([t]) => t === 'p').map(([, v]) => v).filter(Boolean);
  return { event, title, description, image, members };
}

export { parsePackEvent };

export function useFollowPack({ pubkey, identifier }: { pubkey: string; identifier: string }) {
  const { nostr } = useNostr();

  return useQuery<FollowPackData | null>({
    queryKey: ['nostr', 'follow-pack', pubkey, identifier],
    queryFn: async () => {
      const [event] = await nostr.query(
        [{ kinds: [39089], authors: [pubkey], '#d': [identifier], limit: 1 }],
        { signal: AbortSignal.timeout(5000) },
      );

      if (!event) return null;
      return parsePackEvent(event);
    },
    staleTime: 2 * 60 * 1000,
    retry: 3,
  });
}
