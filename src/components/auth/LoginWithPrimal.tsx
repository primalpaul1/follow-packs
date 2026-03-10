import { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2, ExternalLink, X } from 'lucide-react';
import QRCode from 'qrcode';
import { nip19 } from 'nostr-tools';
import {
  useLoginActions,
  generateNostrConnectParams,
  generateNostrConnectURI,
  type NostrConnectParams,
} from '@/hooks/useLoginActions';

const PRIMAL_LOGO_URL = 'https://blossom.ditto.pub/f25f13c4212c3ca00a1acaa2ee86ed3c053c4469abb71fb84bb6191fde23de97.png';

/** Key used to persist nostrconnect params across mobile navigation */
export const NOSTR_CONNECT_PARAMS_KEY = 'nostr:connect-params';

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Serialize params to JSON-safe object (Uint8Array → nsec) */
function serializeParams(params: NostrConnectParams): string {
  return JSON.stringify({
    clientNsec: nip19.nsecEncode(params.clientSecretKey),
    clientPubkey: params.clientPubkey,
    secret: params.secret,
    relays: params.relays,
  });
}

interface LoginWithPrimalProps {
  onLogin?: () => void;
  className?: string;
}

export function LoginWithPrimal({ onLogin, className }: LoginWithPrimalProps) {
  const login = useLoginActions();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectParams, setConnectParams] = useState<NostrConnectParams | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const isMobile = isMobileDevice();

  const handleConnect = useCallback(async () => {
    setError(null);
    cancelledRef.current = false;
    const relayUrl = login.getRelayUrl();
    const params = generateNostrConnectParams([relayUrl]);
    const uri = generateNostrConnectURI(params, 'Follow Packs');

    setConnectParams(params);
    setIsConnecting(true);

    if (isMobile) {
      // Save params to localStorage so the callback page can complete the handshake.
      // The listener on this page will be destroyed when we navigate away,
      // so RemoteLoginSuccess will pick up these params and finish the connection.
      localStorage.setItem(NOSTR_CONNECT_PARAMS_KEY, serializeParams(params));
      window.location.href = uri;
    } else {
      // On desktop, generate QR code and keep listening here
      try {
        const dataUrl = await QRCode.toDataURL(uri, {
          width: 240,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error('QR generation error:', err);
      }
    }
  }, [login, isMobile]);

  // Listen for the signer's response (desktop only — on mobile the page unloads)
  useEffect(() => {
    if (!connectParams || !isConnecting || isMobile) return;

    const listenForConnection = async () => {
      try {
        await login.nostrconnect(connectParams);
        if (!cancelledRef.current) {
          onLogin?.();
        }
      } catch (err) {
        if (!cancelledRef.current) {
          console.error('Nostrconnect failed:', err);
          setError(err instanceof Error ? err.message : 'Connection failed');
          setIsConnecting(false);
          setConnectParams(null);
          setQrDataUrl('');
        }
      }
    };

    listenForConnection();
  }, [connectParams, isConnecting, isMobile, login, onLogin]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setIsConnecting(false);
    setConnectParams(null);
    setQrDataUrl('');
    setError(null);
    localStorage.removeItem(NOSTR_CONNECT_PARAMS_KEY);
  }, []);

  // Desktop QR code view
  if (isConnecting && !isMobile && qrDataUrl) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center gap-4 p-6 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5">
              <img src={PRIMAL_LOGO_URL} alt="Primal" className="w-7 h-7 rounded-full ring-2 ring-cyan-400/30" />
              <span className="text-sm font-semibold text-white/90">Scan with Primal</span>
            </div>
            <button onClick={handleCancel} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            <img src={qrDataUrl} alt="QR Code" className="w-56 h-56" />
          </div>

          <div className="flex items-center gap-2 text-sm text-cyan-300/50">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Waiting for connection...</span>
          </div>
        </div>
        {error && <p className="text-xs text-red-400 text-center mt-2">{error}</p>}
      </div>
    );
  }

  // Mobile waiting state (shown briefly before navigation)
  if (isConnecting && isMobile) {
    return (
      <div className={className}>
        <button
          onClick={handleCancel}
          className="w-full h-14 px-6 rounded-2xl flex items-center justify-center gap-3 font-semibold text-[15px] transition-all"
          style={{
            background: 'linear-gradient(135deg, #0c4a6e, #0e7490, #06b6d4)',
            boxShadow: '0 8px 32px rgba(6, 182, 212, 0.3)',
          }}
        >
          <Loader2 className="w-5 h-5 animate-spin text-white" />
          <span className="text-white">Waiting for Primal...</span>
        </button>
        <p className="text-xs text-white/30 text-center mt-2.5">
          Approve in Primal, then return here
        </p>
      </div>
    );
  }

  // Default button
  return (
    <div className={className}>
      <button
        onClick={handleConnect}
        className="w-full h-14 px-6 rounded-2xl flex items-center justify-center gap-3.5 text-white font-semibold text-[16px] transition-all active:scale-[0.97] hover:brightness-110"
        style={{
          background: 'linear-gradient(135deg, #0c4a6e, #0e7490, #06b6d4)',
          boxShadow: '0 8px 32px rgba(6, 182, 212, 0.3), inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        <img src={PRIMAL_LOGO_URL} alt="Primal" className="w-8 h-8 rounded-full ring-2 ring-white/20 shadow-lg" />
        <span>Log in with Primal</span>
        {isMobile && <ExternalLink className="w-4 h-4 opacity-50" />}
      </button>
      {error && <p className="text-xs text-red-400 text-center mt-2">{error}</p>}
    </div>
  );
}
