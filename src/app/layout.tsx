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
  title: "MerciInternet.ch — Gérez votre budget comme un Suisse",
  description:
    "L'app de gestion de budget pensée pour la Suisse. Saisie rapide des dépenses, catégories suisses (LAMal, 3e pilier, impôts, CFF...), objectifs d'épargne, vue mensuelle. En francs suisses.",
  keywords: [
    "budget",
    "suisse",
    "gestion budget",
    "finances personnelles",
    "CHF",
    "épargne",
    "dépenses",
    "LAMal",
    "3e pilier",
    "impôts",
    "app budget suisse",
  ],
  openGraph: {
    title: "MerciInternet.ch — Gérez votre budget comme un Suisse",
    description:
      "L'app de budget pensée pour la Suisse. Simple, rapide, en francs suisses.",
    url: "https://merciinternet.ch",
    siteName: "MerciInternet.ch",
    locale: "fr_CH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MerciInternet.ch — Gérez votre budget comme un Suisse",
    description:
      "L'app de budget pensée pour la Suisse. Simple, rapide, en francs suisses.",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
