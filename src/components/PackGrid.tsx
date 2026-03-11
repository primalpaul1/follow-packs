import { type NostrEvent } from '@nostrify/nostrify';
import { Loader2, Users } from 'lucide-react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useFollowPacks, type PackFilter } from '@/hooks/useFollowPacks';
import { PackCard } from './PackCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';

const FILTER_OPTIONS: { value: PackFilter; label: string; requiresLogin: boolean }[] = [
  { value: 'all', label: 'All Packs', requiresLogin: false },
  { value: 'following', label: 'From People I Follow', requiresLogin: true },
  { value: 'includes-me', label: "Packs I'm In", requiresLogin: true },
  { value: 'my-packs', label: 'My Packs', requiresLogin: true },
];

function SkeletonCard() {
  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex -space-x-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="w-7 h-7 rounded-full border-2 border-background" />
          ))}
        </div>
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function PackGrid() {
  const { user } = useCurrentUser();
  const [filter, setFilter] = useState<PackFilter>('all');

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useFollowPacks({ filter });

  // Deduplicate events across pages by event id
  const allEvents = data?.pages.flat() ?? [];
  const seen = new Set<string>();
  const events: NostrEvent[] = [];
  for (const e of allEvents) {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      events.push(e);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => {
          const disabled = opt.requiresLogin && !user;
          return (
            <button
              key={opt.value}
              onClick={() => !disabled && setFilter(opt.value)}
              disabled={disabled}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === opt.value
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-white shadow-sm'
                  : disabled
                    ? 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
                    : 'bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-muted-foreground/30" />
          </div>
          <p className="text-muted-foreground">
            {filter === 'all'
              ? 'No Follow Packs found yet. Create the first one!'
              : 'No packs match this filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((event) => (
            <PackCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasNextPage && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            variant="outline"
            size="lg"
            className="rounded-xl border-white/15 gap-2"
          >
            {isFetchingNextPage ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Loading...</>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
