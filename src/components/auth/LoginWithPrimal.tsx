import { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2, ExternalLink, X } from 'lucide-react';
import QRCode from 'qrcode';
import {
  useLoginActions,
  generateNostrConnectParams,
  generateNostrConnectURI,
  type NostrConnectParams,
} from '@/hooks/useLoginActions';

const PRIMAL_LOGO_URL = 'https://blossom.ditto.pub/a34d8fd81dbbf096b96ca8860a17984de4f17daca51cf91aa00eff15ba325f6c.jpeg';

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
  const [nostrConnectUri, setNostrConnectUri] = useState('');
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
    setNostrConnectUri(uri);
    setIsConnecting(true);

    if (isMobile) {
      // On mobile, open the nostrconnect:// URI to launch Primal
      window.location.href = uri;
    } else {
      // On desktop, generate QR code
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

  // Listen for the signer's response
  useEffect(() => {
    if (!connectParams || !isConnecting) return;

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
  }, [connectParams, isConnecting, login, onLogin]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setIsConnecting(false);
    setConnectParams(null);
    setNostrConnectUri('');
    setQrDataUrl('');
    setError(null);
  }, []);

  // Desktop QR code view
  if (isConnecting && !isMobile && qrDataUrl) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center gap-4 p-6 rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <img src={PRIMAL_LOGO_URL} alt="Primal" className="w-6 h-6 rounded-full" />
              <span className="text-sm font-medium text-white/80">Scan with Primal</span>
            </div>
            <button onClick={handleCancel} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-xl overflow-hidden shadow-2xl">
            <img src={qrDataUrl} alt="QR Code" className="w-56 h-56" />
          </div>

          <div className="flex items-center gap-2 text-sm text-white/40">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Waiting for connection...</span>
          </div>
        </div>
        {error && <p className="text-xs text-red-400 text-center mt-2">{error}</p>}
      </div>
    );
  }

  // Mobile waiting state
  if (isConnecting && isMobile) {
    return (
      <div className={className}>
        <button
          onClick={handleCancel}
          className="w-full h-14 px-6 rounded-2xl flex items-center justify-center gap-3 font-semibold text-[15px] transition-all"
          style={{
            background: 'linear-gradient(135deg, #a855f7, #c084fc, #e879f9)',
            boxShadow: '0 8px 32px rgba(168, 85, 247, 0.35)',
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
          background: 'linear-gradient(135deg, #a855f7, #c084fc, #e879f9)',
          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
        }}
      >
        <img src={PRIMAL_LOGO_URL} alt="Primal" className="w-7 h-7 rounded-full shadow-lg" />
        <span>Log in with Primal</span>
        {isMobile && <ExternalLink className="w-4 h-4 opacity-50" />}
      </button>
      {error && <p className="text-xs text-red-400 text-center mt-2">{error}</p>}
    </div>
  );
}
