"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { resendConfirmationCode } from "@/lib/cognito";

function VerifyForm() {
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email") || "";

  const { confirmSignUp } = useAuth();
  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      await confirmSignUp(email, code);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to verify email";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setIsResending(true);
    setError("");
    setSuccess("");

    try {
      await resendConfirmationCode(email);
      setSuccess("Verification code sent! Check your email.");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to resend code";
      setError(errorMessage);
    } finally {
      setIsResending(false);
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
          Verify your email
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "#616061",
            marginTop: "8px",
            maxWidth: "360px",
          }}
        >
          We&apos;ve sent a verification code to your email. Enter it below to
          complete your registration.
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

          {success && (
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
              {success}
            </div>
          )}

          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>Email address</label>
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

          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Verification code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit code"
              required
              style={{
                ...inputStyle,
                textAlign: "center",
                fontSize: "20px",
                letterSpacing: "8px",
              }}
              onFocus={handleFocus}
              onBlur={handleBlur}
              maxLength={6}
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
            {isLoading ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        {/* Resend code */}
        <div
          style={{
            marginTop: "20px",
            textAlign: "center",
            paddingTop: "20px",
            borderTop: "1px solid #f0f0f0",
          }}
        >
          <p style={{ fontSize: "14px", color: "#616061", margin: 0 }}>
            Didn&apos;t receive the code?{" "}
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isResending}
              style={{
                color: "#1264a3",
                fontWeight: 600,
                background: "none",
                border: "none",
                cursor: isResending ? "not-allowed" : "pointer",
                padding: 0,
                fontSize: "14px",
              }}
            >
              {isResending ? "Sending..." : "Resend code"}
            </button>
          </p>
        </div>
      </div>

      {/* Footer */}
      <p
        style={{
          marginTop: "24px",
          fontSize: "14px",
          color: "#616061",
        }}
      >
        <Link
          href="/signin"
          style={{
            color: "#1264a3",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Loading...
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
