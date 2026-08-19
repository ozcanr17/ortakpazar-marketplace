export interface IdentityVerificationRequest { userId: string; sellerType: "INDIVIDUAL" | "BUSINESS" }
export interface IdentityVerificationResult { reference: string; status: "PENDING" | "VERIFIED" | "REJECTED" }
export interface IdentityVerificationProvider { createVerification(request: IdentityVerificationRequest): Promise<IdentityVerificationResult>; getStatus(reference: string): Promise<IdentityVerificationResult> }

export class MockIdentityVerificationProvider implements IdentityVerificationProvider {
  private readonly results = new Map<string, IdentityVerificationResult>();
  async createVerification(): Promise<IdentityVerificationResult> { const result = { reference: crypto.randomUUID(), status: "PENDING" as const }; this.results.set(result.reference, result); return result; }
  async getStatus(reference: string): Promise<IdentityVerificationResult> { return this.results.get(reference) ?? { reference, status: "REJECTED" }; }
}
