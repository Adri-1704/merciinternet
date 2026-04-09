import Link from "next/link";

const features = [
  {
    icon: "📸",
    title: "Scan de factures IA",
    description:
      "Photographiez vos tickets et factures. Le montant, la date et la catégorie sont extraits automatiquement.",
  },
  {
    icon: "📤",
    title: "Export fiduciaire",
    description:
      "Envoyez votre rapport mensuel (CSV ou PDF) directement à votre fiduciaire en un clic.",
  },
  {
    icon: "🇨🇭",
    title: "100% Suisse",
    description:
      "Catégories suisses intégrées : LAMal, 3e pilier, impôts, Serafe, matériel, sous-traitance...",
  },
  {
    icon: "💼",
    title: "Factures clients",
    description:
      "Gérez vos factures clients, suivez vos encaissements et séparez trésorerie perso et pro.",
  },
  {
    icon: "📊",
    title: "Prévisions annuelles",
    description:
      "Charges fixes, graphique annuel, projection de trésorerie. Anticipez votre année.",
  },
  {
    icon: "🗂️",
    title: "Archivage factures",
    description:
      "Toutes vos factures scannées sont stockées et consultables à tout moment depuis l'app.",
  },
];

const categories = [
  { icon: "🏠", name: "Loyer / Bureau" },
  { icon: "🏥", name: "Caisse maladie" },
  { icon: "🏦", name: "3e pilier" },
  { icon: "📋", name: "Impôts" },
  { icon: "💻", name: "Matériel" },
  { icon: "🖥️", name: "Logiciel / Abo" },
  { icon: "📊", name: "Comptable" },
  { icon: "🚗", name: "Déplacements" },
  { icon: "📚", name: "Formation" },
  { icon: "📣", name: "Marketing" },
  { icon: "🤝", name: "Sous-traitance" },
  { icon: "🛡️", name: "Assurances" },
  { icon: "🍽️", name: "Restaurants" },
  { icon: "📱", name: "Téléphone" },
  { icon: "🚂", name: "Transport" },
  { icon: "📦", name: "Autre" },
];

const faqs = [
  {
    q: "C'est pour quel type d'indépendant ?",
    a: "Merciinternet est conçu pour tous les indépendants suisses : freelances, consultants, artisans, thérapeutes, coaches, créateurs... Toute personne qui doit suivre ses dépenses et revenus pour sa fiduciaire.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Vos données restent sur votre appareil (stockage local). Aucune donnée n'est envoyée à des tiers. Votre vie privée est notre priorité.",
  },
  {
    q: "Comment fonctionne l'envoi à la fiduciaire ?",
    a: "Configurez l'email de votre fiduciaire une seule fois. Chaque mois, un clic génère le rapport CSV et ouvre un email pré-rempli avec le résumé. Vous n'avez plus qu'à envoyer.",
  },
  {
    q: "Le scan de factures est-il fiable ?",
    a: "Le scan utilise l'IA Claude d'Anthropic pour extraire automatiquement le montant, la date et la catégorie. Vous pouvez toujours corriger avant d'ajouter.",
  },
  {
    q: "Puis-je essayer avant de payer ?",
    a: "Oui, l'essai est gratuit avec des fonctionnalités de base. L'abonnement Pro débloque le scan illimité, l'export fiduciaire et l'archivage des factures.",
  },
];

