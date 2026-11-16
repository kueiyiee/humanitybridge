import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Lock } from 'lucide-react';
import type { z } from 'zod';
import {
  forgotPasswordSchema,
  loginSchema,
  registerCoordinatorSchema,
  resetPasswordSchema,
} from '../../../packages/shared/validation';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { DASHBOARD_ROLES } from '../../../packages/shared/types';

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerCoordinatorSchema>;

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'login' | 'register'>(
    searchParams.get('tab') === 'register' ? 'register' : 'login',
  );
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regResult, setRegResult] = useState<{ message: string; devVerificationToken?: string } | null>(null);

  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const regForm = useForm<RegisterValues>({ resolver: zodResolver(registerCoordinatorSchema) });

  const onLogin = async (values: LoginValues) => {
    setError(null);
    try {
      const res = await apiRequest<{
        mfaRequired: boolean;
        user?: { role: string };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      if (res.data.mfaRequired) {
        setMfaRequired(true);
        return;
      }

      await refreshSession();
      const target = res.data.user?.role === DASHBOARD_ROLES.PLATFORM_ADMIN ? '/admin' : '/coordinator';
      navigate(target, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    }
  };

  const onRegister = async (values: RegisterValues) => {
    setError(null);
    try {
      const res = await apiRequest<{ devVerificationToken?: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setRegResult({
        message: res.message,
        devVerificationToken: res.data?.devVerificationToken,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-14">
      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#123F69] dark:text-[#00BCEB]">
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Authorised Portal Access</span>
        </div>
        <h1 className="mt-2 font-editorial text-3xl font-semibold text-[#0B1F3A] dark:text-white">
          {tab === 'login' ? 'Sign In to HumanityBridge' : 'Apply as Community Coordinator'}
        </h1>

        <div className="mt-6 flex p-1 rounded-lg bg-slate-100 dark:bg-[#071324]">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              tab === 'login'
                ? 'bg-white dark:bg-[#0D223D] text-[#0B1F3A] dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              tab === 'register'
                ? 'bg-white dark:bg-[#0D223D] text-[#0B1F3A] dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Coordinator Application
          </button>
        </div>

        {error && (
          <div className="mt-5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {tab === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium mb-1">Email Address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                {...loginForm.register('email')}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm"
              />
              {loginForm.formState.errors.email && (
                <p className="text-xs text-rose-600 mt-1">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium mb-1">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                {...loginForm.register('password')}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm"
              />
              {loginForm.formState.errors.password && (
                <p className="text-xs text-rose-600 mt-1">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            {mfaRequired && (
              <div>
                <label htmlFor="login-mfa" className="block text-sm font-medium mb-1">
                  6-Digit Authenticator Code (MFA)
                </label>
                <input
                  id="login-mfa"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  {...loginForm.register('mfaCode')}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#00BCEB] bg-white dark:bg-[#071324] text-sm font-mono-tabular"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              className="w-full py-3 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold hover:bg-[#123F69] transition-colors"
            >
              {loginForm.formState.isSubmitting ? 'Authenticating...' : mfaRequired ? 'Verify & Sign In' : 'Sign In'}
            </button>

            <div className="flex justify-between text-xs text-[#748196] dark:text-slate-400 pt-2">
              <Link to="/forgot-password" className="hover:underline">Forgot password?</Link>
              <Link to="/verify-email" className="hover:underline">Verify email token</Link>
            </div>
          </form>
        ) : regResult ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3 text-[#16865D] dark:text-[#1FA977]">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">{regResult.message}</p>
            </div>
            {regResult.devVerificationToken && (
              <div className="p-3 rounded-lg bg-[#F7F9FC] dark:bg-[#071324] border border-slate-200 dark:border-slate-800 text-xs">
                <p className="font-semibold">Development Email Token:</p>
                <p className="font-mono-tabular break-all mt-1">{regResult.devVerificationToken}</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={regForm.handleSubmit(onRegister)} className="mt-6 space-y-4">
            <p className="text-xs text-[#748196] dark:text-slate-400">
              Public registration applies strictly for Community Coordinator access and remains pending until Platform
              Administrator approval.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input {...regForm.register('displayName')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              {regForm.formState.errors.displayName && <p className="text-xs text-rose-600 mt-1">{regForm.formState.errors.displayName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email Address</label>
              <input type="email" {...regForm.register('email')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              {regForm.formState.errors.email && <p className="text-xs text-rose-600 mt-1">{regForm.formState.errors.email.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Region</label>
                <input {...regForm.register('region')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Organisation</label>
                <input {...regForm.register('organization')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password (10+ chars, uppercase & number)</label>
              <input type="password" {...regForm.register('password')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              {regForm.formState.errors.password && <p className="text-xs text-rose-600 mt-1">{regForm.formState.errors.password.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Community Outreach Role & References</label>
              <textarea rows={3} {...regForm.register('motivation')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              {regForm.formState.errors.motivation && <p className="text-xs text-rose-600 mt-1">{regForm.formState.errors.motivation.message}</p>}
            </div>
            <button type="submit" disabled={regForm.formState.isSubmitting} className="w-full py-3 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
              {regForm.formState.isSubmitting ? 'Submitting Application...' : 'Submit Coordinator Application'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | undefined>();
  const { register, handleSubmit } = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values: { email: string }) => {
    const res = await apiRequest<{ devResetToken?: string } | null>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    setMessage(res.message);
    setDevToken(res.data?.devResetToken);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        <h1 className="font-editorial text-2xl font-semibold">Forgot Password</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <input type="email" placeholder="Account email address" {...register('email')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <button type="submit" className="w-full py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
            Request Password Reset
          </button>
        </form>
        {message && <p className="mt-4 text-xs text-slate-600 dark:text-slate-300">{message}</p>}
        {devToken && (
          <div className="mt-3 p-3 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono-tabular break-all">
            Dev reset token: {devToken}
          </div>
        )}
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (values: z.infer<typeof resetPasswordSchema>) => {
    setErr(null);
    try {
      const res = await apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify(values) });
      setMsg(res.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Reset failed');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        <h1 className="font-editorial text-2xl font-semibold">Reset Password</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          <input placeholder="Reset token" {...register('token')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm font-mono-tabular" />
          <input type="password" placeholder="New password (10+ chars)" {...register('password')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <button type="submit" className="w-full py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
            Update Password
          </button>
        </form>
        {msg && <p className="mt-4 text-xs text-[#16865D]">{msg}</p>}
        {err && <p className="mt-4 text-xs text-rose-600">{err}</p>}
      </div>
    </div>
  );
}

export function VerifyEmailPage() {
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const res = await apiRequest('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
      setMsg(res.message);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Verification failed');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        <h1 className="font-editorial text-2xl font-semibold">Account Verification</h1>
        <form onSubmit={handleVerify} className="mt-5 space-y-4">
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Verification token" className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm font-mono-tabular" />
          <button type="submit" className="w-full py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
            Verify Account
          </button>
        </form>
        {msg && <p className="mt-4 text-xs text-[#16865D]">{msg}</p>}
        {err && <p className="mt-4 text-xs text-rose-600">{err}</p>}
      </div>
    </div>
  );
}
