'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default function RequireAuth({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then((user) => {
      if (cancelled) return;
      if (user) {
        setStatus('authed');
      } else {
        setStatus('anon');
        router.replace('/');
      }
    });
    return () => { cancelled = true; };
  }, [router]);

  if (status !== 'authed') return null;
  return children;
}
