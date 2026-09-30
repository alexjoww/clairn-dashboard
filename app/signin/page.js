import SignIn from '@/components/SignIn';

// Sign-in now lives at /. This route stays so existing links and bookmarks
// still land on the form (static export can't serve a redirect).
export default function SignInPage() {
  return <SignIn />;
}
