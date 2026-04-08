"use client";

import { useState, useRef, useCallback } from "react";

const CATEGORIES = [
  { id: "loyer", icon: "🏠", name: "Loyer" },
  { id: "lamal", icon: "🏥", name: "Caisse maladie" },
  { id: "3epilier", icon: "🏦", name: "3e pilier" },
  { id: "impots", icon: "📋", name: "Impôts" },
  { id: "courses", icon: "🛒", name: "Courses" },
  { id: "transport", icon: "🚂", name: "Transport" },
  { id: "telephone", icon: "📱", name: "Téléphone" },
  { id: "assurances", icon: "🛡️", name: "Assurances" },
  { id: "restaurants", icon: "🍽️", name: "Restaurants" },
  { id: "loisirs", icon: "🎉", name: "Loisirs" },
  { id: "vetements", icon: "👕", name: "Vêtements" },
  { id: "epargne", icon: "💰", name: "Épargne" },
  { id: "poursuites", icon: "⚖️", name: "Poursuites" },
  { id: "arrangements", icon: "📝", name: "Arrangements" },
  { id: "autre", icon: "📦", name: "Autre" },
  { id: "materiel", icon: "💻", name: "Matériel" },
  { id: "logiciel", icon: "🖥️", name: "Logiciel / Abo" },
  { id: "comptable", icon: "📊", name: "Comptable / Fiduciaire" },
  { id: "bureau", icon: "🏢", name: "Loyer bureau" },
  { id: "deplacement", icon: "🚗", name: "Déplacement pro" },
  { id: "formation", icon: "📚", name: "Formation" },
  { id: "marketing", icon: "📣", name: "Marketing / Pub" },
  { id: "soustraitance", icon: "🤝", name: "Sous-traitance" },
] as const;

interface Props {
  onExpensesAdded: (
    expenses: {
      amount: number;
      category: string;
      description: string;
      date: string;
    }[],
    receiptImage?: string
  ) => void;
  onClose: () => void;
}

function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, mediaType: "image/jpeg" });
      };
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function ReceiptScanner({ onExpensesAdded, onClose }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  // Editable fields after scan
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("autre");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setScanned(false);

    // Show preview
    const previewReader = new FileReader();
    previewReader.onload = () => setPreview(previewReader.result as string);
    previewReader.readAsDataURL(file);

    // Compress and send
    setLoading(true);
    try {
      const { base64, mediaType } = await compressImage(file);

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'analyse");
        setLoading(false);
        return;
      }

      // Pre-fill with scanned data
      setDescription(data.store || "Achat");
      setAmount(data.total ? String(data.total) : "");
      setDate(data.date || new Date().toISOString().split("T")[0]);
      setCategory(data.suggestedCategory || "autre");
      setScanned(true);
    } catch {
      setError("Erreur de connexion. Vérifiez votre réseau.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAdd = () => {
    const parsedAmount = parseFloat(amount);
    if (!description.trim() || isNaN(parsedAmount) || parsedAmount <= 0) return;

    onExpensesAdded(
      [{
        amount: Math.round(parsedAmount * 100) / 100,
        category,
        description: description.trim(),
        date,
      }],
      preview || undefined
    );
  };

  const handleRetry = () => {
    setPreview(null);
    setScanned(false);
    setError(null);
    setDescription("");
    setAmount("");
    setDate("");
    setCategory("autre");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    fileInputRef.current?.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Scanner un ticket</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* File input (hidden) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Initial state: show upload button */}
        {!preview && !loading && !scanned && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-100">
              <svg className="h-10 w-10 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-700">
                Prenez en photo votre ticket ou facture
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Le montant, la date et la catégorie seront détectés automatiquement
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 active:bg-violet-800"
            >
              Choisir une image
            </button>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="mb-4 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Ticket"
              className="w-full max-h-48 object-cover"
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
            <p className="text-sm font-medium text-zinc-600">Analyse en cours...</p>
            <p className="text-xs text-zinc-400">Cela peut prendre quelques secondes</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              onClick={handleRetry}
              className="mt-2 text-sm font-semibold text-red-600 underline"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Scanned result: simple editable form */}
        {scanned && !loading && (
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-xs font-medium text-emerald-700">Ticket analysé avec succès</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Montant CHF</label>
                <input
                  type="number"
                  step="0.05"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base font-semibold focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Annuler
              </button>
              <button
                onClick={handleAdd}
                disabled={!amount || parseFloat(amount) <= 0}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:bg-zinc-300 disabled:text-zinc-500"
              >
                Ajouter
              </button>
            </div>

            <button
              onClick={handleRetry}
              className="w-full text-center text-xs text-zinc-400 underline"
            >
              Scanner un autre ticket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
