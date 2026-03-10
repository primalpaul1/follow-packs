import { useState, useCallback, useRef } from 'react';
import { useSeoMeta } from '@unhead/react';
import { nip19 } from 'nostr-tools';
import { Users, ImagePlus, X, Upload, Loader2, ClipboardPaste, AlertCircle, CheckCircle2, Search, Plus, ChevronUp, ChevronDown } from 'lucide-react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { useUserSearch, type UserSearchResult } from '@/hooks/useUserSearch';
import { LoginArea } from '@/components/auth/LoginArea';
import { LoginWithPrimal } from '@/components/auth/LoginWithPrimal';
import { UserCard } from '@/components/UserCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const FOLLOW_LIST_KIND = 39089;

function generateId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array(12).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

interface ParsedEntry {
  pubkey: string;
  npub: string;
}

function parseNpubsFromText(text: string): { valid: ParsedEntry[]; invalid: string[] } {
  const tokens = text.split(/[\n\r,\s\t]+/).map((t) => t.trim()).filter((t) => t.length > 0);
  const valid: ParsedEntry[] = [];
  const invalid: string[] = [];
  const seenPubkeys = new Set<string>();

  for (const token of tokens) {
    const cleaned = token.replace(/^nostr:/, '');
    try {
      const decoded = nip19.decode(cleaned);
      let pubkey: string | null = null;
      if (decoded.type === 'npub') pubkey = decoded.data;
      else if (decoded.type === 'nprofile') pubkey = decoded.data.pubkey;
      if (pubkey && !seenPubkeys.has(pubkey)) {
        seenPubkeys.add(pubkey);
        valid.push({ pubkey, npub: nip19.npubEncode(pubkey) });
      }
    } catch {
      if (/^[0-9a-f]{64}$/i.test(cleaned)) {
        const pubkey = cleaned.toLowerCase();
        if (!seenPubkeys.has(pubkey)) {
          seenPubkeys.add(pubkey);
          valid.push({ pubkey, npub: nip19.npubEncode(pubkey) });
        }
      } else if (cleaned.length > 3) {
        invalid.push(cleaned);
      }
    }
  }
  return { valid, invalid };
}

