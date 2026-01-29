"use client";

import { useEffect, useState } from "react";

import { fetchPublicStats, type PublicStats } from "@/lib/supabase/publicStats";
import StatsCard from "./StatsCard";

export default function HomeStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    fetchPublicStats().then(({ data }) => {
      if (data) setStats(data);
    });
  }, []);

  if (!stats) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <h2 className="font-display text-2xl font-bold text-army-purple sm:text-3xl">Quick stats</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard title="Tickets available" value={stats.tickets} />
        <StatsCard title="Active events" value={stats.events} />
        <StatsCard title="Tickets sold" value={stats.sold} />
      </div>
    </section>
  );
}
