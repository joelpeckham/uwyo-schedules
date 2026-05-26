/** Source Serif 4 (500) for Satori / `ImageResponse` — matches brand wordmark. */
const SOURCE_SERIF_CSS =
  "https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500&display=swap";

/** Older UA so Google Fonts CSS returns a binary (woff) URL Satori can parse. */
const FONT_CSS_UA =
  "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";

export const OG_SERIF_FAMILY = "Source Serif 4";

let sourceSerif500Cache: ArrayBuffer | null = null;

export async function loadSourceSerif500ForOg(): Promise<ArrayBuffer> {
  if (sourceSerif500Cache) return sourceSerif500Cache;

  const css = await fetch(SOURCE_SERIF_CSS, {
    headers: { "User-Agent": FONT_CSS_UA },
  }).then((res) => res.text());

  const match = css.match(/src: url\(([^)]+)\) format\('(?:woff2|woff|truetype|opentype)'\)/);
  if (!match?.[1]) {
    throw new Error("Could not resolve Source Serif 4 font URL from Google Fonts CSS");
  }

  const data = await fetch(match[1]).then((res) => res.arrayBuffer());
  sourceSerif500Cache = data;
  return data;
}
