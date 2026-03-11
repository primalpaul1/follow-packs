import { nip19 } from 'nostr-tools';
import { useParams } from 'react-router-dom';
import NotFound from './NotFound';
import { PackDetail } from '@/components/PackDetail';

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  if (!identifier) {
    return <NotFound />;
  }

  let decoded;
  try {
    decoded = nip19.decode(identifier);
  } catch {
    return <NotFound />;
  }

  const { type } = decoded;

  switch (type) {
    case 'npub':
    case 'nprofile':
      // AI agent should implement profile view here
      return <div>Profile placeholder</div>;

    case 'note':
      // AI agent should implement note view here
      return <div>Note placeholder</div>;

    case 'nevent':
      // AI agent should implement event view here
      return <div>Event placeholder</div>;

    case 'naddr': {
      const { pubkey, identifier: dTag, kind } = decoded.data;
      if (kind === 39089) {
        return <PackDetail pubkey={pubkey} identifier={dTag} />;
      }
      return <div>Unsupported event kind</div>;
    }

    default:
      return <NotFound />;
  }
}
