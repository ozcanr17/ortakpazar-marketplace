export interface ImageVerificationInput { productId: string; challengeCode: string; evidenceImagePath: string }
export interface ImageVerificationResult { confidence: number | null; status: "MANUAL_REVIEW" | "VERIFIED" | "REJECTED" }
export interface ImageVerificationProvider { verify(input: ImageVerificationInput): Promise<ImageVerificationResult> }
export class ManualImageVerificationProvider implements ImageVerificationProvider { async verify(): Promise<ImageVerificationResult> { return { confidence: null, status: "MANUAL_REVIEW" }; } }

export function createVerificationChallenge(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}
