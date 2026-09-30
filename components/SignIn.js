'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/AuthLayout';
import { login, completeNewPassword } from '@/lib/auth';

// Cognito names required attributes by their schema key; label the ones we ask for.
const ATTRIBUTE_LABELS = {
  given_name: 'First name',
  family_name: 'Last name',
  email: 'Email',
};

// Rendered at / and at /signin, so older links to /signin keep working.
export default function SignIn() {
  const router = useRouter();
  const [stage, setStage] = useState('credentials'); // 'credentials' | 'newPassword'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [missingAttributes, setMissingAttributes] = useState([]);
  const [attributes, setAttributes] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    setError('');
    try {
      const { isSignedIn, nextStep } = await login(email, password);
      if (isSignedIn) {
        router.replace('/dashboard');
        return;
      }
      switch (nextStep?.signInStep) {
        case 'CONFIRM_SIGN_UP':
          router.push('/signup');
          break;
        case 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED':
          // Account was created with a temporary password.
          setMissingAttributes(nextStep.missingAttributes ?? []);
          setStage('newPassword');
          break;
        case 'RESET_PASSWORD':
          setError(
            'This account needs its password reset before you can sign in. Ask an administrator to set a permanent password.'
          );
          break;
        default:
          setError(`Unhandled step: ${nextStep?.signInStep}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleNewPassword() {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { isSignedIn, nextStep } = await completeNewPassword(
        newPassword,
        attributes
      );
      if (isSignedIn) {
        router.replace('/dashboard');
      } else {
        setError(`Unhandled step: ${nextStep?.signInStep}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      {stage === 'credentials' ? (
        <>
          <h1>Sign in to Clairn</h1>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            className="button buttonBlock"
            onClick={handleSignIn}
            disabled={busy}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="cardFooter">
            No account? <Link href="/signup">Create one</Link>
          </p>
        </>
      ) : (
        <>
          <h1>Choose a password</h1>
          <p className="cardIntro">
            Your account was created with a temporary password. Set a
            permanent one to finish signing in.
          </p>
          {missingAttributes.map((name) => (
            <div className="field" key={name}>
              <label htmlFor={name}>{ATTRIBUTE_LABELS[name] ?? name}</label>
              <input
                id={name}
                value={attributes[name] ?? ''}
                onChange={(e) =>
                  setAttributes((current) => ({
                    ...current,
                    [name]: e.target.value,
                  }))
                }
              />
            </div>
          ))}
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button
            className="button buttonBlock"
            onClick={handleNewPassword}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Set password and sign in'}
          </button>
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
