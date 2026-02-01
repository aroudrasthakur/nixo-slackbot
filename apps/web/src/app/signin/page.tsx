"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function SignInForm() {
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verifiedMessage, setVerifiedMessage] = useState(false);

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
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: "32px", textAlign: "center" }}>
        <img
          src="/images/logo.png"
          alt="Nixo Bot"
          style={{
            width: "64px",
            height: "64px",
            objectFit: "contain",
            margin: "0 auto 16px",
            display: "block",
          }}
        />
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "#1d1c1d",
            margin: 0,
          }}
        >
          Sign in to Nixo Bot
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "#616061",
            marginTop: "8px",
          }}
        >
          Enter your credentials to access your dashboard
        </p>
      </div>

      {/* Form Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#ffffff",
          border: "1px solid #e0e0e0",
          borderRadius: "12px",
          padding: "32px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
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
                e.target.style.boxShadow = "0 0 0 3px rgba(18, 100, 163, 0.1)";
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
                e.target.style.boxShadow = "0 0 0 3px rgba(18, 100, 163, 0.1)";
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
          marginTop: "24px",
          fontSize: "14px",
          color: "#616061",
        }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          style={{
            color: "#1264a3",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Create one
        </Link>
      </p>
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