export default function CreateFollowPack() {
  useSeoMeta({
    title: 'Follow Packs — Create & Share Nostr Follow Lists',
    description: 'Create a curated Follow Pack of Nostr users to share with the world.',
  });

  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent, isPending: isPublishing } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();
  const { results: searchResults, isSearching, search, clearResults } = useUserSearch();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [bulkInput, setBulkInput] = useState('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [published, setPublished] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value.trim() || value.trim().length < 2) { clearResults(); return; }
    searchTimeoutRef.current = setTimeout(() => { search(value.trim()); }, 400);
  }, [search, clearResults]);

  const handleSearchSubmit = useCallback(() => {
    const cleaned = searchQuery.trim().replace(/^nostr:/, '');
    if (!cleaned) return;
    try {
      const decoded = nip19.decode(cleaned);
      let pubkey: string | null = null;
      if (decoded.type === 'npub') pubkey = decoded.data;
      else if (decoded.type === 'nprofile') pubkey = decoded.data.pubkey;
      if (pubkey) {
        if (entries.some((e) => e.pubkey === pubkey)) {
          toast({ title: 'Already added', description: 'This user is already in your list.' });
        } else {
          setEntries((prev) => [...prev, { pubkey: pubkey!, npub: nip19.npubEncode(pubkey!) }]);
          toast({ title: 'User added' });
        }
        setSearchQuery(''); clearResults(); return;
      }
    } catch { /* not an npub */ }
    if (/^[0-9a-f]{64}$/i.test(cleaned)) {
      const pubkey = cleaned.toLowerCase();
      if (entries.some((e) => e.pubkey === pubkey)) {
        toast({ title: 'Already added' });
      } else {
        setEntries((prev) => [...prev, { pubkey, npub: nip19.npubEncode(pubkey) }]);
        toast({ title: 'User added' });
      }
      setSearchQuery(''); clearResults(); return;
    }
    search(cleaned);
  }, [searchQuery, entries, toast, clearResults, search]);

  const handleAddSearchResult = useCallback((result: UserSearchResult) => {
    if (entries.some((e) => e.pubkey === result.pubkey)) {
      toast({ title: 'Already added' }); return;
    }
    setEntries((prev) => [...prev, { pubkey: result.pubkey, npub: nip19.npubEncode(result.pubkey) }]);
    setSearchQuery(''); clearResults();
  }, [entries, toast, clearResults]);

  const handleCoverUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const tags = await uploadFile(file);
      const url = tags[0]?.[1];
      if (url) { setCoverImageUrl(url); toast({ title: 'Image uploaded' }); }
    } catch (err) {
      console.error('Upload error:', err);
      toast({ title: 'Upload failed', variant: 'destructive' });
    }
  }, [uploadFile, toast]);

  const handleAddNpubs = useCallback(() => {
    if (!bulkInput.trim()) return;
    const { valid, invalid } = parseNpubsFromText(bulkInput);
    const existingPubkeys = new Set(entries.map((e) => e.pubkey));
    const newEntries = valid.filter((v) => !existingPubkeys.has(v.pubkey));
    if (newEntries.length > 0) setEntries((prev) => [...prev, ...newEntries]);
    setParseErrors(invalid);
    setBulkInput('');
    const added = newEntries.length;
    const dupes = valid.length - newEntries.length;
    if (added > 0) toast({ title: `${added} user${added > 1 ? 's' : ''} added`, description: dupes > 0 ? `${dupes} duplicate${dupes > 1 ? 's' : ''} skipped.` : undefined });
    else if (dupes > 0) toast({ title: 'All duplicates' });
    if (invalid.length > 0) toast({ title: `${invalid.length} invalid`, variant: 'destructive' });
  }, [bulkInput, entries, toast]);

  const handleRemove = useCallback((pubkey: string) => {
    setEntries((prev) => prev.filter((e) => e.pubkey !== pubkey));
  }, []);

  const handleMove = useCallback((index: number, direction: 'up' | 'down') => {
    setEntries((prev) => {
      const next = [...prev];
      const t = direction === 'up' ? index - 1 : index + 1;
      if (t < 0 || t >= next.length) return prev;
      [next[index], next[t]] = [next[t], next[index]];
      return next;
    });
  }, []);

  const handlePublish = useCallback(async () => {
    if (!name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    if (entries.length === 0) { toast({ title: 'Add at least one user', variant: 'destructive' }); return; }
    const id = generateId();
    const tags: string[][] = [['title', name.trim()], ['d', id]];
    if (coverImageUrl) tags.push(['image', coverImageUrl]);
    if (description.trim()) tags.push(['description', description.trim()]);
    for (const entry of entries) tags.push(['p', entry.pubkey]);
    try {
      await publishEvent({ kind: FOLLOW_LIST_KIND, content: '', tags, created_at: Math.floor(Date.now() / 1000) });
      setPublished(true);
      toast({ title: 'Follow Pack published!' });
    } catch (err) {
      console.error('Publish error:', err);
      toast({ title: 'Publish failed', variant: 'destructive' });
    }
  }, [name, description, coverImageUrl, entries, publishEvent, toast]);

  const handleCreateAnother = useCallback(() => {
    setName(''); setDescription(''); setCoverImageUrl(''); setEntries([]); setBulkInput('');
    setParseErrors([]); setPublished(false); setSearchQuery(''); clearResults(); setShowBulkInput(false);
  }, [clearResults]);

  // ── Logged-out state ──
  if (!user) {
    return (
      <div className="min-h-screen gradient-bg-hero relative overflow-hidden">
        {/* Background orbs */}
        <div className="absolute top-20 -left-32 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl animate-float" />
        <div className="absolute bottom-20 -right-32 w-80 h-80 rounded-full bg-sky-500/8 blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        <div className="relative z-10 max-w-md mx-auto px-5 pt-24 pb-16">
          <div className="text-center space-y-8 animate-fade-in-up">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-400/20 to-sky-500/20 border border-cyan-400/20 glow animate-float">
              <Users className="w-11 h-11 text-cyan-400" />
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-bold tracking-tight text-white">
                Follow Packs
              </h1>
              <p className="text-lg text-cyan-100/60 max-w-sm mx-auto leading-relaxed">
                Curate and share lists of the best people on Nostr.
              </p>
            </div>

            {/* Login with Primal */}
            <div className="space-y-5 pt-2">
              <LoginWithPrimal className="w-full" />

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                <span className="text-xs text-white/30 uppercase tracking-widest font-medium">or</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              </div>

              <LoginArea className="flex justify-center" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 left-0 right-0 text-center">
          <p className="text-xs text-white/20">
            Vibed with{' '}
            <a href="https://shakespeare.diy" className="text-white/30 hover:text-white/50 transition-colors underline underline-offset-2">Shakespeare</a>
          </p>
        </div>
      </div>
    );
  }

  // ── Published success ──
  if (published) {
    return (
      <div className="min-h-screen gradient-bg-hero relative overflow-hidden">
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative z-10 max-w-lg mx-auto px-5 py-24">
          <div className="text-center space-y-6 animate-fade-in-up">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/15 border border-emerald-400/20">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Published!</h1>
            <p className="text-cyan-100/60 text-lg max-w-md mx-auto">
              Your Follow Pack <span className="text-white font-semibold">&ldquo;{name}&rdquo;</span> with {entries.length} user{entries.length > 1 ? 's' : ''} is now live on Nostr.
            </p>
            <div className="pt-4">
              <Button onClick={handleCreateAnother} variant="outline" size="lg" className="border-white/15 text-white hover:bg-white/10">
                Create Another
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main create form ──
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-sky-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Users className="w-[18px] h-[18px] text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Follow Packs</h1>
          </div>
          <LoginArea className="max-w-60" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24 space-y-7">
        {/* Title */}
        <div className="space-y-1 pt-1">
          <h2 className="text-2xl font-bold tracking-tight">Create Follow Pack</h2>
          <p className="text-muted-foreground">Curate a list of Nostr users to share with the world.</p>
        </div>

        {/* Pack Details */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pack-name" className="text-sm font-medium">
                Pack Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pack-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Nostr Developers, Bitcoin Educators..."
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pack-desc" className="text-sm font-medium">Description</Label>
              <Textarea
                id="pack-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this Follow Pack about?"
                className="min-h-[80px] resize-none rounded-xl"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Cover Image</Label>
              {coverImageUrl ? (
                <div className="relative group rounded-2xl overflow-hidden border">
                  <img src={coverImageUrl} alt="Cover preview" className="w-full h-44 object-cover" onError={() => { setCoverImageUrl(''); }} />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  <button type="button" onClick={() => setCoverImageUrl('')} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/80 hover:scale-110">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                  className="w-full h-36 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/[0.03] transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground group">
                  {isUploading ? (
                    <><Loader2 className="w-7 h-7 animate-spin text-primary" /><span className="text-sm">Uploading...</span></>
                  ) : (
                    <><ImagePlus className="w-7 h-7 group-hover:text-primary transition-colors" /><span className="text-sm">Click to upload a cover image</span></>
                  )}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>
          </div>
        </div>

        {/* Add Users */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-sky-500 flex items-center justify-center shadow-sm">
                    <Users className="w-3.5 h-3.5 text-white" />
                  </div>
                  Add Users
                </h3>
                <p className="text-sm text-muted-foreground">Search for Nostr users or paste npubs.</p>
              </div>
              {entries.length > 0 && (
                <Badge className="text-sm px-3 py-1 font-semibold bg-gradient-to-r from-cyan-500 to-sky-500 text-white border-0 shadow-sm">
                  {entries.length}
                </Badge>
              )}
            </div>

            {/* Search bar */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchSubmit(); } }}
                    placeholder="Search by username or paste npub..."
                    className="pl-10 h-11 rounded-xl"
                  />
                  {isSearching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />}
                </div>
                <Button onClick={handleSearchSubmit} disabled={isSearching || !searchQuery.trim()} className="h-11 px-5 rounded-xl">
                  Search
                </Button>
              </div>

              {/* Search dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-card border rounded-2xl shadow-xl overflow-hidden glow">
                  <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
                    {searchResults.map((result) => (
                      <SearchResultItem key={result.pubkey} result={result} isAdded={entries.some((e) => e.pubkey === result.pubkey)} onAdd={() => handleAddSearchResult(result)} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bulk paste toggle */}
            <button type="button" onClick={() => setShowBulkInput(!showBulkInput)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group">
              <ClipboardPaste className="w-4 h-4 group-hover:text-primary transition-colors" />
              <span>Paste multiple npubs at once</span>
              {showBulkInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showBulkInput && (
              <div className="space-y-3 rounded-xl border border-dashed p-4 bg-muted/30 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
                <Textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} placeholder={`npub1abc...\nnpub1def...\nnpub1ghi...`} className="min-h-[100px] font-mono text-sm resize-none rounded-xl" />
                <div className="flex items-center gap-3">
                  <Button onClick={handleAddNpubs} disabled={!bulkInput.trim()} size="sm" className="gap-2 rounded-lg">
                    <Upload className="w-3.5 h-3.5" /> Add to Pack
                  </Button>
                  <span className="text-xs text-muted-foreground">Supports npub, nprofile, hex, nostr: URIs</span>
                </div>
              </div>
            )}

            {parseErrors.length > 0 && (
              <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive"><AlertCircle className="w-4 h-4" />Could not parse:</div>
                <div className="text-xs text-destructive/80 font-mono break-all">{parseErrors.join(', ')}</div>
              </div>
            )}

            <Separator />

            {/* User list */}
            <div className="space-y-1">
              {entries.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <Users className="w-7 h-7 text-muted-foreground/30" />
                  </div>
                  <p className="text-muted-foreground text-sm">No users added yet. Search or paste npubs above.</p>
                </div>
              ) : (
                entries.map((entry, index) => (
                  <div key={entry.pubkey} className="group flex items-center gap-1.5 rounded-xl border border-transparent hover:border-border hover:bg-accent/40 px-2 py-1 transition-all">
                    <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button type="button" onClick={() => handleMove(index, 'up')} disabled={index === 0} className="text-muted-foreground hover:text-primary disabled:opacity-20 p-0.5"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => handleMove(index, 'down')} disabled={index === entries.length - 1} className="text-muted-foreground hover:text-primary disabled:opacity-20 p-0.5"><ChevronDown className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex-1 min-w-0"><UserCard pubkey={entry.pubkey} compact /></div>
                    <button type="button" onClick={() => handleRemove(entry.pubkey)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Publish */}
        <div className="flex justify-end pt-2">
          <Button onClick={handlePublish} disabled={isPublishing || !name.trim() || entries.length === 0} size="lg"
            className="px-8 gap-2.5 text-base font-semibold rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-400/35 transition-all active:scale-[0.98] border-0">
            {isPublishing ? (
              <><Loader2 className="w-5 h-5 animate-spin" />Publishing...</>
            ) : (
              <>Publish Follow Pack</>
            )}
          </Button>
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

function SearchResultItem({ result, isAdded, onAdd }: { result: UserSearchResult; isAdded: boolean; onAdd: () => void }) {
  const displayName = result.metadata?.display_name || result.metadata?.name || 'Unknown';
  const npub = nip19.npubEncode(result.pubkey);
  const shortNpub = `${npub.slice(0, 12)}...${npub.slice(-6)}`;

  return (
    <button type="button" onClick={onAdd} disabled={isAdded}
      className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left disabled:opacity-50">
      <Avatar className="w-10 h-10 shrink-0 border border-border/50">
        <AvatarImage src={result.metadata?.picture} alt={displayName} />
        <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-cyan-500/10 to-sky-500/10 text-primary">
          {displayName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground font-mono truncate">{result.metadata?.nip05 || shortNpub}</p>
      </div>
      {isAdded ? (
        <Badge variant="secondary" className="text-xs shrink-0">Added</Badge>
      ) : (
        <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/15 to-sky-500/15 flex items-center justify-center text-primary hover:from-cyan-500/25 hover:to-sky-500/25 transition-colors">
          <Plus className="w-4 h-4" />
        </div>
      )}
    </button>
  );
}
