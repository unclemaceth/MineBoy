import { useCallback, useMemo } from 'react';
import { useConnect } from 'wagmi';

type DisplayUriHandler = (uri: string) => void;

export function useWalletConnect() {
  const { connect, connectors } = useConnect();

  // grab the actual connector instance, not the factory
  const wc = useMemo(
    () =>
      connectors.find(
        (c) => c.id === 'walletConnect' || /walletconnect/i.test(c.name)
      ),
    [connectors]
  );

  // listen for WalletConnect provider's "display_uri" event
  const attachDisplayUri = useCallback(
    (onUri: DisplayUriHandler) => {
      let cleanup: (() => void) | undefined;

      (async () => {
        try {
          // some versions expose getProvider; cast to any to avoid type drama
          const provider: any = await (wc as any)?.getProvider?.();
          if (!provider) return;

          const handler = (uri: string) => onUri(uri);
          const on = provider.on || provider.addListener;
          const off = provider.off || provider.removeListener;

          on?.call(provider, 'display_uri', handler);
          cleanup = () => off?.call(provider, 'display_uri', handler);
        } catch {
          /* no-op */
        }
      })();

      return () => cleanup?.();
    },
    [wc]
  );

  // connect via wagmi's connect() (requires an argument)
  const connectWalletConnect = useCallback(
    (chainId?: number) => {
      if (!wc) throw new Error('WalletConnect connector not found');
      return connect({ connector: wc, chainId });
    },
    [connect, wc]
  );

  return { wcConnector: wc, attachDisplayUri, connectWalletConnect };
}
