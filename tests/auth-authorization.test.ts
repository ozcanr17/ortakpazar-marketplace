import test from "node:test";
import assert from "node:assert/strict";
import { registerSchema } from "@/lib/domain/auth-validation";
import { assertOrderParticipant, assertOwner, isAdminRole } from "@/lib/domain/authorization";
import { assertRequiredLegalAcceptances } from "@/lib/domain/legal";

test("güçlü parola ve sözleşme olmadan kaydı reddeder", () => { assert.equal(registerSchema.safeParse({ firstName: "Ay", lastName: "Yıl", email: "a@example.com", password: "weak", legalDocumentIds: [] }).success, false); });
test("normal kullanıcı admin değildir", () => { assert.equal(isAdminRole("USER"), false); assert.equal(isAdminRole("ADMIN"), true); });
test("ürün sahipliğini server-side doğrular", () => { assert.doesNotThrow(() => assertOwner("u1", "u1")); assert.throws(() => assertOwner("u1", "u2")); });
test("siparişe üçüncü taraf erişimini reddeder", () => { assert.throws(() => assertOrderParticipant({ buyerId: "b", sellerId: "s" }, "x")); });
test("hukuki kabul snapshot gereksinimini doğrular", () => { assert.doesNotThrow(() => assertRequiredLegalAcceptances(["a", "b"], ["b", "a"])); assert.throws(() => assertRequiredLegalAcceptances(["a", "b"], ["a"])); });
