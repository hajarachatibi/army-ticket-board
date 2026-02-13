"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type ImageLightboxProps = {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
  /** When provided with length > 1, enables swipe/prev/next between images. */
  images?: string[];
  /** Index into `images` when opening; only used when `images` is provided. */
  initialIndex?: number;
};

const SWIPE_THRESHOLD = 50;

export default function ImageLightbox({ src, alt = "", open, onClose, images, initialIndex = 0 }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const hasMultiple = Boolean(images && images.length > 1);
  const displaySrc = hasMultiple ? images![currentIndex] : src;
  const displayAlt = hasMultiple ? `${alt} (${currentIndex + 1}/${images!.length})` : alt;

  useEffect(() => {
    if (!open) setScale(1);
  }, [open]);

  useEffect(() => {
    if (open && hasMultiple && initialIndex >= 0 && initialIndex < images!.length) {
      setCurrentIndex(initialIndex);
    }
  }, [open, hasMultiple, initialIndex, images?.length]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (hasMultiple) {
        if (e.key === "ArrowLeft") setCurrentIndex((i) => (i <= 0 ? images!.length - 1 : i - 1));
        if (e.key === "ArrowRight") setCurrentIndex((i) => (i >= images!.length - 1 ? 0 : i + 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, hasMultiple, images?.length]);

  const goPrev = useCallback(() => {
    if (!hasMultiple || !images?.length) return;
    setCurrentIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
  }, [hasMultiple, images?.length]);

  const goNext = useCallback(() => {
    if (!hasMultiple || !images?.length) return;
    setCurrentIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
  }, [hasMultiple, images?.length]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current == null || !hasMultiple || !images?.length) return;
      const endX = e.changedTouches[0].clientX;
      const delta = touchStartX.current - endX;
      touchStartX.current = null;
      if (delta > SWIPE_THRESHOLD) goNext();
      else if (delta < -SWIPE_THRESHOLD) goPrev();
    },
    [hasMultiple, images?.length, goPrev, goNext]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Image zoom"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
      {hasMultiple && (
        <>
          <button
            type="button"
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:left-4"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous image"
          >
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next image"
          >
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="absolute left-1/2 top-4 z-10 -translate-x-1/2 text-sm text-white/80">
            {currentIndex + 1} / {images!.length}
          </span>
        </>
      )}
      <div className="flex max-h-[100vh] max-w-[100vw] items-center justify-center p-4">
        <div
          className="relative cursor-zoom-in touch-none"
          style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
          onClick={() => setScale((s) => (s >= 2 ? 1 : s + 0.5))}
        >
          <Image
            src={displaySrc}
            alt={displayAlt}
            width={800}
            height={800}
            className="max-h-[90vh] w-auto max-w-full object-contain"
            unoptimized
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </div>
      </div>
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70">
        {hasMultiple ? "Swipe or use arrows to change image · " : ""}Click image to zoom · Esc to close
      </p>
    </div>
  );
}
