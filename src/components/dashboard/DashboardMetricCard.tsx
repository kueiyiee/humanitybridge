import { useEffect, useRef, useState, type ReactNode } from 'react';

type MetricTone = 'neutral' | 'attention' | 'success' | 'finance';

interface DashboardMetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  tone?: MetricTone;
  actionLabel?: string;
  onClick?: () => void;
}

const toneStyles: Record<MetricTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  attention: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  success: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200',
  finance: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
};

const cardStyles = 'hb-metric-card group min-w-0 rounded-2xl border border-slate-200 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-[#171b1e]/90 dark:hover:border-slate-700 sm:p-5';

function AnimatedMetricValue({ value }: { value: ReactNode }) {
  const source = typeof value === 'string' ? value : null;
  const match = source?.match(/^([^0-9-]*)(-?[\d,]+(?:\.\d+)?)([^0-9]*)$/);
  const target = match ? Number(match[2].replaceAll(',', '')) : null;
  const prefix = match?.[1] ?? '';
  const suffix = match?.[3] ?? '';
  const decimals = match?.[2].split('.')[1]?.length ?? 0;
  const currentValue = useRef(0);
  const [displayValue, setDisplayValue] = useState<ReactNode>(() => (
    target === null
      ? value
      : `${prefix}${new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals }).format(0)}${suffix}`
  ));

  useEffect(() => {
    if (target === null || !Number.isFinite(target)) {
      setDisplayValue(value);
      return;
    }

    const format = (number: number) => (
      `${prefix}${new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals }).format(number)}${suffix}`
    );
    const startValue = currentValue.current;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (prefersReducedMotion || startValue === target) {
      currentValue.current = target;
      setDisplayValue(format(target));
      return;
    }

    let frame = 0;
    let startTime = 0;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / 560, 1);
      const eased = 1 - (1 - progress) ** 3;
      const next = startValue + (target - startValue) * eased;
      currentValue.current = next;
      setDisplayValue(format(next));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
      else currentValue.current = target;
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [decimals, prefix, suffix, target, value]);

  return <>{displayValue}</>;
}

export function DashboardMetricCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  actionLabel,
  onClick,
}: DashboardMetricCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-400">{label}</p>
        <span className={`hb-metric-icon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneStyles[tone]}`} aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="mt-4 truncate font-mono-tabular text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
        <AnimatedMetricValue value={value} />
      </p>
      {hint && <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{hint}</p>}
      {onClick && actionLabel && (
        <span className="hb-metric-action mt-3 inline-flex text-xs font-semibold text-[var(--hb-accent-strong)] group-hover:underline dark:text-cyan-300">
          {actionLabel}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${cardStyles} w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hb-accent)]`}
      >
        {content}
      </button>
    );
  }

  return <article className={cardStyles}>{content}</article>;
}
