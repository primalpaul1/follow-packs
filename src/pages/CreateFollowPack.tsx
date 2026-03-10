import { useState, useCallback, useRef } from 'react';
import { useSeoMeta } from '@unhead/react';
import { nip19 } from 'nostr-tools';
import { Users, ImagePlus, X, GripVertical, Upload, Loader2, ClipboardPaste, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useToast } from '@/hooks/useToast';
import { LoginArea } from '@/components/auth/LoginArea';
import { UserCard } from '@/components/UserCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

/** The exact kind used by following.space for Follow Packs */
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
  // Split by newlines, commas, spaces, tabs
  const tokens = text
    .split(/[\n\r,\s\t]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const valid: ParsedEntry[] = [];
  const invalid: string[] = [];
  const seenPubkeys = new Set<string>();

  for (const token of tokens) {
    // Strip nostr: prefix if present
    const cleaned = token.replace(/^nostr:/, '');

    try {
      const decoded = nip19.decode(cleaned);

      let pubkey: string | null = null;

      if (decoded.type === 'npub') {
        pubkey = decoded.data;
      } else if (decoded.type === 'nprofile') {
        pubkey = decoded.data.pubkey;
      }

      if (pubkey && !seenPubkeys.has(pubkey)) {
        seenPubkeys.add(pubkey);
        valid.push({ pubkey, npub: nip19.npubEncode(pubkey) });
      }
    } catch {
      // Check if it's a 64-char hex pubkey
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
    title: 'Create Follow Pack',
    description: 'Create a new Nostr Follow Pack to share your favorite people with the world.',
  });

  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent, isPending: isPublishing } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [bulkInput, setBulkInput] = useState('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [published, setPublished] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle cover image upload
  const handleCoverUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const tags = await uploadFile(file);
      const url = tags[0]?.[1];
      if (url) {
        setCoverImageUrl(url);
        toast({ title: 'Image uploaded', description: 'Your cover image has been uploaded.' });
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast({ title: 'Upload failed', description: 'Could not upload the image. Try again.', variant: 'destructive' });
    }
  }, [uploadFile, toast]);

  // Parse and add npubs from bulk input
  const handleAddNpubs = useCallback(() => {
    if (!bulkInput.trim()) return;

    const { valid, invalid } = parseNpubsFromText(bulkInput);

    // Filter out pubkeys already in entries
    const existingPubkeys = new Set(entries.map((e) => e.pubkey));
    const newEntries = valid.filter((v) => !existingPubkeys.has(v.pubkey));

    if (newEntries.length > 0) {
      setEntries((prev) => [...prev, ...newEntries]);
    }

    setParseErrors(invalid);
    setBulkInput('');

    const added = newEntries.length;
    const dupes = valid.length - newEntries.length;

    if (added > 0) {
      toast({
        title: `${added} user${added > 1 ? 's' : ''} added`,
        description: dupes > 0 ? `${dupes} duplicate${dupes > 1 ? 's' : ''} skipped.` : undefined,
      });
    } else if (dupes > 0) {
      toast({ title: 'All duplicates', description: 'Those users are already in your list.' });
    }

    if (invalid.length > 0) {
      toast({
        title: `${invalid.length} invalid entr${invalid.length > 1 ? 'ies' : 'y'}`,
        description: 'Some items could not be parsed as valid npubs.',
        variant: 'destructive',
      });
    }
  }, [bulkInput, entries, toast]);

  // Remove an entry
  const handleRemove = useCallback((pubkey: string) => {
    setEntries((prev) => prev.filter((e) => e.pubkey !== pubkey));
  }, []);

  // Move entry in list
  const handleMove = useCallback((index: number, direction: 'up' | 'down') => {
    setEntries((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  // Publish the follow pack
  const handlePublish = useCallback(async () => {
    if (!name.trim()) {
      toast({ title: 'Name required', description: 'Please give your Follow Pack a name.', variant: 'destructive' });
      return;
    }
    if (entries.length === 0) {
      toast({ title: 'Add users', description: 'Add at least one user to your Follow Pack.', variant: 'destructive' });
      return;
    }

    const id = generateId();

    const tags: string[][] = [
      ['title', name.trim()],
      ['d', id],
    ];

    if (coverImageUrl) {
      tags.push(['image', coverImageUrl]);
    }

    if (description.trim()) {
      tags.push(['description', description.trim()]);
    }

    // Add each pubkey as a p tag
    for (const entry of entries) {
      tags.push(['p', entry.pubkey]);
    }

    try {
      await publishEvent({
        kind: FOLLOW_LIST_KIND,
        content: '',
        tags,
        created_at: Math.floor(Date.now() / 1000),
      });

      setPublished(true);
      toast({
        title: 'Follow Pack published!',
        description: `"${name.trim()}" with ${entries.length} user${entries.length > 1 ? 's' : ''} is now live.`,
      });
    } catch (err) {
      console.error('Publish error:', err);
      toast({ title: 'Publish failed', description: 'Something went wrong. Try again.', variant: 'destructive' });
    }
  }, [name, description, coverImageUrl, entries, publishEvent, toast]);

  // Handle paste shortcut in textarea
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      // Let it paste normally, the user will click "Add" to process
    }
  }, []);

  // Reset to create another
  const handleCreateAnother = useCallback(() => {
    setName('');
    setDescription('');
    setCoverImageUrl('');
    setEntries([]);
    setBulkInput('');
    setParseErrors([]);
    setPublished(false);
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-20">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-2">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Create a Follow Pack</h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Log in with your Nostr identity to create and share Follow Packs.
            </p>
            <LoginArea className="flex justify-center" />
          </div>
        </div>
      </div>
    );
  }

  if (published) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-20">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-green-500/10 mb-2">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Published!</h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Your Follow Pack <strong>"{name}"</strong> with {entries.length} user{entries.length > 1 ? 's' : ''} has been published to the Nostr network.
            </p>
            <div className="flex justify-center gap-3 pt-4">
              <Button onClick={handleCreateAnother} variant="outline" size="lg">
                Create Another
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Follow Pack</h1>
          </div>
          <LoginArea className="max-w-60" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 space-y-8">
        {/* Title Section */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Create Follow Pack</h2>
          <p className="text-muted-foreground">
            Curate a list of Nostr users to share with the world.
          </p>
        </div>

        {/* Pack Details Card */}
        <Card className="overflow-hidden border-border/60 shadow-sm">
          <CardContent className="p-6 space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="pack-name" className="text-sm font-medium">
                Pack Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pack-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Nostr Developers, Bitcoin Educators..."
                className="h-11"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="pack-desc" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="pack-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this Follow Pack about?"
                className="min-h-[80px] resize-none"
              />
            </div>

            {/* Cover Image */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Cover Image</Label>

              {coverImageUrl ? (
                <div className="relative group rounded-xl overflow-hidden border">
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="w-full h-44 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                      setCoverImageUrl('');
                      toast({ title: 'Image error', description: 'Could not load the image.', variant: 'destructive' });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setCoverImageUrl('')}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full h-36 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.02] transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin text-primary" />
                      <span className="text-sm">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="w-7 h-7" />
                      <span className="text-sm">Click to upload a cover image</span>
                    </>
                  )}
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverUpload}
              />
            </div>
          </CardContent>
        </Card>

        {/* Add Users Section */}
        <Card className="overflow-hidden border-border/60 shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <ClipboardPaste className="w-5 h-5 text-primary" />
                  Add Users
                </h3>
                <p className="text-sm text-muted-foreground">
                  Paste multiple npubs at once — separated by newlines, commas, or spaces.
                </p>
              </div>
              {entries.length > 0 && (
                <Badge variant="secondary" className="text-sm px-3 py-1 font-medium">
                  {entries.length} user{entries.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="space-y-3">
              <Textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                onPaste={handlePaste}
                placeholder={`npub1abc123...\nnpub1def456...\nnpub1ghi789...`}
                className="min-h-[120px] font-mono text-sm resize-none"
              />
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleAddNpubs}
                  disabled={!bulkInput.trim()}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Add to Pack
                </Button>
                <span className="text-xs text-muted-foreground">
                  Supports npub, nprofile, hex pubkeys, and nostr: URIs
                </span>
              </div>
            </div>

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  Could not parse:
                </div>
                <div className="text-xs text-destructive/80 font-mono break-all">
                  {parseErrors.map((err, i) => (
                    <span key={i}>
                      {err}
                      {i < parseErrors.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Selected users list */}
            <div className="space-y-2">
              {entries.length === 0 ? (
                <div className="py-10 text-center">
                  <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">
                    No users added yet. Paste npubs above to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {entries.map((entry, index) => (
                    <div
                      key={entry.pubkey}
                      className="group flex items-center gap-2 rounded-lg border border-transparent hover:border-border hover:bg-accent/30 px-2 py-1 transition-all"
                    >
                      <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleMove(index, 'up')}
                          disabled={index === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                        >
                          <GripVertical className="w-3.5 h-3.5 rotate-0" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <UserCard pubkey={entry.pubkey} compact />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(entry.pubkey)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Publish Button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handlePublish}
            disabled={isPublishing || !name.trim() || entries.length === 0}
            size="lg"
            className="px-8 gap-2 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Publish Follow Pack
              </>
            )}
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center pt-8">
          <p className="text-xs text-muted-foreground">
            Vibed with{' '}
            <a
              href="https://shakespeare.diy"
              className="text-primary/70 hover:text-primary transition-colors underline underline-offset-2"
            >
              Shakespeare
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
