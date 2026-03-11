import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Users, Plus } from 'lucide-react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LoginArea } from '@/components/auth/LoginArea';
import { LoginWithPrimal } from '@/components/auth/LoginWithPrimal';
import { PackGrid } from '@/components/PackGrid';
import { Button } from '@/components/ui/button';

const Index = () => {
  useSeoMeta({
    title: 'Follow Packs — Browse & Share Nostr Follow Lists',
    description: 'Discover curated Follow Packs of Nostr users.',
  });

  const { user } = useCurrentUser();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-sky-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Users className="w-[18px] h-[18px] text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Follow Packs</h1>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <Button asChild size="sm" className="gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white border-0 shadow-sm">
                <Link to="/create"><Plus className="w-4 h-4" /> Create Pack</Link>
              </Button>
            )}
            <LoginArea className="max-w-60" />
          </div>
        </div>
      </header>

      {/* Hero section */}
      <div className="relative overflow-hidden">
        <div className="absolute top-10 -left-32 w-96 h-96 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute top-20 -right-32 w-80 h-80 rounded-full bg-sky-500/5 blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Discover Follow Packs
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-6">
            Curated lists of the best people on Nostr. Browse, follow, and create your own.
          </p>
          {!user && (
            <div className="max-w-xs mx-auto space-y-4">
              <LoginWithPrimal className="w-full" />
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                <span className="text-xs text-white/30 uppercase tracking-widest font-medium">or</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              </div>
              <LoginArea className="flex justify-center" />
            </div>
          )}
        </div>
      </div>

      {/* Pack grid */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        <PackGrid />
      </main>

      {/* Footer */}
      <div className="text-center pb-8">
        <p className="text-xs text-muted-foreground/60">
          Vibed with{' '}
          <a href="https://shakespeare.diy" className="text-muted-foreground/80 hover:text-primary transition-colors underline underline-offset-2">Shakespeare</a>
        </p>
      </div>
    </div>
  );
};

export default Index;
