// src/debug/TextGuard.ts
// Only in dev: log when something renders a <text> element (illegal in HTML).
if (process.env.NODE_ENV !== 'production') {
  try {
    const origCreate = document.createElement;
    document.createElement = new Proxy(origCreate, {
      apply(target, thisArg, args: any[]) {
        const tag = String(args?.[0] ?? '');
        if (tag.toLowerCase() === 'text') {
          // eslint-disable-next-line no-console
          console.error(
            '[TextGuard] document.createElement("text") called!',
            new Error().stack
          );
        }
        return Reflect.apply(target, thisArg, args as any);
      }
    });
  } catch {}
  try {
    // Extra safety: catch React-level createElement usage with "text"
    // We import React dynamically to avoid bundling issues
    import('react').then((React) => {
      const _create = React.createElement;
      // @ts-expect-error patch for debug only
      React.createElement = (...args: any[]) => {
        const tag = args[0];
        if (typeof tag === 'string' && tag.toLowerCase() === 'text') {
          // eslint-disable-next-line no-console
          console.error(
            '[TextGuard] React.createElement("text")!',
            new Error().stack
          );
        }
        // @ts-expect-error pass-through
        return _create(...args);
      };
    });
  } catch {}
}
