import './globals.css';

export const metadata = {
  title: 'NaijaAlias — Nigerian Email Alias Generator & Quota Manager',
  description: 'Batch generate authentic Nigerian names and deliverable SimpleLogin email aliases with duplicate prevention, quota auto-filling, and 1-click deletion.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🇳🇬</text></svg>',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#090d16',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
