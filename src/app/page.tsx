import { redirect } from 'next/navigation';

// The root page now automatically redirects to the login page.
export default function HomePage() {
  redirect('/login');
}
