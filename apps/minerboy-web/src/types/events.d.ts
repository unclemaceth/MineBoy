declare global {
  interface WindowEventMap {
    'walletconnect_display_uri': CustomEvent<{ uri: string }>;
  }
}
export {};
