import AdminTabs from "@/components/AdminTabs";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-2">
      <AdminTabs />
      {children}
    </div>
  );
}