export default function Home() {
  return (
    <div className="landing-violet min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-violet-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-indigo-950">
              Merci<span className="text-violet-600">internet</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
            >
              Ouvrir l&apos;app
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-20 text-center">
        {/* Subtle violet gradient blob */}
        <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-violet-200/40 blur-3xl" />
        <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-indigo-200/30 blur-3xl" />

        <div className="relative mx-auto max-w-4xl">
          <div className="animate-fade-in-up mb-6 inline-block rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-sm text-violet-600">
            Pour les indépendants suisses · CHF · Export fiduciaire
          </div>
          <h1 className="animate-fade-in-up animate-delay-100 mb-6 text-5xl font-bold leading-tight tracking-tight text-indigo-950 md:text-7xl">
            La compta simplifiée
            <br />
            <span className="gradient-text-violet">pour les indépendants suisses</span>
          </h1>
          <p className="animate-fade-in-up animate-delay-200 mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-600 md:text-xl">
            Scannez vos factures, suivez vos dépenses et revenus, envoyez
            votre rapport mensuel à votre fiduciaire. Tout en CHF, tout en un clic.
          </p>
          <div className="animate-fade-in-up animate-delay-300 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard"
              className="w-full rounded-full bg-violet-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-600/25 sm:w-auto"
            >
              Essayer gratuitement
            </Link>
            <a
              href="#pricing"
              className="w-full rounded-full border border-violet-200 px-8 py-3.5 text-base font-semibold text-indigo-950 transition-colors hover:bg-violet-50 sm:w-auto"
            >
              Voir les tarifs
            </a>
          </div>
        </div>
        <div className="animate-fade-in-up animate-delay-400 mt-16">
          <svg
            className="h-6 w-6 animate-bounce text-violet-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-violet-50/50 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold text-indigo-950 md:text-4xl">
            Pourquoi <span className="text-violet-600">Merciinternet</span> ?
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-gray-600">
            Tout ce dont un indépendant suisse a besoin pour sa comptabilité.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="light-card rounded-2xl p-6 transition-all hover:border-violet-300"
              >
                <div className="mb-4 text-4xl">{f.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-indigo-950">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Swiss Categories */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold text-indigo-950 md:text-4xl">
            Catégories <span className="text-violet-600">pro & perso</span>
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-gray-600">
            Catégories suisses et professionnelles, déjà configurées.
          </p>
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {categories.map((c) => (
              <div
                key={c.name}
                className="light-card flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:bg-violet-50"
              >
                <span className="text-2xl">{c.icon}</span>
                <span className="text-sm font-medium text-indigo-950">
                  {c.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-violet-50/50 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold text-indigo-950 md:text-4xl">
            Tarifs <span className="text-violet-600">transparents</span>
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-gray-600">
            Un seul plan, tout inclus. Essayez gratuitement, sans engagement.
          </p>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {/* Monthly */}
            <div className="light-card rounded-2xl p-8">
              <div className="mb-1 text-sm font-medium uppercase tracking-wider text-violet-600">
                Mensuel
              </div>
              <div className="mb-1 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-indigo-950">19.95</span>
                <span className="text-lg text-gray-500">CHF/mois</span>
              </div>
              <div className="mb-6 text-sm text-gray-400">
                Sans engagement, annulable à tout moment
              </div>
              <ul className="mb-8 space-y-3">
                {[
                  "Suivi dépenses & revenus",
                  "Scan de factures illimité (IA)",
                  "Export CSV & PDF fiduciaire",
                  "Envoi mensuel à la fiduciaire",
                  "Archivage des factures",
                  "Trésorerie perso & pro",
                  "Factures clients & à payer",
                  "Prévisions annuelles",
                  "Catégories suisses & pro",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-sm text-gray-600"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-violet-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className="block w-full rounded-full bg-violet-600 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-violet-700"
              >
                Essayer gratuitement
              </Link>
            </div>

            {/* Annual */}
            <div className="relative rounded-2xl border border-violet-300 bg-gradient-to-b from-violet-50 to-white p-8">
              <div className="absolute -top-3 right-6 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
                2 mois offerts
              </div>
              <div className="mb-1 text-sm font-medium uppercase tracking-wider text-violet-600">
                Annuel
              </div>
              <div className="mb-1 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-indigo-950">199</span>
                <span className="text-lg text-gray-500">CHF/an</span>
              </div>
              <div className="mb-6 text-sm text-gray-400">
                soit 16.58 CHF/mois au lieu de 19.95
              </div>
              <ul className="mb-8 space-y-3">
                {[
                  "Tout inclus (identique au mensuel)",
                  "Scan de factures illimité (IA)",
                  "Export CSV & PDF fiduciaire",
                  "Envoi mensuel à la fiduciaire",
                  "Archivage des factures",
                  "Trésorerie perso & pro",
                  "Factures clients & à payer",
                  "Prévisions annuelles",
                  "Support prioritaire",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-sm text-gray-600"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-violet-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className="block w-full rounded-full bg-violet-600 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-violet-700"
              >
                Essayer gratuitement
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-center text-3xl font-bold text-indigo-950 md:text-4xl">
            Questions <span className="text-violet-600">fréquentes</span>
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-gray-600">
            Tout ce que vous devez savoir sur Merciinternet.
          </p>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="light-card group rounded-xl transition-all"
              >
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-indigo-950">
                  <span className="pr-4 font-medium">{faq.q}</span>
                  <span className="faq-chevron shrink-0 text-violet-400">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </span>
                </summary>
                <div className="px-6 pb-4 text-sm leading-relaxed text-gray-600">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-600 px-8 py-16 text-center">
            <h2 className="mb-6 text-3xl font-bold text-white md:text-5xl">
              Simplifiez votre compta
              <br />
              dès aujourd&apos;hui
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-violet-100">
              Rejoignez les indépendants suisses qui gèrent leur comptabilité
              en quelques clics. Votre fiduciaire vous remerciera.
            </p>
            <Link
              href="/dashboard"
              className="inline-block rounded-full bg-white px-10 py-4 text-base font-semibold text-violet-600 transition-all hover:bg-violet-50 hover:shadow-lg"
            >
              Essayer gratuitement
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-indigo-900/10 bg-indigo-950 px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <div>
              <span className="text-lg font-bold text-white">
                Merci<span className="text-violet-400">internet</span>.ch
              </span>
              <p className="mt-1 text-sm text-indigo-300/60">
                Le Bouveret, Valais, Suisse
              </p>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://wa.me/41794517496"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-300/60 transition-colors hover:text-white"
              >
                WhatsApp
              </a>
              <a
                href="mailto:contact@merciinternet.ch"
                className="text-sm text-indigo-300/60 transition-colors hover:text-white"
              >
                Contact
              </a>
            </div>
          </div>
          <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-indigo-300/40">
            &copy; {new Date().getFullYear()} Merciinternet.ch — Tous droits
            réservés
          </div>
        </div>
      </footer>
    </div>
  );
}
