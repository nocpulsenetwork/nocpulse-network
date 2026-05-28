import { useState } from 'react';
import logoMainUrl from '@/assets/logo-main.png';
import { useApiData } from "@/contexts/ApiDataContext";

export function LoadingScreen() {
  const { loading } = useApiData();
  const [logoError, setLogoError] = useState(false);

  if (!loading) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: '#05090f',
        animation: 'np-screen-in 0.3s ease-out both',
      }}
      aria-label="Loading NOCpulse"
    >
      {/* Ambient dual-colour halo — GPU composited, near-zero CPU */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 420,
          height: 320,
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at 38% 50%, rgba(59,130,246,0.14) 0%, transparent 62%),' +
            'radial-gradient(ellipse at 64% 50%, rgba(34,197,94,0.10) 0%, transparent 58%)',
          animation: 'np-halo 3.2s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Logo */}
      <div className="relative mb-7" style={{ zIndex: 1 }}>
        {!logoError ? (
          <img
            src={logoMainUrl}
            alt="NOCpulse"
            onError={() => setLogoError(true)}
            style={{
              width: 240,
              height: 'auto',
              display: 'block',
              /* Dark bg of PNG is near-black — screen blend makes it dissolve
                 into the #05090f page background in both modes */
              mixBlendMode: 'screen',
              animation: 'np-logo-in 0.55s cubic-bezier(0.22,1,0.36,1) both, np-glow 3.2s ease-in-out 0.55s infinite',
            }}
          />
        ) : (
          /* Fallback mark if PNG fails */
          <div style={{ textAlign: 'center', animation: 'np-logo-in 0.55s ease both' }}>
            <svg width="72" height="72" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18.5" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.5" />
              <polyline points="6,22 12,14 18,20 24,10 34,18"
                stroke="url(#fgl)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="fgl" x1="6" y1="16" x2="34" y2="16" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6" /><stop offset="1" stopColor="#22c55e" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ marginTop: 12, fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
              NOC<span style={{ color: '#60a5fa' }}>pulse</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: 200,
          height: 2,
          borderRadius: 999,
          overflow: 'hidden',
          background: 'rgba(59,130,246,0.10)',
          marginBottom: 14,
          animation: 'np-logo-in 0.55s 0.3s ease both',
        }}
      >
        <div
          style={{
            height: '100%',
            width: '38%',
            borderRadius: 999,
            background: 'linear-gradient(90deg, transparent, #3b82f6 40%, #22c55e 60%, transparent)',
            animation: 'np-bar 1.65s ease-in-out infinite',
          }}
        />
      </div>

      <p
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 10,
          letterSpacing: '0.18em',
          color: 'rgba(148,163,184,0.42)',
          textTransform: 'uppercase',
          userSelect: 'none',
          animation: 'np-logo-in 0.55s 0.4s ease both',
        }}
      >
        Connecting to network&hellip;
      </p>

      <style>{`
        @keyframes np-screen-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes np-logo-in {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes np-glow {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(59,130,246,0.38)) drop-shadow(0 0 22px rgba(34,197,94,0.18)); }
          50%       { filter: drop-shadow(0 0 20px rgba(59,130,246,0.60)) drop-shadow(0 0 40px rgba(34,197,94,0.30)); }
        }
        @keyframes np-halo {
          0%, 100% { opacity: 0.55; transform: scale(0.94); }
          50%       { opacity: 1.00; transform: scale(1.06); }
        }
        @keyframes np-bar {
          0%   { transform: translateX(-160%); }
          100% { transform: translateX(440%);  }
        }
      `}</style>
    </div>
  );
}
