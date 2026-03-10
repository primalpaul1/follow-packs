import { useMutation } from "@tanstack/react-query";
import { BlossomUploader } from '@nostrify/nostrify/uploaders';

import { useCurrentUser } from "./useCurrentUser";

export function useUploadFile() {
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) {
        throw new Error('Must be logged in to upload files');
      }

      // Try multiple Blossom servers for reliability.
      // NIP-46 signers (Primal bunker) may be slower to sign,
      // so we try servers that are more tolerant of timing.
      const servers = [
        'https://blossom.primal.net/',
        'https://nostr.download/',
      ];

      let lastError: Error | null = null;

      for (const server of servers) {
        try {
          const uploader = new BlossomUploader({
            servers: [server],
            signer: user.signer,
          });

          const tags = await uploader.upload(file);
          return tags;
        } catch (err) {
          console.warn(`Blossom upload to ${server} failed:`, err);
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }

      throw lastError ?? new Error('Upload failed on all servers');
    },
  });
}
