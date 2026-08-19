export function GET(): Response {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#16533b"/><text x="32" y="43" text-anchor="middle" font-family="Arial" font-size="36" font-weight="700" fill="#d8ff67">O</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } });
}
