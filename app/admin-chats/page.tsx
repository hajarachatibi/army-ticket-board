import RequireAuth from "@/components/RequireAuth";
import AdminChatsPageContent from "@/app/admin-chats/AdminChatsPageContent";

export default function AdminChatsPage() {
  return (
    <RequireAuth>
      <main className="min-h-screen bg-gradient-army-subtle">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <AdminChatsPageContent />
        </div>
      </main>
    </RequireAuth>
  );
}

