"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const from = pathname ? encodeURIComponent(pathname) : "dashboard";
      router.push(`/signin?from=${from}`);
    }
  }, [isAuthenticated, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <img
            src="/images/logo.png"
            alt="Loading"
            className="loading-logo"
            style={{
              width: "48px",
              height: "48px",
              objectFit: "contain",
              margin: "0 auto 16px",
              display: "block",
            }}
          />
          <p style={{ color: "#616061", fontSize: "14px" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
