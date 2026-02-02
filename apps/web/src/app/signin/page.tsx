"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/** Maps Cognito/auth errors to user-friendly sign-in messages. */
function getSignInErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code;
    const name = err.name;
    const msg = err.message?.toLowerCase() ?? "";

    // NotAuthorizedException = wrong email or password (Cognito doesn't distinguish)
    if (
      code === "NotAuthorizedException" ||
      name === "NotAuthorizedException" ||
      msg.includes("incorrect") ||
      msg.includes("invalid") ||
      msg.includes("not authorized")
    ) {
      return "Incorrect email or password. Please try again.";
    }

    // UserNotConfirmedException = email not verified
    if (
      code === "UserNotConfirmedException" ||
      name === "UserNotConfirmedException" ||
      msg.includes("confirm")
    ) {
      return err.message;
    }

    return err.message;
  }
  return "Failed to sign in. Please try again.";
}

const SIGNIN_ERROR_KEY = "nixo-signin-error";

function SignInForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signIn, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(SIGNIN_ERROR_KEY);
      if (stored) {
        sessionStorage.removeItem(SIGNIN_ERROR_KEY);
        return stored;
      }
    }
    return "";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [verifiedMessage, setVerifiedMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const fromParam = searchParams.get("from");
  const requiresDashboardAccess =
    fromParam === "dashboard" || fromParam?.startsWith("/dashboard");

  useEffect(() => {
    // Only auto-redirect when already authenticated (e.g. page refresh). Success flow handles its own redirect.
    if (!isAuthLoading && isAuthenticated && !successMessage) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, isAuthenticated, successMessage, router]);

  useEffect(() => {
    const emailFromUrl = searchParams.get("email");
    if (emailFromUrl) {
      setEmail(decodeURIComponent(emailFromUrl));
      setVerifiedMessage(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(SIGNIN_ERROR_KEY);
    }
    setIsLoading(true);

    try {
      await signIn({ email, password });
      setSuccessMessage("Signed in successfully! Redirecting...");
      setTimeout(() => {
        router.replace("/dashboard");
      }, 1500);
    } catch (err: unknown) {
      const errorMessage = getSignInErrorMessage(err);
      setError(errorMessage);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(SIGNIN_ERROR_KEY, errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="auth-split-layout"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "row",
        position: "relative",
        overflowY: "auto",
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
          overflowY: "auto",
        }}
      >
        {/* Sticky success banner */}
        {successMessage && (
          <div
            role="status"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              width: "100%",
              maxWidth: "400px",
              padding: "12px 16px",
              backgroundColor: "#e8f5e9",
              border: "1px solid #2eb886",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "14px",
              color: "#2eb886",
              fontWeight: 500,
            }}
          >
            {successMessage}
          </div>
        )}
        {/* Sticky error banner - always visible when present */}
        {error && (
          <div
            ref={errorRef}
            role="alert"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              width: "100%",
              maxWidth: "400px",
              padding: "12px 16px",
              backgroundColor: "#fef0f0",
              border: "1px solid #e01e5a",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "14px",
              color: "#e01e5a",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit(e);
              }}
            >
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
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    style={{
                      width: "100%",
                      padding: "12px 44px 12px 14px",
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
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "#616061",
                    }}
                  >
                    {showPassword ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !!successMessage}
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
                {successMessage
                  ? "Redirecting..."
                  : isLoading
                  ? "Signing in..."
                  : "Sign In"}
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
