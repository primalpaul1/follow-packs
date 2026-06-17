import { useNostr } from "@nostrify/react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";
import { useAppContext } from "./useAppContext";

import type { NostrEvent } from "@nostrify/nostrify";

export function useNostrPublish(): UseMutationResult<NostrEvent> {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config } = useAppContext();

  return useMutation({
    mutationFn: async (t: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>) => {
      if (user) {
        const tags = t.tags ?? [];

        // Add the client tag if it doesn't exist
        if (location.protocol === "https:" && !tags.some(([name]) => name === "client")) {
          tags.push(["client", location.hostname]);
        }

        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        // Publish to each write relay individually so one dead relay
        // doesn't block the entire publish via Promise.all rejection.
        const writeRelays = config.relayMetadata.relays
          .filter((r) => r.write)
          .map((r) => r.url);

        const results = await Promise.allSettled(
          writeRelays.map((url) =>
            nostr.relay(url).event(event, { signal: AbortSignal.timeout(5000) }),
          ),
        );

        const succeeded = results.filter((r) => r.status === 'fulfilled').length;
        if (succeeded === 0) {
          throw new Error('Failed to publish to any relay');
        }

        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          console.warn(`Published to ${succeeded}/${writeRelays.length} relays (${failed} failed)`);
        }

        return event;
      } else {
        throw new Error("User is not logged in");
      }
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);
    },
  });
}