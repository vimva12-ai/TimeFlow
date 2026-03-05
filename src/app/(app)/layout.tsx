import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';
import AppClientLayout from '@/components/nav/AppClientLayout';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/login');

  try {
    await adminAuth.verifySessionCookie(session, true);
  } catch {
    redirect('/login');
  }

  return <AppClientLayout>{children}</AppClientLayout>;
}
