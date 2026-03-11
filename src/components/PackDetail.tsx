import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { Users, ArrowLeft, Loader2 } from 'lucide-react';

import { useFollowPack } from '@/hooks/useFollowPack';
import { useAuthor } from '@/hooks/useAuthor';
import { usePrefetchAuthors } from '@/hooks/usePrefetchAuthors';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useContacts } from '@/hooks/useContacts';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { genUserName } from '@/lib/genUserName';
import { UserCard } from '@/components/UserCard';
import { MemberAvatarStack } from '@/components/MemberAvatarStack';
import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

interface PackDetailProps {
  pubkey: string;
  identifier: string;
}

export function PackDetail({ pubkey, identifier }: PackDetailProps) {
  const { data: pack, isLoading } = useFollowPack({ pubkey, identifier });
  const { data: authorData } = useAuthor(pubkey);
  const { user } = useCurrentUser();
  const { data: myContacts } = useContacts(user?.pubkey);
  const { mutateAsync: publishEvent, isPending: isFollowing } = useNostrPublish();

  // Batch-prefetch all member profiles in one request
  usePrefetchAuthors(pack?.members ?? []);
  const { toast } = useToast();
  const [followedAll, setFollowedAll] = useState(false);

  const authorMeta = authorData?.metadata;
  const authorName = authorMeta?.display_name || authorMeta?.name || genUserName(pubkey);

  const handleFollowAll = useCallback(async () => {
    if (!user || !pack) return;

    const existingContacts = new Set(myContacts ?? []);
    const newPubkeys = pack.members.filter((pk) => !existingContacts.has(pk) && pk !== user.pubkey);

    if (newPubkeys.length === 0) {
      toast({ title: 'Already following everyone in this pack' });
      return;
    }

    // Merge with existing contacts
    const allContacts = [...(myContacts ?? []), ...newPubkeys];
    const tags = allContacts.map((pk) => ['p', pk]);

    try {
      await publishEvent({
        kind: 3,
        content: '',
        tags,
        created_at: Math.floor(Date.now() / 1000),
      });
      setFollowedAll(true);
      toast({ title: `Now following ${newPubkeys.length} new user${newPubkeys.length > 1 ? 's' : ''}!` });
    } catch {
      toast({ title: 'Failed to update contacts', variant: 'destructive' });
    }
  }, [user, pack, myContacts, publishEvent, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <h2 className="text-xl font-semibold">Pack not found</h2>
          <p className="text-muted-foreground">This Follow Pack may have been deleted or doesn't exist.</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/">Browse Packs</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
              <Link to="/"><ArrowLeft className="w-4 h-4" /> Back</Link>
            </Button>
          </div>
          <LoginArea className="max-w-60" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
        {/* Cover image */}
        <div className="relative rounded-2xl overflow-hidden h-48 sm:h-56">
          {pack.image ? (
            <img src={pack.image} alt={pack.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-cyan-500/20 via-sky-500/15 to-blue-500/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5">
            <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
              {pack.title || 'Untitled Pack'}
            </h1>
          </div>
        </div>

        {/* Meta info */}
        <div className="space-y-4">
          {pack.description && (
            <p className="text-muted-foreground leading-relaxed">{pack.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            {/* Author */}
            <a
              href={`https://primal.net/p/${nip19.npubEncode(pubkey)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Avatar className="w-6 h-6 border border-border/40">
                <AvatarImage src={authorMeta?.picture} alt={authorName} />
                <AvatarFallback className="text-[9px] bg-gradient-to-br from-cyan-500/10 to-sky-500/10 text-primary">
                  {authorName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">by <span className="text-foreground font-medium">{authorName}</span></span>
            </a>

            <Badge variant="secondary" className="gap-1">
              <Users className="w-3.5 h-3.5" />
              {pack.members.length} member{pack.members.length !== 1 ? 's' : ''}
            </Badge>

            {/* Follow All button */}
            {user && (
              <Button
                onClick={handleFollowAll}
                disabled={isFollowing || followedAll}
                size="sm"
                className="ml-auto gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white border-0 shadow-sm"
              >
                {isFollowing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Following...</>
                ) : followedAll ? (
                  'Followed All'
                ) : (
                  <><Users className="w-3.5 h-3.5" />Follow All</>
                )}
              </Button>
            )}
          </div>

          {/* Member avatar preview */}
          {pack.members.length > 0 && (
            <MemberAvatarStack pubkeys={pack.members} max={8} size="md" />
          )}
        </div>

        {/* Member list */}
        <div className="space-y-1">
          {pack.members.map((memberPk) => (
            <a
              key={memberPk}
              href={`https://primal.net/p/${nip19.npubEncode(memberPk)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl px-2 py-1 hover:bg-accent/40 transition-colors cursor-pointer"
            >
              <UserCard pubkey={memberPk} compact />
            </a>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center pt-8">
          <p className="text-xs text-muted-foreground/60">
            Vibed with{' '}
            <a href="https://shakespeare.diy" className="text-muted-foreground/80 hover:text-primary transition-colors underline underline-offset-2">Shakespeare</a>
          </p>
        </div>
      </main>
    </div>
  );
}
