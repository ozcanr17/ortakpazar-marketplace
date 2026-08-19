import test from "node:test";
import assert from "node:assert/strict";
import { calculateCommission } from "@/lib/domain/commission";

test("yüzde komisyonu kuruş cinsinden hesaplar", () => { assert.deepEqual(calculateCommission(1_000_000, { type: "PERCENTAGE", percentageBasisPoints: 500, fixedFeeKurus: 0, minimumFeeKurus: 0, maximumFeeKurus: null }), { platformFeeKurus: 50_000, sellerNetAmountKurus: 950_000 }); });
test("hibrit, minimum ve maksimum komisyonu uygular", () => { assert.equal(calculateCommission(500_000, { type: "HYBRID", percentageBasisPoints: 500, fixedFeeKurus: 10_000, minimumFeeKurus: 20_000, maximumFeeKurus: 30_000 }).platformFeeKurus, 30_000); });
test("geçersiz para değerini reddeder", () => { assert.throws(() => calculateCommission(10.5, { type: "FIXED", percentageBasisPoints: 0, fixedFeeKurus: 1, minimumFeeKurus: 0, maximumFeeKurus: null })); });
