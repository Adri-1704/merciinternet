"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères"); return; }
    if (password !== confirmPassword) { setError("Les mots de passe ne correspondent pas"); return; }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      // Auto-login if email confirmation is not required
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (!loginError) {
        router.push("/dashboard");
      }
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 text-4xl">✉️</div>
          <h1 className="text-xl font-bold text-indigo-950">Vérifiez votre email</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Un lien de confirmation a été envoyé à <strong>{email}</strong>.
            Cliquez dessus pour activer votre compte.
          </p>
          <Link href="/auth/login" className="mt-6 inline-block text-sm font-semibold text-violet-600">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-indigo-950">
            Merci<span className="text-violet-600">internet</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-500">Créez votre compte gratuitement</p>
        </div>
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-base focus:border-violet-500 focus:outline-none"
              placeholder="votre@email.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-base focus:border-violet-500 focus:outline-none"
              placeholder="6 caractères minimum"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-base focus:border-violet-500 focus:outline-none"
              placeholder="Retapez votre mot de passe"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? "Création..." : "Créer mon compte"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Déjà un compte ?{" "}
          <Link href="/auth/login" className="font-semibold text-violet-600 hover:text-violet-700">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
