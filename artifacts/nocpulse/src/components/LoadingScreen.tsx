import logoUrl from '@/assets/logo.png';
import { useApiData } from "@/contexts/ApiDataContext";

export function LoadingScreen() {
  const { loading } = useApiData();
  if (!loading) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      aria-label="Loading NOCpulse"
    >
      {/* Logo with glow halo */}
      <div className="relative flex items-center justify-center mb-7">
        {/* Ambient radial glow */}
        <div
          style={{
            position: 'absolute',
            width: 128,
            height: 128,
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse at center, rgba(59,130,246,0.20) 0%, rgba(59,130,246,0.06) 55%, transparent 75%)',
            animation: 'np-halo 2.6s ease-in-out infinite',
          }}
        />
        {/* Logo image */}
        <img
          src={logoUrl}
          alt="NOCpulse"
          style={{
            width: 80,
            height: 80,
            objectFit: 'contain',
            position: 'relative',
            zIndex: 1,
            animation: 'np-logo 2.6s ease-in-out infinite',
          }}
          className="sm:w-[88px] sm:h-[88px]"
        />
      </div>

      {/* Brand name + tagline */}
      <div className="mb-6 text-center select-none">
        <div className="text-[22px] font-bold tracking-tight leading-none text-foreground">
          NOC<span className="text-blue-400">pulse</span>
        </div>
        <div className="mt-1.5 text-[9.5px] tracking-[0.22em] text-muted-foreground/60 uppercase">
          Monitor&nbsp;·&nbsp;Analyze&nbsp;·&nbsp;Optimize
        </div>
      </div>

      {/* Slim indeterminate progress bar */}
      <div
        className="mb-3 overflow-hidden rounded-full bg-blue-500/10"
        style={{ width: 136, height: 2 }}
      >
        <div
          style={{
            height: '100%',
            width: '45%',
            borderRadius: 9999,
            background: 'linear-gradient(90deg, transparent, #3b82f6 50%, transparent)',
            animation: 'np-bar 1.55s ease-in-out infinite',
          }}
        />
      </div>

      <p className="text-[10px] tracking-[0.18em] text-muted-foreground/50 uppercase select-none">
        Connecting to network&hellip;
      </p>

      <style>{`
        @keyframes np-logo {
          0%, 100% {
            opacity: 0.90;
            transform: scale(1);
            filter: drop-shadow(0 0 8px rgba(59,130,246,0.35));
          }
          50% {
            opacity: 1;
            transform: scale(1.04);
            filter: drop-shadow(0 0 20px rgba(59,130,246,0.60));
          }
        }
        @keyframes np-halo {
          0%, 100% { opacity: 0.55; transform: scale(0.90); }
          50%       { opacity: 1.00; transform: scale(1.10); }
        }
        @keyframes np-bar {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(420%); }
        }
      `}</style>
    </div>
  );
}
