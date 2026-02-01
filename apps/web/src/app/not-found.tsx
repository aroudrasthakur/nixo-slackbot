import Link from "next/link";

export default function NotFound() {
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
      <div style={{ textAlign: "center", maxWidth: "400px" }}>
        <img
          src="/images/logo.png"
          alt="Nixo Bot"
          style={{
            width: "64px",
            height: "64px",
            objectFit: "contain",
            margin: "0 auto 24px",
            display: "block",
          }}
        />
        <h1
          style={{
            fontSize: "72px",
            fontWeight: 700,
            color: "#3F0E40",
            margin: "0 0 8px 0",
            lineHeight: 1,
          }}
        >
          404
        </h1>
        <h2
          style={{
            fontSize: "22px",
            fontWeight: 600,
            color: "#1d1c1d",
            margin: "0 0 12px 0",
          }}
        >
          Page not found
        </h2>
        <p
          style={{
            fontSize: "15px",
            color: "#616061",
            margin: "0 0 28px 0",
            lineHeight: 1.5,
          }}
        >
          The page you’re looking for doesn’t exist or has been moved.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#3F0E40",
              textDecoration: "none",
              borderRadius: "8px",
              transition: "background-color 0.15s",
            }}
          >
            Go home
          </Link>
          <Link
            href="/dashboard"
            style={{
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#1d1c1d",
              backgroundColor: "#ffffff",
              border: "1px solid #dddddd",
              textDecoration: "none",
              borderRadius: "8px",
              transition: "all 0.15s",
            }}
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
