"use client";

import { useState, useTransition } from "react";
import { purchaseAction, sendMessageAction, toggleFavoriteAction } from "@/app/actions/marketplace";

export function ProductActions({ productId, sellerId, legalDocuments }: { productId: string; sellerId: string; legalDocuments: Array<{ id: string; title: string }> }) {
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState(""); const [accepted, setAccepted] = useState<string[]>([]);
  const buy = () => startTransition(async () => { if (accepted.length !== legalDocuments.length) { setMessage("Satın alma sözleşmelerini kabul etmelisiniz"); return; } const result = await purchaseAction(productId, accepted); setMessage(result.message); });
  return <div className="product-actions"><div className="checkout-legal">{legalDocuments.map((document) => <label className="check" key={document.id}><input type="checkbox" checked={accepted.includes(document.id)} onChange={(event) => setAccepted((current) => event.target.checked ? [...current, document.id] : current.filter((id) => id !== document.id))}/> {document.title}</label>)}</div><button className="button primary full" disabled={pending} onClick={buy}>Güvenli satın al</button><div className="action-row"><button onClick={() => startTransition(async () => setMessage((await toggleFavoriteAction(productId)).message))}>♡ Favoriye ekle</button><button onClick={() => startTransition(async () => setMessage((await sendMessageAction({ receiverId: sellerId, productId, body: "Merhaba, ürün hâlâ satışta mı?" })).message))}>Satıcıya soru sor</button></div>{message && <p className="form-message">{message}</p>}</div>;
}
