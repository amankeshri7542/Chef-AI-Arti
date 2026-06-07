import { redirect } from 'next/navigation';

// Authenticated users are redirected to /home by proxy.ts.
// Unauthenticated users reaching / are redirected to /sign-in.
export default function RootPage() {
  redirect('/sign-in');
}
