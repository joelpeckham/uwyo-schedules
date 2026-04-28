"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Last-resort error boundary that wraps the root layout itself. We cannot use
 * the design system here because globals.css and providers may not have
 * mounted, so the styling is intentionally inline.
 */
export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          background: "#FBF7F0",
          color: "#1F1A14",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "32rem", width: "100%" }}>
          <p
            style={{
              fontSize: "0.75rem",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "#6B6357",
              margin: 0,
            }}
          >
            Something went wrong
          </p>
          <h1
            style={{
              margin: "0.5rem 0 0",
              fontSize: "1.75rem",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            We hit an unexpected error.
          </h1>
          <p style={{ marginTop: "1rem", lineHeight: 1.55 }}>
            The page failed to render. Try again or head back home.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: "0.5rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.75rem",
                color: "#6B6357",
              }}
            >
              Error reference: {error.digest}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "#1F1A14",
                color: "#FBF7F0",
                border: "1px solid #1F1A14",
                borderRadius: "0.5rem",
                padding: "0.5rem 0.875rem",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.assign("/");
                }
              }}
              style={{
                background: "transparent",
                color: "#1F1A14",
                border: "1px solid #1F1A14",
                borderRadius: "0.5rem",
                padding: "0.5rem 0.875rem",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
