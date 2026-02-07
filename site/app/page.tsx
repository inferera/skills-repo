import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/en/');
}

export const metadata = {
  title: 'Skills Registry',
  description: 'Redirecting to English version...',
};
