import { useState } from 'react';
import { useLocation } from 'wouter';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, AlertTriangle, CheckCircle2, ArrowRight, RefreshCw, Activity } from 'lucide-react';
import logoMainUrl from '@/assets/logo-main.png';
import { Button } from '@/components/ui/button';

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const label = score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
  const color = score <= 1 ? 'bg-red-500' : score === 2 ? 'bg-amber-500' : score === 3 ? 'bg-blue-500' : 'bg-green-500';
  const textColor = score <= 1 ? 'text-red-400' : score === 2 ? 'text-amber-400' : score === 3 ? 'text-blue-400' : 'text-green-400';
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? color : 'bg-muted'}`} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold ${textColor}`}>{label}</span>
        <div className="flex gap-2">
          {[
            { label: '8+ chars', ok: checks[0] },
            { label: 'Uppercase', ok: checks[1] },
            { label: 'Number', ok: checks[2] },
            { label: 'Symbol', ok: checks[3] },
          ].map(c => (
            <span key={c.label} className={`text-[9px] font-medium ${c.ok ? 'text-green-400' : 'text-muted-foreground'}`}>
              {c.ok ? '✓' : '·'} {c.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (email === 'admin@nocpulse.io' && password === 'demo1234') {
        navigate('/');
      } else {
        setError('Invalid credentials. Try admin@nocpulse.io / demo1234');
      }
    }, 1200);
  };

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Enter your account email address.'); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); setForgotSent(true); }, 1000);
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center relative overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-cyan-500/5" />

      {/* Ambient glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        {/* Logo — logo-main.png has a near-black bg; screen blend dissolves it
             against the page background so the N mark floats cleanly */}
        <div className="flex flex-col items-center mb-8">
          <img
            src={logoMainUrl}
            alt="NOCpulse"
            style={{
              width: 'clamp(160px, 40vw, 220px)',
              height: 'auto',
              display: 'block',
              mixBlendMode: 'screen',
            }}
          />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden">
          {/* Card header strip */}
          <div className="border-b border-border/50 px-6 py-4 bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-primary/15 border border-primary/20 flex items-center justify-center">
                <Lock className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold">
                {view === 'login' ? 'Secure Sign In' : 'Reset Password'}
              </span>
              <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-green-500">Secure</span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {view === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="admin@nocpulse.io"
                      className="w-full h-10 pl-9 pr-4 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                    <button type="button" onClick={() => setView('forgot')} className="text-[11px] text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 pl-9 pr-10 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && <PasswordStrength password={password} />}
                </div>

                {/* Remember me */}
                <div className="flex items-center gap-2">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-border/60 accent-primary cursor-pointer"
                  />
                  <label htmlFor="remember" className="text-xs text-muted-foreground cursor-pointer select-none">
                    Keep me signed in for 30 days
                  </label>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                {/* Submit */}
                <Button type="submit" className="w-full gap-2 h-10" disabled={loading}>
                  {loading ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Authenticating…</>
                  ) : (
                    <><ArrowRight className="h-4 w-4" /> Sign In to NOCpulse</>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                {forgotSent ? (
                  <div className="py-4 flex flex-col items-center gap-3 text-center">
                    <div className="h-12 w-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Reset link sent</p>
                      <p className="text-xs text-muted-foreground mt-1">Check <span className="text-foreground font-medium">{email}</span> for a password reset link. Valid for 30 minutes.</p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => { setView('login'); setForgotSent(false); }}>
                      Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground">
                      Enter your account email and we'll send you a secure reset link.
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="admin@nocpulse.io"
                          className="w-full h-10 pl-9 pr-4 rounded-lg border border-border/60 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                        />
                      </div>
                    </div>
                    {error && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        {error}
                      </div>
                    )}
                    <Button type="submit" className="w-full gap-2 h-10" disabled={loading}>
                      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                      Send Reset Link
                    </Button>
                    <button type="button" onClick={() => { setView('login'); setError(''); }} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
                      ← Back to Sign In
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Demo credentials hint */}
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="text-foreground font-semibold">Demo credentials — </span>
            Email: <span className="font-mono text-primary">admin@nocpulse.io</span> · Password: <span className="font-mono text-primary">demo1234</span>
          </div>
        </div>

        {/* Security badges */}
        <div className="mt-5 flex items-center justify-center gap-4 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> TLS 1.3 Encrypted</span>
          <span className="flex items-center gap-1"><ShieldCheck className="h-2.5 w-2.5" /> Session Protected</span>
          <span className="flex items-center gap-1"><Activity className="h-2.5 w-2.5" /> Audit Logged</span>
        </div>
      </div>
    </div>
  );
}
