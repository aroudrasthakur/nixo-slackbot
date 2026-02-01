import { Sidebar } from "@/components/Sidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          backgroundColor: "#ffffff",
        }}
      >
        <Sidebar />
        <main style={{ flex: 1, backgroundColor: "#ffffff" }}>{children}</main>
      </div>
    </ProtectedRoute>
  );
}
