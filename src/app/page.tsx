import Link from "next/link";

const features = [
  {
    icon: "🇨🇭",
    title: "Pensé pour la Suisse",
    description:
      "Catégories suisses intégrées : LAMal, 3e pilier, impôts, Serafe, CFF, Coop, Migros... Tout est déjà là.",
  },
  {
    icon: "⚡",
    title: "Simple et rapide",
    description:
      "Ajoutez une dépense en 3 secondes. Interface claire, pas de menus compliqués.",
  },
  {
    icon: "📊",
    title: "Vue claire",
    description:
      "Budget mensuel, ce qu'il vous reste, projection fin de mois. Tout en un coup d'œil.",
  },
  {
    icon: "🎯",
    title: "Objectifs d'épargne",
    description:
      "Vacances, 3e pilier, achat immobilier... Définissez vos objectifs et suivez votre progression.",
  },
];

const categories = [
  { icon: "🏠", name: "Loyer" },
  { icon: "🏥", name: "Caisse maladie" },
  { icon: "🏦", name: "3e pilier" },
  { icon: "📋", name: "Impôts" },
  { icon: "🛒", name: "Courses" },
  { icon: "🚂", name: "Transport" },
  { icon: "📱", name: "Téléphone" },
  { icon: "🛡️", name: "Assurances" },
  { icon: "🍽️", name: "Restaurants" },
  { icon: "🎉", name: "Loisirs" },
  { icon: "👕", name: "Vêtements" },
  { icon: "💰", name: "Épargne" },
  { icon: "📦", name: "Autre" },
];

const faqs = [
  {
    q: "MerciInternet est-il vraiment gratuit ?",
    a: "Oui ! La version gratuite vous donne accès au budget mensuel, aux catégories suisses et à un compte. La version Premium débloque les multi-comptes, les objectifs d'épargne et l'export PDF.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Vos données restent sur votre appareil (stockage local). Aucune donnée n'est envoyée à des tiers. Votre vie privée est notre priorité.",
  },
  {
    q: "Pourquoi une app de budget spécifique à la Suisse ?",
    a: "Les apps internationales ne comprennent pas les spécificités suisses : LAMal, 3e pilier, Serafe, impôts cantonaux... MerciInternet est conçu par des Suisses, pour des Suisses.",
  },
  {
    q: "Puis-je utiliser MerciInternet en euros aussi ?",
    a: "La version gratuite fonctionne en CHF. La version Premium permet de gérer plusieurs devises (CHF et EUR), idéal pour les frontaliers.",
  },
  {
    q: "Comment fonctionne la version Premium ?",
    a: "Pour 4.90 CHF/mois ou 49 CHF/an, vous débloquez : multi-comptes, objectifs d'épargne, export PDF, statistiques détaillées et multi-devises CHF/EUR.",
  },
];

