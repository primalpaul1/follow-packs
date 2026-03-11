import { useAuthor } from '@/hooks/useAuthor';
import { usePrefetchAuthors } from '@/hooks/usePrefetchAuthors';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { genUserName } from '@/lib/genUserName';

interface MemberAvatarStackProps {
  pubkeys: string[];
  max?: number;
  size?: 'sm' | 'md';
}

function MemberAvatar({ pubkey, size }: { pubkey: string; size: 'sm' | 'md' }) {
  const { data } = useAuthor(pubkey);
  const metadata = data?.metadata;
  const name = metadata?.display_name || metadata?.name || genUserName(pubkey);
  const sizeClass = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';

  return (
    <Avatar className={`${sizeClass} border-2 border-background shrink-0`}>
      <AvatarImage src={metadata?.picture} alt={name} />
      <AvatarFallback className="text-[10px] font-semibold bg-gradient-to-br from-cyan-500/20 to-sky-500/20 text-primary">
        {name.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

export function MemberAvatarStack({ pubkeys, max = 5, size = 'sm' }: MemberAvatarStackProps) {
  const visible = pubkeys.slice(0, max);
  usePrefetchAuthors(visible);
  const remaining = pubkeys.length - max;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((pk) => (
          <MemberAvatar key={pk} pubkey={pk} size={size} />
        ))}
      </div>
      {remaining > 0 && (
        <span className="ml-1.5 text-xs text-muted-foreground font-medium">
          +{remaining}
        </span>
      )}
    </div>
  );
}
