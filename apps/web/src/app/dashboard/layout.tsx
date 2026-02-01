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
        {/* Fixed sidebar */}
        <Sidebar />
        {/* Main content with left margin to account for fixed sidebar */}
        <main
          style={{
            flex: 1,
            marginLeft: "260px",
            backgroundColor: "#ffffff",
            minHeight: "100vh",
          }}
        >
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
