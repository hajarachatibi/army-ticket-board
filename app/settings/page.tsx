import RequireAuth from "@/components/RequireAuth";
import SettingsView from "@/components/SettingsView";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <main className="min-h-screen bg-gradient-army-subtle">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <SettingsView />
        </div>
      </main>
    </RequireAuth>
  );
}
