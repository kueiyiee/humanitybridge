import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiRequest } from '../../services/api';

export function MfaSettingsPanel() {
  const { user, refreshSession } = useAuth();
  const [password, setPassword] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true); setMessage(null); setError(null);
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : 'The security operation could not be completed.'); }
    finally { setBusy(false); }
  };

  const startSetup = () => runAction(async () => {
    const response = await apiRequest<{ secret: string; otpauthUri: string }>('/auth/mfa/setup', {
      method: 'POST', body: JSON.stringify({ password, currentCode }),
    });
    setSecret(response.data.secret); setOtpauthUri(response.data.otpauthUri); setVerificationCode('');
    setMessage('Authenticator setup created. Scan the QR code, then verify a current code to activate MFA.');
  });

  const enableMfa = () => runAction(async () => {
    await apiRequest('/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ code: verificationCode }) });
    setSecret(null); setOtpauthUri(null); setPassword(''); setCurrentCode(''); setVerificationCode('');
    await refreshSession(); setMessage('Multi-factor authentication is now enabled for this account.');
  });

  const disableMfa = () => runAction(async () => {
    await apiRequest('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ password, code: currentCode }) });
    setSecret(null); setOtpauthUri(null); setPassword(''); setCurrentCode('');
    await refreshSession(); setMessage('MFA was disabled. Your active sessions were revoked; sign in again to continue.');
  });

  return (
    <section className="hb-panel space-y-5 p-5 sm:p-6" aria-labelledby="mfa-settings-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300"><ShieldCheck className="h-5 w-5" /></span>
          <div><h2 id="mfa-settings-title" className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Multi-factor authentication</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">Add a time-based authenticator code to protect dashboard sign-ins and sensitive account access.</p></div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${user?.mfaEnabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}><span className={`h-1.5 w-1.5 rounded-full ${user?.mfaEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />{user?.mfaEnabled ? 'Enabled' : 'Not enabled'}</span>
      </div>
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200"><KeyRound className="h-4 w-4 text-slate-500" />{user?.mfaEnabled ? 'Verify to change security settings' : 'Set up an authenticator'}</div>
          <div><label htmlFor="mfa-current-password" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Current account password</label><input id="mfa-current-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div>
          {user?.mfaEnabled && <div><label htmlFor="mfa-current-code" className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Current authenticator code</label><input id="mfa-current-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={currentCode} onChange={(e) => setCurrentCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm tracking-[0.25em] text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div>}
          {user?.mfaEnabled ? <button type="button" disabled={busy || !password || currentCode.length !== 6} onClick={disableMfa} className="rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">{busy ? 'Processing…' : 'Disable MFA'}</button> : <button type="button" disabled={busy || !password} onClick={startSetup} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300">{busy ? 'Preparing…' : 'Generate authenticator setup'}</button>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          {secret && otpauthUri ? <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Scan with your authenticator app</div>
            <div className="flex justify-center rounded-xl bg-white p-3"><QRCodeSVG value={otpauthUri} size={156} level="M" includeMargin /></div>
            <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">If you cannot scan the QR code, enter this setup key manually:</p>
            <code className="block break-all rounded-lg bg-white px-3 py-2 text-[11px] text-slate-800 dark:bg-slate-950 dark:text-slate-200">{secret}</code>
            <label htmlFor="mfa-enable-code" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Six-digit verification code</label>
            <input id="mfa-enable-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm tracking-[0.25em] dark:border-slate-700 dark:bg-slate-950" />
            <button type="button" disabled={busy || verificationCode.length !== 6} onClick={enableMfa} className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Verifying…' : 'Verify and enable MFA'}</button>
          </div> : <div className="flex h-full min-h-36 flex-col justify-center gap-2"><div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">{user?.mfaEnabled ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}{user?.mfaEnabled ? 'Your account is protected' : 'Why enable MFA?'}</div><p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{user?.mfaEnabled ? 'Sign-ins require your password and a current code from your authenticator app.' : 'MFA adds a second verification step, helping protect organisational data if a password is exposed.'}</p></div>}
        </div>
      </div>
      <p className="border-t border-slate-100 pt-3 text-[11px] leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">Use a trusted authenticator app and keep your device secure. Recovery-code login is not yet available, so retain access to your authenticator before changing or replacing devices.</p>
    </section>
  );
}
