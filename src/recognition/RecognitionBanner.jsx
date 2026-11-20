import React from 'react';
import { Sparkles } from 'lucide-react';

export default function RecognitionBanner({ profile }) {
  if (!profile) return null;

  return (
    <aside
      className="recognition-banner"
      role="banner"
      aria-label="Secret Recognition Status"
    >
      <div className="recognition-banner-inner">
        <span className="banner-crown" aria-hidden="true">👑</span>
        <div className="banner-content">
          <strong className="banner-designation">{profile.designation}</strong>
          <span className="banner-divider" aria-hidden="true">—</span>
          <span className="banner-name">{profile.fullName}</span>
        </div>
        <span className="banner-sparkle" aria-hidden="true">
          <Sparkles size={13} />
        </span>
      </div>
      <div className="banner-shimmer-track" aria-hidden="true" />
    </aside>
  );
}
