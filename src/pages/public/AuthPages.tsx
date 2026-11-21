import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Lock } from 'lucide-react';
import type { z } from 'zod';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from '../../../packages/shared/validation';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { DASHBOARD_ROLES } from '../../../packages/shared/types';
import { BrandLogo } from '../../components/BrandLogo';

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

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

  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900/80">
        <BrandLogo className="mx-auto mb-4 h-[48px] w-[144px]" />
        <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
        </div>
        <h1 className="mt-3 text-center font-editorial text-3xl font-semibold text-slate-950 dark:text-white">
          Authorised Portal Access
        </h1>
        <p className="mt-3 text-center text-sm leading-6 text-slate-600 dark:text-slate-300">
          Sign in to access your authorised HumanityBridge workspace.
        </p>

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-slate-300 bg-slate-100 p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {error}
          </div>
        )}

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
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...loginForm.register('password')}
                  className="w-full px-3.5 py-2.5 pr-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
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
              className="w-full py-3 rounded-lg bg-slate-900 text-white text-sm font-semibold transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {loginForm.formState.isSubmitting ? 'Authenticating...' : mfaRequired ? 'Verify & Sign In' : 'Sign In'}
            </button>

            <div className="text-center pt-2">
              <Link to="/forgot-password" className="text-xs text-slate-600 underline underline-offset-4 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white">
                Forgot password?
              </Link>
            </div>
          </form>
        <p className="mt-6 border-t border-slate-200 pt-5 text-center text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Access is restricted to authorised HumanityBridge personnel. Accounts and permissions are managed by the Platform Administrator.
        </p>
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
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
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} placeholder="New password (12+ characters)" {...register('password')} className="w-full px-3.5 py-2.5 pr-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide new password' : 'Show new password'} className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <input type={showConfirmation ? 'text' : 'password'} placeholder="Confirm new password" {...register('confirmPassword')} className="w-full px-3.5 py-2.5 pr-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
            <button type="button" onClick={() => setShowConfirmation((visible) => !visible)} aria-label={showConfirmation ? 'Hide password confirmation' : 'Show password confirmation'} className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500">
              {showConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
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
