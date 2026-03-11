import { type NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { Link } from 'react-router-dom';
import { Users, Clock } from 'lucide-react';

import { useAuthor } from '@/hooks/useAuthor';
import { parsePackEvent } from '@/hooks/useFollowPack';
import { genUserName } from '@/lib/genUserName';
import { MemberAvatarStack } from './MemberAvatarStack';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function PackCard({ event }: { event: NostrEvent }) {
  const { title, description, image, members } = parsePackEvent(event);
  const { data: authorData } = useAuthor(event.pubkey);
  const authorMeta = authorData?.metadata;
  const authorName = authorMeta?.display_name || authorMeta?.name || genUserName(event.pubkey);

  const dTag = event.tags.find(([t]) => t === 'd')?.[1] ?? '';
  const naddr = nip19.naddrEncode({ kind: 39089, pubkey: event.pubkey, identifier: dTag });

  return (
    <Link
      to={`/${naddr}`}
      className="group block rounded-2xl border bg-card shadow-sm overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-200"
    >
      {/* Cover image or gradient placeholder */}
      <div className="h-32 relative overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-cyan-500/20 via-sky-500/15 to-blue-500/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-semibold text-lg leading-tight truncate drop-shadow-sm">
            {title || 'Untitled Pack'}
          </h3>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}

        {/* Author */}
        <div className="flex items-center gap-2">
          <Avatar className="w-5 h-5 border border-border/40">
            <AvatarImage src={authorMeta?.picture} alt={authorName} />
            <AvatarFallback className="text-[8px] bg-gradient-to-br from-cyan-500/10 to-sky-500/10 text-primary">
              {authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">{authorName}</span>
        </div>

        {/* Member avatars */}
        {members.length > 0 && (
          <MemberAvatarStack pubkeys={members} max={5} />
        )}

        {/* Footer stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground/70 pt-1">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {timeAgo(event.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}
