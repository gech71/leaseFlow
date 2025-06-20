import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/auth/login'); // Changed redirect to the new login page
  return null;
}
