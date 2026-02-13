"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type ImageLightboxProps = {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
};

export default function ImageLightbox({ src, alt = "", open, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!open) setScale(1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Image zoom"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={onClose}
        aria-label="Close"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="flex max-h-[100vh] max-w-[100vw] items-center justify-center p-4">
        <div
          className="relative cursor-zoom-in"
          style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
          onClick={() => setScale((s) => (s >= 2 ? 1 : s + 0.5))}
        >
          <Image
            src={src}
            alt={alt}
            width={800}
            height={800}
            className="max-h-[90vh] w-auto max-w-full object-contain"
            unoptimized
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70">Click image to zoom · Esc to close</p>
    </div>
  );
}
