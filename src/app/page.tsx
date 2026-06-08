import { redirect } from 'next/navigation';

// Root URL → home feed (public, no login required)
export default function RootPage() {
  redirect('/home');
}
