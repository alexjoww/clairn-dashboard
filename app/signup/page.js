'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/AuthLayout';
import { register, confirmRegistration, login, resendCode } from '@/lib/auth';

export default function SignUpPage() {
  const router = useRouter();
  const [stage, setStage] = useState('register'); // 'register' | 'confirm'
  const [givenName, setGivenName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleRegister() {
    setBusy(true);
    setError('');
    try {
      await register(email, password, givenName);
      setStage('confirm');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    setBusy(true);
    setError('');
    try {
      await confirmRegistration(email, code);
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await resendCode(email);
      setNotice(`We sent a new code to ${email}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      {stage === 'register' ? (
        <>
          <h1>Create your account</h1>
          <div className="field">
            <label htmlFor="givenName">First name</label>
            <input
              id="givenName"
              autoComplete="given-name"
              value={givenName}
              onChange={(e) => setGivenName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            className="button buttonBlock"
            onClick={handleRegister}
            disabled={busy}
          >
            {busy ? 'Creating account…' : 'Create account'}
          </button>
          <p className="cardFooter">
            Already have an account? <Link href="/">Sign in</Link>
          </p>
        </>
      ) : (
        <>
          <h1>Check your email</h1>
          <p className="cardIntro">
            Enter the verification code we sent to {email}.
          </p>
          <div className="field">
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <button
            className="button buttonBlock"
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? 'Confirming…' : 'Confirm'}
          </button>
          <button
            className="button buttonBlock buttonSecondary"
            onClick={handleResend}
            disabled={busy}
          >
            Resend code
          </button>
          {notice && <p className="notice">{notice}</p>}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </AuthLayout>
  );
}
