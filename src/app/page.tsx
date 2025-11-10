import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/admin/dashboard');
  } else {
    redirect('/login');
  }
}
