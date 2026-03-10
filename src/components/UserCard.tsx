import type { NostrMetadata } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

interface UserCardProps {
  pubkey: string;
  compact?: boolean;
}

export function UserCard({ pubkey, compact }: UserCardProps) {
  const { data, isLoading } = useAuthor(pubkey);
  const metadata: NostrMetadata | undefined = data?.metadata;

  const displayName = metadata?.display_name || metadata?.name || genUserName(pubkey);
  const npub = nip19.npubEncode(pubkey);
  const shortNpub = `${npub.slice(0, 12)}...${npub.slice(-6)}`;

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-1">
        <Skeleton className="w-9 h-9 rounded-full shrink-0" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-1">
        <Avatar className="w-9 h-9 shrink-0 border border-border/50">
          <AvatarImage src={metadata?.picture} alt={displayName} />
          <AvatarFallback className="text-xs font-medium bg-primary/5 text-primary">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate leading-tight">{displayName}</p>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {metadata?.nip05 || shortNpub}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar className="w-11 h-11 shrink-0 border border-border/50">
        <AvatarImage src={metadata?.picture} alt={displayName} />
        <AvatarFallback className="text-sm font-medium bg-primary/5 text-primary">
          {displayName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{displayName}</p>
        {metadata?.nip05 && (
          <p className="text-xs text-muted-foreground truncate">{metadata.nip05}</p>
        )}
        <p className="text-xs text-muted-foreground/60 font-mono truncate">{shortNpub}</p>
      </div>
    </div>
  );
}
