import { useState, useCallback, useEffect } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useLoginActions,
  generateNostrConnectParams,
  generateNostrConnectURI,
  type NostrConnectParams,
} from '@/hooks/useLoginActions';

/** Check if running on actual mobile device */
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Primal purple
const PRIMAL_COLOR = '#6366F1';

interface LoginWithPrimalProps {
  onLogin?: () => void;
  className?: string;
}

export function LoginWithPrimal({ onLogin, className }: LoginWithPrimalProps) {
  const login = useLoginActions();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectParams, setConnectParams] = useState<NostrConnectParams | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isMobile = isMobileDevice();

  // Start the nostrconnect flow
  const handleConnect = useCallback(() => {
    setError(null);
    const relayUrl = login.getRelayUrl();
    const params = generateNostrConnectParams([relayUrl]);
    setConnectParams(params);
    setIsConnecting(true);

    const uri = generateNostrConnectURI(params, 'Follow Packs');

    // On mobile, open the nostrconnect:// URI which triggers Primal (or any signer)
    if (isMobile) {
      window.location.href = uri;
    }
  }, [login, isMobile]);

  // Listen for the signer's response once params are generated
  useEffect(() => {
    if (!connectParams || !isConnecting) return;

    let cancelled = false;

    const listenForConnection = async () => {
      try {
        await login.nostrconnect(connectParams);
        if (!cancelled) {
          onLogin?.();
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Nostrconnect failed:', err);
          setError(err instanceof Error ? err.message : 'Connection failed');
          setIsConnecting(false);
          setConnectParams(null);
        }
      }
    };

    listenForConnection();

    return () => {
      cancelled = true;
    };
  }, [connectParams, isConnecting, login, onLogin]);

  // Cancel connection
  const handleCancel = useCallback(() => {
    setIsConnecting(false);
    setConnectParams(null);
    setError(null);
  }, []);

  if (isConnecting) {
    return (
      <div className={className}>
        <Button
          variant="outline"
          size="lg"
          className="w-full gap-3 h-12 border-2 relative overflow-hidden"
          style={{ borderColor: `${PRIMAL_COLOR}30` }}
          onClick={handleCancel}
        >
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: PRIMAL_COLOR }} />
          <span className="text-sm font-medium">Waiting for Primal...</span>
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          {isMobile ? 'Approve in Primal, then return here' : 'Open Primal on your phone and approve'}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Button
        onClick={handleConnect}
        size="lg"
        className="w-full gap-3 h-12 text-white font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
        style={{
          background: `linear-gradient(135deg, ${PRIMAL_COLOR}, #8B5CF6)`,
        }}
      >
        <PrimalLogo />
        Log in with Primal
        {isMobile && <ExternalLink className="w-4 h-4 opacity-60" />}
      </Button>
      {error && (
        <p className="text-xs text-destructive text-center mt-2">{error}</p>
      )}
    </div>
  );
}

function PrimalLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M64 16C37.5 16 16 37.5 16 64C16 90.5 37.5 112 64 112C90.5 112 112 90.5 112 64C112 37.5 90.5 16 64 16ZM80 72C80 76.4 76.4 80 72 80H56C51.6 80 48 76.4 48 72V56C48 51.6 51.6 48 56 48H72C76.4 48 80 51.6 80 56V72Z"
        fill="currentColor"
      />
    </svg>
  );
}
