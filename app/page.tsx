import Link from "next/link";

import HomeStats from "@/components/HomeStats";

const NEWS = [
  { title: "Arirang World Tour — Seoul dates announced", date: "2025-01-15" },
  { title: "Ticket request window opens next week", date: "2025-01-10" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section
        className="relative flex min-h-[320px] flex-col items-center justify-center gap-6 px-4 py-16 text-white sm:min-h-[380px] sm:gap-8 sm:py-24"
        aria-label="Hero"
      >
        <div
          className="absolute inset-0 bg-cover bg-no-repeat"
          style={{
            backgroundImage: "url(/bts-hero.png)",
            backgroundPosition: "center 25%",
          }}
        />
        <div className="hero-overlay absolute inset-0" />
        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight drop-shadow-lg sm:text-5xl md:text-6xl">
            Army Ticket Board
          </h1>
          <p className="max-w-xl text-lg text-white/90 sm:text-xl">
            Browse and post face-value BTS concert listings with ARMY.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link href="/tickets" className="btn-army rounded-xl px-8 py-4 text-lg">
              Browse Listings
            </Link>
            <Link href="/tickets" className="btn-army-outline rounded-xl px-8 py-4 text-lg">
              Post Listing
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-army-purple/20 bg-army-purple/5 py-6 dark:border-army-purple/30 dark:bg-army-purple/10">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="font-display text-lg font-bold text-army-purple sm:text-xl">
            Made by Army, for Army.
          </p>
          <p className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 sm:text-base">
            Only <strong>face value</strong> is accepted. If you list or buy above face value, ARMY will report you and you will be <strong>banned from the platform</strong>.
          </p>
        </div>
      </section>

      <HomeStats />

      <section className="hidden bg-gradient-army-subtle py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-army-purple sm:text-3xl">
            Recent news &amp; announcements
          </h2>
          <ul className="mt-6 space-y-3">
            {NEWS.map((item) => (
              <li
                key={item.title}
                className="rounded-xl border border-army-purple/15 bg-white p-4 transition-shadow hover:shadow-card dark:border-army-purple/25 dark:bg-neutral-900"
              >
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">{item.title}</p>
                <p className="mt-1 text-sm text-army-purple/80">{item.date}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
