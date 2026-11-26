import { useEffect, useState, type ReactNode } from 'react';
import { animate, m, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';

export const motionTokens = {
  duration: {
    quick: 0.18,
    page: 0.3,
    reveal: 0.48,
    number: 0.72,
  },
  ease: [0.2, 0.75, 0.25, 1] as const,
};

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const reduceMotion = useReducedMotion();

  return (
    <m.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : motionTokens.duration.page, ease: motionTokens.ease }}
    >
      {children}
    </m.div>
  );
}

interface MotionRevealProps extends PageTransitionProps {
  delay?: number;
  trigger?: 'mount' | 'view';
}

export function MotionReveal({
  children,
  className,
  delay = 0,
  trigger = 'view',
}: MotionRevealProps) {
  const reduceMotion = useReducedMotion();
  const visibilityProps = trigger === 'view'
    ? { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.14 } }
    : { animate: { opacity: 1, y: 0 } };

  return (
    <m.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      {...visibilityProps}
      transition={{
        duration: reduceMotion ? 0 : motionTokens.duration.reveal,
        delay: reduceMotion ? 0 : delay,
        ease: motionTokens.ease,
      }}
    >
      {children}
    </m.div>
  );
}

export function AnimatedNumber({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const count = useMotionValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useMotionValueEvent(count, 'change', (latest) => {
    setDisplayValue(Math.round(latest));
  });

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (reduceMotion) {
      count.set(value);
      return;
    }

    const controls = animate(count, value, {
      duration: motionTokens.duration.number,
      ease: motionTokens.ease,
    });
    return () => controls.stop();
  }, [count, reduceMotion, value]);

  return (
    <>
      <span aria-hidden="true">{displayValue.toLocaleString()}</span>
      <span className="sr-only">{value.toLocaleString()}</span>
    </>
  );
}
