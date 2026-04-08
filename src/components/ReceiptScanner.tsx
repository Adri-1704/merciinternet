"use client";

import { useState, useRef, useCallback } from "react";

const CATEGORIES = [
  { id: "loyer", icon: "\u{1F3E0}", name: "Loyer" },
  { id: "lamal", icon: "\u{1F3E5}", name: "Caisse maladie" },
  { id: "3epilier", icon: "\u{1F3E6}", name: "3e pilier" },
  { id: "impots", icon: "\u{1F4CB}", name: "Imp\u00f4ts" },
  { id: "courses", icon: "\u{1F6D2}", name: "Courses" },
  { id: "transport", icon: "\u{1F682}", name: "Transport" },
  { id: "telephone", icon: "\u{1F4F1}", name: "T\u00e9l\u00e9phone" },
  { id: "assurances", icon: "\u{1F6E1}\uFE0F", name: "Assurances" },
  { id: "restaurants", icon: "\u{1F37D}\uFE0F", name: "Restaurants" },
  { id: "loisirs", icon: "\u{1F389}", name: "Loisirs" },
  { id: "vetements", icon: "\u{1F455}", name: "V\u00eatements" },
  { id: "epargne", icon: "\u{1F4B0}", name: "\u00C9pargne" },
  { id: "autre", icon: "\u{1F4E6}", name: "Autre" },
] as const;

interface ScannedItem {
  description: string;
  amount: number;
  selected: boolean;
  category: string;
}

interface Props {
  onExpensesAdded: (
    expenses: {
      amount: number;
      category: string;
      description: string;
      date: string;
    }[]
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
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [store, setStore] = useState<string | null>(null);
  const [scannedDate, setScannedDate] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setItems([]);
    setStore(null);
    setScannedDate(null);
    setTotal(null);

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

      setStore(data.store || null);
      setScannedDate(data.date || null);
      setTotal(data.total || null);

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        setItems(
          data.items.map((item: { description: string; amount: number }) => ({
            description: item.description || "",
            amount: typeof item.amount === "number" ? item.amount : 0,
            selected: true,
            category: data.suggestedCategory || "autre",
          }))
        );
      } else if (data.total) {
        // If no items but total exists, create a single item
        setItems([
          {
            description: data.store || "Achat",
            amount: data.total,
            selected: true,
            category: data.suggestedCategory || "autre",
          },
        ]);
      } else {
        setError("Aucun article trouv\u00e9 sur ce ticket");
      }
    } catch {
      setError("Erreur de connexion. V\u00e9rifiez votre r\u00e9seau.");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleItem = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const updateCategory = (index: number, category: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, category } : item
      )
    );
  };

  const selectedItems = items.filter((item) => item.selected);
  const selectedTotal = selectedItems.reduce((s, item) => s + item.amount, 0);

  const handleAdd = () => {
    const today = new Date();
    const fallbackDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const dateToUse = scannedDate || fallbackDate;

    onExpensesAdded(
      selectedItems.map((item) => ({
        amount: Math.round(item.amount * 100) / 100,
        category: item.category,
        description: item.description,
        date: dateToUse,
      }))
    );
  };

  const handleRetry = () => {
    setPreview(null);
    setItems([]);
    setError(null);
    setStore(null);
    setScannedDate(null);
    setTotal(null);
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
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Initial state: show upload button */}
        {!preview && !loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-100">
              <svg className="h-10 w-10 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-700">
                Prenez en photo votre ticket de caisse
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                ou selectionnez une image depuis votre galerie
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
              Reessayer
            </button>
          </div>
        )}

        {/* Results */}
        {items.length > 0 && !loading && (
          <>
            {/* Store info */}
            {(store || scannedDate) && (
              <div className="mb-3 rounded-xl bg-zinc-50 p-3">
                {store && (
                  <p className="text-sm font-semibold text-zinc-800">{store}</p>
                )}
                {scannedDate && (
                  <p className="text-xs text-zinc-500">{scannedDate}</p>
                )}
                {total !== null && (
                  <p className="text-xs font-medium text-zinc-600">
                    Total: {total.toFixed(2)} CHF
                  </p>
                )}
              </div>
            )}

            {/* Items list */}
            <div className="mb-4 space-y-2">
              {items.map((item, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-3 transition-colors ${
                    item.selected
                      ? "border-violet-200 bg-violet-50/50"
                      : "border-zinc-200 bg-zinc-50 opacity-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleItem(i)}
                      className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                        item.selected
                          ? "border-violet-600 bg-violet-600"
                          : "border-zinc-300"
                      }`}
                    >
                      {item.selected && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-800 truncate">
                          {item.description}
                        </p>
                        <p className="text-sm font-bold text-zinc-900 flex-shrink-0">
                          {item.amount.toFixed(2)} CHF
                        </p>
                      </div>

                      {/* Category selector */}
                      <select
                        value={item.category}
                        onChange={(e) => updateCategory(i, e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 focus:border-violet-500 focus:outline-none"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary and actions */}
            <div className="space-y-3">
              {selectedItems.length > 0 && (
                <div className="flex justify-between rounded-xl bg-violet-50 p-3 text-sm font-bold text-violet-700">
                  <span>{selectedItems.length} article{selectedItems.length > 1 ? "s" : ""} selectionne{selectedItems.length > 1 ? "s" : ""}</span>
                  <span>{selectedTotal.toFixed(2)} CHF</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAdd}
                  disabled={selectedItems.length === 0}
                  className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:bg-zinc-300 disabled:text-zinc-500"
                >
                  Ajouter {selectedItems.length > 0 ? `${selectedItems.length} depense${selectedItems.length > 1 ? "s" : ""}` : ""}
                </button>
              </div>

              <button
                onClick={handleRetry}
                className="w-full text-center text-xs text-zinc-400 underline"
              >
                Scanner un autre ticket
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
