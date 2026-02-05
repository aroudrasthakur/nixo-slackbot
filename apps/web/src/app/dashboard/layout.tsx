"use client";

import { useState } from "react";
import { Sidebar, SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from "@/components/Sidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <ProtectedRoute>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          backgroundColor: "#ffffff",
        }}
      >
        {/* Collapsible sidebar */}
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        {/* Main content with animated margin */}
        <main
          style={{
            flex: 1,
            marginLeft: `${sidebarWidth}px`,
            backgroundColor: "#ffffff",
            minHeight: "100vh",
            transition: "margin-left 0.25s ease",
          }}
        >
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
