
import { redirect } from 'next/navigation';

// The root page '/' is now the login page.
// This file is just a fallback that redirects to the root.
export default function LoginPage() {
  redirect('/');
}
