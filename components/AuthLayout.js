import { MarkGlyph } from '@/components/Brand';

// Sign-in and sign-up: the brand character centered above a single card.
export default function AuthLayout({ children }) {
  return (
    <main className="auth">
      <div className="authInner">
        <MarkGlyph className="authMark" />
        <div className="card">{children}</div>
      </div>
    </main>
  );
}
