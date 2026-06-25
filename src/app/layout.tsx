import './globals.css';

export const metadata = {
  title: 'Personal Finance Dashboard',
  description: 'CSV-powered personal finance dashboard for spending, debt, and savings insights.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
