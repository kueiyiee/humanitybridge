import { useEffect, useRef } from 'react';

type Particle = { x: number; y: number; vx: number; vy: number; radius: number };

export function HumanitarianParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context) return;

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionPreference.matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastFrame = 0;
    let particles: Particle[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(48, Math.max(22, Math.round(width / 32)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        radius: 0.8 + Math.random() * 1.5,
      }));
      draw(0, false);
    };

    const draw = (delta: number, animate: boolean) => {
      context.clearRect(0, 0, width, height);
      if (animate) {
        for (const particle of particles) {
          particle.x += particle.vx * delta;
          particle.y += particle.vy * delta;
          if (particle.x < -12) particle.x = width + 12;
          if (particle.x > width + 12) particle.x = -12;
          if (particle.y < -12) particle.y = height + 12;
          if (particle.y > height + 12) particle.y = -12;
        }
      }

      const dark = document.documentElement.classList.contains('dark');
      const pointColour = dark ? '164, 202, 216' : '91, 127, 143';
      const lineColour = dark ? '141, 184, 200' : '104, 139, 154';
      const maxDistance = Math.min(172, Math.max(112, width / 8));

      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance >= maxDistance) continue;
          const opacity = (1 - distance / maxDistance) * (dark ? 0.16 : 0.12);
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.strokeStyle = `rgba(${lineColour}, ${opacity})`;
          context.lineWidth = 0.7;
          context.stroke();
        }
      }

      for (const particle of particles) {
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(${pointColour}, ${dark ? 0.42 : 0.34})`;
        context.fill();
      }
    };

    const animate = (timestamp: number) => {
      if (document.visibilityState === 'hidden') {
        frame = 0;
        return;
      }
      if (timestamp - lastFrame >= 32) {
        const delta = lastFrame ? Math.min(timestamp - lastFrame, 48) : 32;
        draw(delta, true);
        lastFrame = timestamp;
      }
      frame = window.requestAnimationFrame(animate);
    };

    const start = () => {
      if (reducedMotion || frame) return;
      lastFrame = 0;
      frame = window.requestAnimationFrame(animate);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
      } else {
        start();
      }
    };
    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (reducedMotion) {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
      } else {
        start();
      }
    };

    const themeObserver = new MutationObserver(() => draw(0, false));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    resize();
    start();
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    motionPreference.addEventListener('change', onMotionPreferenceChange);

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      motionPreference.removeEventListener('change', onMotionPreferenceChange);
      themeObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="hb-particles" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
