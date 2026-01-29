export default function VerifiedAdminBadge({ title = "Verified admin" }: { title?: string }) {
  return (
    <span
      className="ml-1 inline-flex items-center gap-1 align-middle"
      title={title}
      aria-label={title}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 shadow-sm ring-1 ring-white/30">
        <svg
          viewBox="0 0 24 24"
          className="h-3 w-3"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path
            d="M20 7L10.5 16.5L4 10"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-[11px] font-extrabold uppercase tracking-wide text-sky-600 dark:text-sky-400">
        Admin
      </span>
    </span>
  );
}

