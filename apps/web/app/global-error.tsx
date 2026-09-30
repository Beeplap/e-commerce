"use client";

export default function GlobalError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
          <h1>We couldn’t open the application</h1>
          <p>Please try again. If the problem continues, contact support.</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
