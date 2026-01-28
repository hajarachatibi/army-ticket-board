"use client";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-army-purple/10 bg-white/80 py-6 dark:bg-[#0f0f0f]/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
          © {year} Army Ticket Board. Made by Army, for Army. 🟣
        </p>
      </div>
    </footer>
  );
}
