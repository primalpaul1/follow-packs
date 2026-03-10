import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { Button } from '@/components/ui/button';
import { useLoginActions, type NostrConnectParams } from '@/hooks/useLoginActions';
import { NOSTR_CONNECT_PARAMS_KEY } from '@/components/auth/LoginWithPrimal';

/**
 * This page is the callback target after a mobile NIP-46 nostrconnect flow.
 *
 * What happens:
 * 1. Original tab: user taps "Log in with Primal" → params are saved to localStorage → navigates to nostrconnect:// URI
 * 2. Primal opens, user approves → Primal sends kind 24133 response to relay → redirects browser to this callback URL
 * 3. This page: reads the saved params from localStorage → listens on relay for the kind 24133 response → completes login
 * 4. After login completes, redirects to home
 */
export function RemoteLoginSuccess() {
  const navigate = useNavigate();
  const login = useLoginActions();
  const [status, setStatus] = useState<'connecting' | 'success' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const attemptedRef = useRef(false);

  useEffect(() => {
    // Only attempt once
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const completeLogin = async () => {
      // Read the saved connect params from localStorage
      const stored = localStorage.getItem(NOSTR_CONNECT_PARAMS_KEY);
      if (!stored) {
        setStatus('error');
        setErrorMessage('No pending login session found. Please go back and try again.');
        return;
      }

      // Clean up immediately so we don't try again on re-render
      localStorage.removeItem(NOSTR_CONNECT_PARAMS_KEY);

      try {
        const parsed = JSON.parse(stored);

        // Reconstruct the NostrConnectParams (deserialize nsec back to Uint8Array)
        const decoded = nip19.decode(parsed.clientNsec);
        if (decoded.type !== 'nsec') {
          throw new Error('Invalid stored client key');
        }

        const params: NostrConnectParams = {
          clientSecretKey: decoded.data,
          clientPubkey: parsed.clientPubkey,
          secret: parsed.secret,
          relays: parsed.relays,
        };

        // Complete the nostrconnect handshake — this will listen on the relay
        // for the kind 24133 response that Primal already sent
        await login.nostrconnect(params);

        setStatus('success');

        // Redirect to home after brief success animation
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1200);
      } catch (err) {
        console.error('Remote login completion failed:', err);
        setStatus('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to complete login. Please try again.'
        );
      }
    };

    completeLogin();
  }, [login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-sm">
        {status === 'connecting' && (
          <>
            <Loader2 className="w-14 h-14 mx-auto text-primary animate-spin" />
            <h1 className="text-2xl font-bold">Completing Login...</h1>
            <p className="text-muted-foreground text-sm">
              Connecting to your Primal account
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-14 h-14 mx-auto text-emerald-500" />
            <h1 className="text-2xl font-bold">You&apos;re in!</h1>
            <p className="text-muted-foreground text-sm">Redirecting...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-14 h-14 mx-auto text-amber-500" />
            <h1 className="text-2xl font-bold">Connection Issue</h1>
            <p className="text-muted-foreground text-sm">{errorMessage}</p>
            <Button
              onClick={() => navigate('/', { replace: true })}
              size="lg"
              className="mt-4"
            >
              Go Back
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default RemoteLoginSuccess;
