import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, X, ArrowRight, Award } from 'lucide-react';

function ConfettiCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const colors = [
      '#ffd700',
      '#f59e0b',
      '#d97706',
      '#fef08a',
      '#ffffff',
      '#38bdf8',
      '#e0e7ff',
      '#fbbf24',
      '#f43f5e',
    ];
    const particles = [];
    const count = 120;

    // Left emitter burst
    for (let i = 0; i < count / 2; i++) {
      particles.push({
        x: width * 0.08,
        y: height * 0.7,
        vx: 4 + Math.random() * 11,
        vy: -10 - Math.random() * 10,
        size: 5 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        opacity: 1,
        shape: Math.random() > 0.35 ? 'rect' : 'circle',
      });
    }

    // Right emitter burst
    for (let i = 0; i < count / 2; i++) {
      particles.push({
        x: width * 0.92,
        y: height * 0.7,
        vx: -(4 + Math.random() * 11),
        vy: -10 - Math.random() * 10,
        size: 5 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        opacity: 1,
        shape: Math.random() > 0.35 ? 'rect' : 'circle',
      });
    }

    let animationFrame;
    const gravity = 0.28;
    const drag = 0.985;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let p of particles) {
        p.vx *= drag;
        p.vy = p.vy * drag + gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRot;

        if (p.y > height * 0.55) {
          p.opacity = Math.max(0, p.opacity - 0.012);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      animationFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="celebration-confetti" aria-hidden="true" />;
}

export function GoldenCrownEmblem() {
  return (
    <div className="celebration-crown-wrap">
      <div className="crown-glow-ring" />
      <svg
        className="celebration-crown-svg"
        viewBox="0 0 100 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff2a8" />
            <stop offset="30%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          <linearGradient id="jewelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <filter id="crownGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Crown Body */}
        <path
          d="M14 62L6 26L30 40L50 14L70 40L94 26L86 62H14Z"
          fill="url(#goldGradient)"
          stroke="#ffe57f"
          strokeWidth="1.5"
          filter="url(#crownGlow)"
        />

        {/* Crown Base Band */}
        <rect
          x="12"
          y="62"
          width="76"
          height="10"
          rx="3"
          fill="url(#goldGradient)"
          stroke="#ffe57f"
          strokeWidth="1"
        />

        {/* Jewels on Peaks */}
        <circle cx="6" cy="25" r="4" fill="url(#jewelGradient)" stroke="#fff" strokeWidth="1" />
        <circle cx="30" cy="39" r="4.5" fill="url(#jewelGradient)" stroke="#fff" strokeWidth="1" />
        <circle cx="50" cy="13" r="5.5" fill="url(#jewelGradient)" stroke="#fff" strokeWidth="1.2" />
        <circle cx="70" cy="39" r="4.5" fill="url(#jewelGradient)" stroke="#fff" strokeWidth="1" />
        <circle cx="94" cy="25" r="4" fill="url(#jewelGradient)" stroke="#fff" strokeWidth="1" />

        {/* Base Band Jewels */}
        <circle cx="28" cy="67" r="2.5" fill="url(#jewelGradient)" />
        <circle cx="50" cy="67" r="3" fill="#ffffff" />
        <circle cx="72" cy="67" r="2.5" fill="url(#jewelGradient)" />
      </svg>
    </div>
  );
}

export default function RecognitionCelebration({ profile, onClose }) {
  const [fadingOut, setFadingOut] = useState(false);

  const handleClose = () => {
    if (fadingOut) return;
    setFadingOut(true);
    setTimeout(() => {
      onClose();
    }, 450);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!profile) return null;

  return (
    <div
      className={`celebration-overlay ${fadingOut ? 'celebration-fade-out' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Secret Recognition Celebration"
    >
      <ConfettiCanvas />

      <button
        type="button"
        className="celebration-close-btn"
        onClick={handleClose}
        aria-label="Close recognition celebration"
      >
        <X size={20} />
      </button>

      <div className="celebration-card" onClick={(e) => e.stopPropagation()}>
        {/* Phase 1: Unlocked Badge */}
        <div className="celebration-badge">
          <Sparkles size={14} className="badge-sparkle" />
          <span>SECRET RECOGNITION UNLOCKED</span>
          <Sparkles size={14} className="badge-sparkle" />
        </div>

        {/* Phase 2: Golden Crown Emblem */}
        <GoldenCrownEmblem />

        {/* Phase 3: Person's Full Name */}
        <h1 className="celebration-name">{profile.fullName}</h1>

        {/* Phase 4: Designation */}
        <div className="celebration-designation">
          <span className="designation-line" />
          <strong className="designation-text">{profile.designation}</strong>
          <span className="designation-line" />
        </div>

        {/* Phase 5: Personalized Message */}
        {profile.message && (
          <p className="celebration-message">
            &ldquo;{profile.message}&rdquo;
          </p>
        )}

        {/* Phase 6: Subtitle / Brand Footer */}
        <div className="celebration-footer-tag">
          <Award size={13} />
          <span>{profile.subtitle || 'YENARTIFICIA • SPECIAL RECOGNITION'}</span>
        </div>

        {/* Action Button */}
        <button
          type="button"
          className="celebration-continue-btn"
          onClick={handleClose}
        >
          <span>Continue to Yenartificia</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
