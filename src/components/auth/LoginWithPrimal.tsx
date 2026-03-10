import { useState, useCallback, useEffect } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useLoginActions,
  generateNostrConnectParams,
  generateNostrConnectURI,
  type NostrConnectParams,
} from '@/hooks/useLoginActions';

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

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

  const handleConnect = useCallback(() => {
    setError(null);
    const relayUrl = login.getRelayUrl();
    const params = generateNostrConnectParams([relayUrl]);
    setConnectParams(params);
    setIsConnecting(true);
    const uri = generateNostrConnectURI(params, 'Follow Packs');
    if (isMobile) window.location.href = uri;
  }, [login, isMobile]);

  useEffect(() => {
    if (!connectParams || !isConnecting) return;
    let cancelled = false;
    const listenForConnection = async () => {
      try {
        await login.nostrconnect(connectParams);
        if (!cancelled) onLogin?.();
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
    return () => { cancelled = true; };
  }, [connectParams, isConnecting, login, onLogin]);

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
          className="w-full gap-3 h-13 rounded-2xl border-cyan-400/20 bg-cyan-400/5 hover:bg-cyan-400/10 transition-all"
          onClick={handleCancel}
        >
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span className="text-sm font-medium text-cyan-300">Waiting for Primal...</span>
        </Button>
        <p className="text-xs text-white/30 text-center mt-2.5">
          {isMobile ? 'Approve in Primal, then return here' : 'Open Primal on your phone and approve'}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        onClick={handleConnect}
        className="w-full h-13 px-6 rounded-2xl flex items-center justify-center gap-3 text-white font-semibold text-[15px] transition-all active:scale-[0.98] hover:shadow-2xl hover:shadow-cyan-500/20"
        style={{
          background: 'linear-gradient(135deg, #06b6d4, #0ea5e9, #38bdf8)',
          boxShadow: '0 8px 32px rgba(14, 165, 233, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      >
        <PrimalLogo />
        <span>Log in with Primal</span>
        {isMobile && <ExternalLink className="w-4 h-4 opacity-50" />}
      </button>
      {error && <p className="text-xs text-red-400 text-center mt-2">{error}</p>}
    </div>
  );
}

function PrimalLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M64 16C37.5 16 16 37.5 16 64C16 90.5 37.5 112 64 112C90.5 112 112 90.5 112 64C112 37.5 90.5 16 64 16ZM80 72C80 76.4 76.4 80 72 80H56C51.6 80 48 76.4 48 72V56C48 51.6 51.6 48 56 48H72C76.4 48 80 51.6 80 56V72Z"
        fill="currentColor"
      />
    </svg>
  );
}
