"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function SignUpPage() {
  const router = useRouter();
  const { signUp, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthLoading, isAuthenticated, router]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      await signUp({ email, password, firstName, lastName, username });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create account";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    fontSize: "15px",
    border: "1px solid #dddddd",
    borderRadius: "8px",
    backgroundColor: "#f8f8f8",
    outline: "none",
    transition: "all 0.15s ease",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#1d1c1d",
    marginBottom: "8px",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.backgroundColor = "#ffffff";
    e.target.style.borderColor = "#1264a3";
    e.target.style.boxShadow = "0 0 0 3px rgba(18, 100, 163, 0.1)";
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.backgroundColor = "#f8f8f8";
    e.target.style.borderColor = "#dddddd";
    e.target.style.boxShadow = "none";
  };

  return (
    <div
      className="auth-split-layout"
      style={{
        height: "100vh",
        overflow: "hidden",
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
          padding: "32px",
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
          padding: "24px 32px",
          minHeight: "100vh",
          backgroundColor: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "440px",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#1d1c1d",
              margin: "0 0 4px 0",
            }}
          >
            Create your account
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "#616061",
              marginBottom: "16px",
            }}
          >
            Get started with Nixo Bot today
          </p>

          {/* Form Card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 4px 24px rgba(63, 14, 64, 0.08)",
              border: "1px solid rgba(63, 14, 64, 0.08)",
            }}
          >
            <form onSubmit={handleSubmit}>
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

              {/* Name row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <label style={labelStyle}>First name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Last name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
              </div>

              {/* Username + Email row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div>
                  <label style={labelStyle}>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                    required
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
              </div>

              {/* Password + Confirm row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8+ characters"
                    required
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Confirm</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm"
                    required
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "14px",
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
                {isLoading ? "Creating account..." : "Create Account"}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p
            style={{
              marginTop: "12px",
              fontSize: "13px",
              color: "#616061",
              textAlign: "center",
            }}
          >
            Already have an account?{" "}
            <Link
              href="/signin"
              style={{
                color: "#3F0E40",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
