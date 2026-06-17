import { type NLoginType, NUser, useNostrLogin } from '@nostrify/react/login';
import { NConnectSigner, NSecSigner } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { nip19 } from 'nostr-tools';
import { useCallback, useMemo } from 'react';

import { useAuthor } from './useAuthor.ts';

export function useCurrentUser() {
  const { nostr } = useNostr();
  const { logins } = useNostrLogin();

  const loginToUser = useCallback((login: NLoginType): NUser  => {
    switch (login.type) {
      case 'nsec': // Nostr login with secret key
        return NUser.fromNsecLogin(login);
      case 'bunker': {
        // Manually reconstruct the NConnectSigner instead of using
        // NUser.fromBunkerLogin, which has a bug: it passes login.pubkey
        // (the user's pubkey) to NConnectSigner instead of login.data.bunkerPubkey
        // (the remote signer's pubkey). This causes signing requests to be
        // addressed to the wrong pubkey, so the remote signer never sees them.
        const decoded = nip19.decode(login.data.clientNsec);
        if (decoded.type !== 'nsec') throw new Error('Invalid client nsec');
        const clientSigner = new NSecSigner(decoded.data);
        const relayGroup = nostr.group(login.data.relays);
        const signer = new NConnectSigner({
          relay: relayGroup,
          pubkey: login.data.bunkerPubkey, // ← correct: the remote signer's pubkey
          signer: clientSigner,
          timeout: 60_000,
        });
        return new NUser(login.type, login.pubkey, signer);
      }
      case 'extension': // Nostr login with NIP-07 browser extension
        return NUser.fromExtensionLogin(login);
      // Other login types can be defined here
      default:
        throw new Error(`Unsupported login type: ${login.type}`);
    }
  }, [nostr]);

  const users = useMemo(() => {
    const users: NUser[] = [];

    for (const login of logins) {
      try {
        const user = loginToUser(login);
        users.push(user);
      } catch (error) {
        console.warn('Skipped invalid login', login.id, error);
      }
    }

    return users;
  }, [logins, loginToUser]);

  const user = users[0] as NUser | undefined;
  const author = useAuthor(user?.pubkey);

  return {
    user,
    users,
    ...author.data,
  };
}
