type StatsCardProps = {
  title: string;
  value: string | number;
  sub?: string;
};

export default function StatsCard({ title, value, sub }: StatsCardProps) {
  return (
    <div className="rounded-xl border border-army-purple/15 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover dark:border-army-purple/25 dark:bg-neutral-900">
      <p className="text-sm font-semibold uppercase tracking-wide text-army-purple/80">{title}</p>
      <p className="mt-1 font-display text-2xl font-bold text-army-purple md:text-3xl">{value}</p>
      {sub != null && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{sub}</p>}
    </div>
  );
}
