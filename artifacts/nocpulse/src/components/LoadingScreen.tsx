import { useApiData } from "@/contexts/ApiDataContext";

export function LoadingScreen() {
  const { loading } = useApiData();

  if (!loading) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#07111f]"
      aria-label="Loading NOCpulse"
    >
      {/* Logo mark */}
      <div className="flex items-center gap-3 mb-8">
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0"
        >
          <circle cx="20" cy="20" r="19" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.4" />
          <circle cx="20" cy="20" r="13" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.25" />
          <polyline
            points="6,22 12,14 18,20 24,10 34,18"
            stroke="#3b82f6"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <div>
          <div className="text-2xl font-bold tracking-tight text-white leading-none">
            NOC<span className="text-blue-400">pulse</span>
          </div>
          <div className="text-[10px] tracking-[0.2em] text-slate-500 uppercase mt-0.5">
            Network Operations
          </div>
        </div>
      </div>

      {/* Spinner */}
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500"
          style={{ animation: "spin 0.9s linear infinite" }}
        />
      </div>

      <p className="mt-5 text-xs text-slate-500 tracking-widest uppercase">
        Connecting to network&hellip;
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
