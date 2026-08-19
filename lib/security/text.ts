const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phonePattern = /(?:\+?90|0)?\s*(?:\d[\s.-]*){10}/g;

export function sanitizeText(input: string, maxLength: number): string {
  return Array.from(input).filter((character) => { const code = character.charCodeAt(0); return code >= 32 && code !== 127 && character !== "<" && character !== ">"; }).join("").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function sanitizeMessage(input: string): string {
  return sanitizeText(input, 2000).replace(emailPattern, "[e-posta gizlendi]").replace(phonePattern, "[telefon gizlendi]");
}
