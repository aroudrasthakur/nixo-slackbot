"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function SignInForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signIn, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verifiedMessage, setVerifiedMessage] = useState(false);

  const fromParam = searchParams.get("from");
  const requiresDashboardAccess =
    fromParam === "dashboard" || fromParam?.startsWith("/dashboard");

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, isAuthenticated, router]);

  useEffect(() => {
    const emailFromUrl = searchParams.get("email");
    if (emailFromUrl) {
      setEmail(decodeURIComponent(emailFromUrl));
      setVerifiedMessage(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await signIn({ email, password });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to sign in";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "row",
        position: "relative",
        background:
          "linear-gradient(135deg, #f8f4ff 0%, #ede5ff 30%, #f5f0ff 70%, #faf8fc 100%)",
      }}
    >
      {/* Back to home */}
      <Link
        href="/"
        style={{
          position: "absolute",
          top: "24px",
          left: "24px",
          zIndex: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          color: "#3F0E40",
          fontWeight: 600,
          fontSize: "14px",
          textDecoration: "none",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 2L5 8l6 6" />
        </svg>
        Back to home
      </Link>

      {/* Left: Logo + Tagline */}
      <div
        className="auth-left-panel"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px",
          minHeight: "100vh",
        }}
      >
        <img
          src="/images/logo.png"
          alt="Nixo Bot"
          style={{
            width: "80px",
            height: "80px",
            objectFit: "contain",
            marginBottom: "24px",
          }}
        />
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "#1d1c1d",
            margin: 0,
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          Support tickets, <span style={{ color: "#3F0E40" }}>simplified</span>
        </h1>
      </div>

      {/* Right: Form */}
      <div
        className="auth-right-panel"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px",
          minHeight: "100vh",
          backgroundColor: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
          }}
        >
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#1d1c1d",
              margin: "0 0 8px 0",
            }}
          >
            Sign in to Nixo Bot
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "#616061",
              marginBottom: "28px",
            }}
          >
            Enter your credentials to access your dashboard
          </p>

          {/* Form Card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "28px",
              boxShadow: "0 4px 24px rgba(63, 14, 64, 0.08)",
              border: "1px solid rgba(63, 14, 64, 0.08)",
            }}
          >
            <form onSubmit={handleSubmit}>
              {verifiedMessage && (
                <div
                  style={{
                    padding: "12px 16px",
                    backgroundColor: "#e8f5e9",
                    border: "1px solid #2eb886",
                    borderRadius: "8px",
                    marginBottom: "20px",
                    fontSize: "14px",
                    color: "#2eb886",
                  }}
                >
                  Account verified. Sign in to continue.
                </div>
              )}

              {error && (
                <div
                  style={{
                    padding: "12px 16px",
                    backgroundColor: "#fef0f0",
                    border: "1px solid #e01e5a",
                    borderRadius: "8px",
                    marginBottom: "20px",
                    fontSize: "14px",
                    color: "#e01e5a",
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#1d1c1d",
                    marginBottom: "8px",
                  }}
                >
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    fontSize: "15px",
                    border: "1px solid #dddddd",
                    borderRadius: "8px",
                    backgroundColor: "#f8f8f8",
                    outline: "none",
                    transition: "all 0.15s ease",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => {
                    e.target.style.backgroundColor = "#ffffff";
                    e.target.style.borderColor = "#1264a3";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(18, 100, 163, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.backgroundColor = "#f8f8f8";
                    e.target.style.borderColor = "#dddddd";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#1d1c1d",
                    marginBottom: "8px",
                  }}
                >
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    fontSize: "15px",
                    border: "1px solid #dddddd",
                    borderRadius: "8px",
                    backgroundColor: "#f8f8f8",
                    outline: "none",
                    transition: "all 0.15s ease",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => {
                    e.target.style.backgroundColor = "#ffffff";
                    e.target.style.borderColor = "#1264a3";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(18, 100, 163, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.backgroundColor = "#f8f8f8";
                    e.target.style.borderColor = "#dddddd";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#ffffff",
                  backgroundColor: isLoading ? "#868686" : "#007a5a",
                  border: "none",
                  borderRadius: "8px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = "#005e46";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = "#007a5a";
                  }
                }}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p
            style={{
              marginTop: "20px",
              fontSize: "14px",
              color: "#616061",
              textAlign: "center",
            }}
          >
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              style={{
                color: "#3F0E40",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Dashboard access message - bottom of screen, red */}
      {requiresDashboardAccess && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "12px 24px",
            backgroundColor: "#fef0f0",
            borderTop: "1px solid #e01e5a",
            fontSize: "14px",
            color: "#e01e5a",
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          You need to sign in to access the dashboard.
        </div>
      )}
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#ffffff",
          }}
        >
          Loading...
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
