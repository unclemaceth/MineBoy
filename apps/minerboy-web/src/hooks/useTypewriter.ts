import { useEffect, useRef, useState } from "react";

export function useTypewriter(
  lines: string[],
  speedMs = 18,
  linePauseMs = 180,
  onComplete?: () => void
) {
  const [displayLines, setDisplayLines] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const posRef = useRef({ li: 0, ci: 0 });
  const timerRef = useRef<number | null>(null);
  const onCompleteRef = useRef<typeof onComplete>(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // reset
    posRef.current = { li: 0, ci: 0 };
    setIsComplete(false);
    setDisplayLines(lines.length ? [""] : []);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // no lines → finish once and bail
    if (lines.length === 0) {
      setIsComplete(true);
      onCompleteRef.current?.();
      return;
    }

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const { li, ci } = posRef.current;
      const line = lines[li];
      if (!line) return;

      if (ci < line.length) {
        // type next char
        setDisplayLines(prev => {
          const next = prev.slice();
          next[li] = line.slice(0, ci + 1);
          return next;
        });
        posRef.current.ci = ci + 1;
        timerRef.current = window.setTimeout(tick, speedMs);
      } else if (li < lines.length - 1) {
        // move to next line
        posRef.current = { li: li + 1, ci: 0 };
        setDisplayLines(prev => [...prev, ""]);
        timerRef.current = window.setTimeout(tick, linePauseMs);
      } else {
        // all done
        setIsComplete(true);
        onCompleteRef.current?.();
      }
    };

    timerRef.current = window.setTimeout(tick, speedMs);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    // depend on content, not identity; and timing params
  }, [JSON.stringify(lines), speedMs, linePauseMs]);

  return { displayLines, isComplete };
}
