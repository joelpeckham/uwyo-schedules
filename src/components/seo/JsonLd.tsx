type JsonLdProps = {
  /** One JSON-LD object or an array (rendered as `@graph` when length > 1). */
  data: Record<string, unknown> | Record<string, unknown>[];
};

function jsonLdStringForScript(payload: unknown): string {
  // Escape `<` so a string in JSON cannot close the script; U+2028 / U+2029 for older
  // `application/ld+json` / script edge cases in HTML.
  return JSON.stringify(payload)
    .replaceAll("<", "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data }: JsonLdProps) {
  const payload = Array.isArray(data)
    ? {
        "@context": "https://schema.org",
        "@graph": data,
      }
    : data;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdStringForScript(payload) }}
    />
  );
}
