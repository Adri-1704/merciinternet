import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Merciinternet.ch — La compta simplifiée pour les indépendants suisses",
  description:
    "L'app de comptabilité pensée pour les indépendants suisses. Scan de factures, export fiduciaire, suivi des dépenses et revenus en CHF. Simple, rapide, tout-en-un.",
  keywords: [
    "comptabilité",
    "indépendant",
    "freelance",
    "suisse",
    "fiduciaire",
    "factures",
    "CHF",
    "dépenses",
    "scan facture",
    "export comptable",
    "gestion indépendant suisse",
  ],
  openGraph: {
    title: "Merciinternet.ch — La compta simplifiée pour les indépendants suisses",
    description:
      "Scan de factures, export fiduciaire, suivi des dépenses. L'app pensée pour les indépendants suisses.",
    url: "https://merciinternet.ch",
    siteName: "Merciinternet.ch",
    locale: "fr_CH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Merciinternet.ch — La compta simplifiée pour les indépendants suisses",
    description:
      "Scan de factures, export fiduciaire, suivi des dépenses. L'app pensée pour les indépendants suisses.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7C3AED" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Merciinternet" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
