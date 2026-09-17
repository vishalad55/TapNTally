import { useEffect, useRef, useState } from 'react';

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

/**
 * Tweens a number toward `target` with requestAnimationFrame and returns the
 * current value as state. Used where React Native's Animated can't reach —
 * SVG path geometry and text content — and works identically on web.
 */
export function useTween(target: number, duration = 420): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    if (origin === target) return;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const v = origin + (target - origin) * easeOutCubic(p);
      from.current = v;
      setValue(v);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return value;
}

/** 0 → 1 once on mount (draw-in progress). */
export function useMountProgress(duration = 700): number {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return useTween(go ? 1 : 0, duration);
}

/** Integer count-up for money displays. */
export function useCountUp(value: number, duration = 650): number {
  return Math.round(useTween(value, duration));
}
