"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function SignUpPage() {
  const { signUp } = useAuth();
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
          Create your account
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "#616061",
            marginTop: "8px",
          }}
        >
          Get started with Nixo Bot today
        </p>
      </div>

      {/* Form Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
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

          <div style={{ marginBottom: "20px" }}>
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

          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
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
            {isLoading ? "Creating account..." : "Create Account"}
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
        Already have an account?{" "}
        <Link
          href="/signin"
          style={{
            color: "#1264a3",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
