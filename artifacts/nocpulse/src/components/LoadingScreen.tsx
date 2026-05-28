import { useState } from 'react';
import logoUrl from '@/assets/logo.png';
import { useApiData } from "@/contexts/ApiDataContext";

export function LoadingScreen() {
  const { loading } = useApiData();
  const [logoError, setLogoError] = useState(false);

  if (!loading) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        /* Deep navy gradient — matches the logo's own background perfectly */
        background: 'linear-gradient(160deg, #060d18 0%, #0b1628 45%, #071220 70%, #060b16 100%)',
      }}
      aria-label="Loading NOCpulse"
    >
      {/* Outer ambient glow (blue + green to match logo palette) */}
      <div
        style={{
          position: 'absolute',
          width: 360,
          height: 280,
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at 40% 50%, rgba(59,130,246,0.13) 0%, transparent 65%), ' +
            'radial-gradient(ellipse at 65% 50%, rgba(34,197,94,0.09) 0%, transparent 60%)',
          animation: 'np-halo 3s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Logo — shown large so built-in text is legible; background blends with screen */}
      <div className="relative mb-8" style={{ zIndex: 1 }}>
        {!logoError ? (
          <img
            src={logoUrl}
            alt="NOCpulse"
            onError={() => setLogoError(true)}
            style={{
              width: 260,
              height: 'auto',
              objectFit: 'contain',
              imageRendering: 'auto',
              animation: 'np-logo 3s ease-in-out infinite',
              display: 'block',
            }}
          />
        ) : (
          /* Fallback if PNG fails */
          <div style={{ textAlign: 'center' }}>
            <svg width="72" height="72" viewBox="0 0 40 40" fill="none"
              style={{ animation: 'np-logo 3s ease-in-out infinite', display: 'block', margin: '0 auto 12px' }}>
              <circle cx="20" cy="20" r="19" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.4" />
              <polyline points="6,22 12,14 18,20 24,10 34,18"
                stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
              NOC<span style={{ color: '#60a5fa' }}>pulse</span>
            </div>
          </div>
        )}
      </div>

      {/* Slim indeterminate progress bar */}
      <div
        style={{
          width: 180,
          height: 2,
          borderRadius: 999,
          overflow: 'hidden',
          background: 'rgba(59,130,246,0.12)',
          marginBottom: 12,
          zIndex: 1,
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: '40%',
            borderRadius: 999,
            background: 'linear-gradient(90deg, transparent, #3b82f6 40%, #22c55e 60%, transparent)',
            animation: 'np-bar 1.6s ease-in-out infinite',
          }}
        />
      </div>

      <p
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          color: 'rgba(148,163,184,0.45)',
          textTransform: 'uppercase',
          userSelect: 'none',
          zIndex: 1,
          position: 'relative',
        }}
      >
        Connecting to network&hellip;
      </p>

      <style>{`
        @keyframes np-logo {
          0%, 100% {
            filter: drop-shadow(0 0 12px rgba(59,130,246,0.45))
                    drop-shadow(0 0 28px rgba(34,197,94,0.20));
            transform: scale(1);
          }
          50% {
            filter: drop-shadow(0 0 22px rgba(59,130,246,0.65))
                    drop-shadow(0 0 44px rgba(34,197,94,0.35));
            transform: scale(1.025);
          }
        }
        @keyframes np-halo {
          0%, 100% { opacity: 0.6; transform: scale(0.93); }
          50%       { opacity: 1.0; transform: scale(1.07); }
        }
        @keyframes np-bar {
          0%   { transform: translateX(-160%); }
          100% { transform: translateX(420%);  }
        }
      `}</style>
    </div>
  );
}
