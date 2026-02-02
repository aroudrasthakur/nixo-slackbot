"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/** Password must have: lowercase, uppercase, number, symbol, and be at least 8 chars */
function validatePassword(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one lowercase letter",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one uppercase letter",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one number",
    };
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one symbol (e.g. !@#$%)",
    };
  }
  return { valid: true };
}

/** Maps Cognito signup errors to user-friendly messages */
function getSignUpErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code;
    const name = err.name;
    const msg = err.message?.toLowerCase() ?? "";

    if (
      code === "UsernameExistsException" ||
      name === "UsernameExistsException" ||
      code === "AliasExistsException" ||
      name === "AliasExistsException" ||
      msg.includes("already exists") ||
      msg.includes("already registered")
    ) {
      return "This email is already in use. Sign in or use a different email.";
    }

    if (
      code === "InvalidPasswordException" ||
      name === "InvalidPasswordException" ||
      (msg.includes("password") &&
        (msg.includes("policy") || msg.includes("requirement")))
    ) {
      return "Password is not strong enough. Use at least 8 characters with one lowercase, one uppercase, one number, and one symbol.";
    }

    return err.message;
  }
  return "Failed to create account. Please try again.";
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match. Please make sure both fields are identical."
      );
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.message);
      return;
    }

    setIsLoading(true);

    try {
      await signUp({ email, password, firstName, lastName, username });
    } catch (err: unknown) {
      setError(getSignUpErrorMessage(err));
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
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="e.g. MyPass1!"
                      required
                      style={{ ...inputStyle, paddingRight: "44px" }}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      onPaste={(e) => e.preventDefault()}
                      onCopy={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
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
                  <p
                    style={{
                      marginTop: "6px",
                      fontSize: "12px",
                      color: "#616061",
                      lineHeight: 1.4,
                      marginBottom: 0,
                    }}
                  >
                    At least 8 characters with one lowercase, one uppercase, one
                    number, and one symbol (!@#$%...)
                  </p>
                </div>
                <div>
                  <label style={labelStyle}>Confirm password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      required
                      style={{ ...inputStyle, paddingRight: "44px" }}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      onPaste={(e) => e.preventDefault()}
                      onCopy={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
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
                      {showConfirmPassword ? (
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