export default function Home() {
  return (
    <div className="landing-dark min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white">
              Merci<span className="text-red-600">Internet</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              Ouvrir l&apos;app
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6 pt-20 text-center">
        <div className="mx-auto max-w-4xl">
          <div className="animate-fade-in-up mb-6 inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-zinc-400">
            100% Suisse · CHF · Gratuit
          </div>
          <h1 className="animate-fade-in-up animate-delay-100 mb-6 text-5xl font-bold leading-tight tracking-tight text-white md:text-7xl">
            Gérez votre budget
            <br />
            <span className="text-red-600">comme un Suisse</span>
          </h1>
          <p className="animate-fade-in-up animate-delay-200 mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
            L&apos;app de budget pensée pour la Suisse. Simple, rapide, en
            francs suisses. Catégories LAMal, 3e pilier, impôts, CFF, Coop,
            Migros...
          </p>
          <div className="animate-fade-in-up animate-delay-300 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard"
              className="w-full rounded-full bg-red-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/25 sm:w-auto"
            >
              Commencer gratuitement
            </Link>
            <a
              href="#features"
              className="w-full rounded-full border border-white/20 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/5 sm:w-auto"
            >
              En savoir plus
            </a>
          </div>
        </div>
        <div className="animate-fade-in-up animate-delay-400 mt-16">
          <svg
            className="h-6 w-6 animate-bounce text-zinc-600"
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
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold text-white md:text-4xl">
            Pourquoi <span className="text-red-600">MerciInternet</span> ?
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-zinc-400">
            Une app de budget qui comprend vraiment la vie en Suisse.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="glass-card rounded-2xl p-6 transition-all hover:border-red-600/30 hover:bg-white/[0.08]"
              >
                <div className="mb-4 text-4xl">{f.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
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
          <h2 className="mb-4 text-center text-3xl font-bold text-white md:text-4xl">
            Catégories <span className="text-red-600">suisses</span>
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-zinc-400">
            Toutes les catégories dont vous avez besoin, déjà prêtes.
          </p>
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {categories.map((c) => (
              <div
                key={c.name}
                className="glass-card flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:bg-white/[0.08]"
              >
                <span className="text-2xl">{c.icon}</span>
                <span className="text-sm font-medium text-white">
                  {c.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center text-3xl font-bold text-white md:text-4xl">
            Tarifs <span className="text-red-600">simples</span>
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-zinc-400">
            Commencez gratuitement, passez en Premium quand vous voulez.
          </p>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {/* Free */}
            <div className="glass-card rounded-2xl p-8">
              <div className="mb-1 text-sm font-medium uppercase tracking-wider text-zinc-400">
                Gratuit
              </div>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">0</span>
                <span className="text-lg text-zinc-400">CHF</span>
              </div>
              <ul className="mb-8 space-y-3">
                {[
                  "1 compte budget",
                  "Budget mensuel",
                  "Catégories suisses",
                  "Saisie rapide des dépenses",
                  "Vue mensuelle",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-sm text-zinc-300"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-green-500"
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
                className="block w-full rounded-full border border-white/20 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-white/5"
              >
                Commencer gratuitement
              </Link>
            </div>

            {/* Premium */}
            <div className="relative rounded-2xl border border-red-600/50 bg-gradient-to-b from-red-600/10 to-transparent p-8">
              <div className="absolute -top-3 right-6 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                Populaire
              </div>
              <div className="mb-1 text-sm font-medium uppercase tracking-wider text-red-400">
                Premium
              </div>
              <div className="mb-1 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">4.90</span>
                <span className="text-lg text-zinc-400">CHF/mois</span>
              </div>
              <div className="mb-6 text-sm text-zinc-500">
                ou 49 CHF/an (2 mois offerts)
              </div>
              <ul className="mb-8 space-y-3">
                {[
                  "Tout du plan Gratuit",
                  "Multi-comptes",
                  "Objectifs d'épargne",
                  "Export PDF",
                  "Statistiques détaillées",
                  "Multi-devises CHF/EUR",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 text-sm text-zinc-300"
                  >
                    <svg
                      className="h-4 w-4 shrink-0 text-red-500"
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
              <button className="block w-full rounded-full bg-red-600 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-red-700">
                Bientôt disponible
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-center text-3xl font-bold text-white md:text-4xl">
            Questions <span className="text-red-600">fréquentes</span>
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-zinc-400">
            Tout ce que vous devez savoir sur MerciInternet.
          </p>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.q}
                className="glass-card group rounded-xl transition-all"
              >
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-white">
                  <span className="pr-4 font-medium">{faq.q}</span>
                  <span className="faq-chevron shrink-0 text-zinc-500">
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
                <div className="px-6 pb-4 text-sm leading-relaxed text-zinc-400">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-3xl font-bold text-white md:text-5xl">
            Prêt à reprendre le contrôle
            <br />
            <span className="text-red-600">de vos finances ?</span>
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-zinc-400">
            Rejoignez MerciInternet et commencez à gérer votre budget en francs
            suisses, avec des catégories qui vous parlent.
          </p>
          <Link
            href="/dashboard"
            className="inline-block rounded-full bg-red-600 px-10 py-4 text-base font-semibold text-white transition-all hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/25"
          >
            Commencer gratuitement
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <div>
              <span className="text-lg font-bold text-white">
                Merci<span className="text-red-600">Internet</span>.ch
              </span>
              <p className="mt-1 text-sm text-zinc-500">
                Le Bouveret, Valais, Suisse
              </p>
            </div>
            <div className="flex items-center gap-6">
              <a
                href="https://wa.me/41794517496"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-400 transition-colors hover:text-white"
              >
                WhatsApp
              </a>
              <a
                href="mailto:contact@merciinternet.ch"
                className="text-sm text-zinc-400 transition-colors hover:text-white"
              >
                Contact
              </a>
            </div>
          </div>
          <div className="mt-8 border-t border-white/5 pt-6 text-center text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} MerciInternet.ch — Tous droits
            réservés
          </div>
        </div>
      </footer>
    </div>
  );
}
