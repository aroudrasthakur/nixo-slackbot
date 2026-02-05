"use client";

import { useAuth } from "@/context/AuthContext";

function getInitials(user: { given_name?: string; family_name?: string; preferred_username?: string } | null) {
  if (!user) return "U";
  if (user.given_name && user.family_name) {
    return `${user.given_name[0]}${user.family_name[0]}`.toUpperCase();
  }
  if (user.preferred_username) {
    return user.preferred_username.slice(0, 2).toUpperCase();
  }
  return "U";
}

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          borderBottom: "1px solid #e0d4e1",
          background: "linear-gradient(135deg, #f5eef6 0%, #ede4f0 50%, #f9f7fa 100%)",
          padding: "20px 24px",
        }}
      >
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#3F0E40",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          Profile
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#6b4e6d",
            marginTop: "6px",
            marginBottom: 0,
          }}
        >
          Your account information
        </p>
      </div>
      <div style={{ padding: "24px", maxWidth: "600px" }}>

      <div
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        {/* Profile image - same as sidebar avatar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "28px",
            paddingBottom: "24px",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "12px",
              backgroundColor: "#1264A3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "28px",
              flexShrink: 0,
            }}
          >
            {getInitials(user)}
          </div>
          <div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "#1d1c1d",
                marginBottom: "4px",
              }}
            >
              {user?.given_name && user?.family_name
                ? `${user.given_name} ${user.family_name}`
                : user?.preferred_username ?? "User"}
            </div>
            {user?.email && (
              <div style={{ fontSize: "14px", color: "#616061" }}>
                {user.email}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "#616061",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Username
          </label>
          <div style={{ fontSize: "15px", color: "#1d1c1d", fontWeight: 500 }}>
            {user?.preferred_username ?? "—"}
          </div>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "#616061",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Email
          </label>
          <div style={{ fontSize: "15px", color: "#1d1c1d", fontWeight: 500 }}>
            {user?.email ?? "—"}
          </div>
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "#616061",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            First name
          </label>
          <div style={{ fontSize: "15px", color: "#1d1c1d", fontWeight: 500 }}>
            {user?.given_name ?? "—"}
          </div>
        </div>
        <div>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "#616061",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Last name
          </label>
          <div style={{ fontSize: "15px", color: "#1d1c1d", fontWeight: 500 }}>
            {user?.family_name ?? "—"}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
