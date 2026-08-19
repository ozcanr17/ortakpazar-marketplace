"use client";

import { useState, useTransition } from "react";
import { sendMessageAction } from "@/app/actions/marketplace";

export function MessageComposer({ receiverId, receiverName, productId, orderId }: { receiverId: string; receiverName: string; productId?: string; orderId?: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return <form className="message-composer" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const body = String(new FormData(form).get("body") ?? ""); start(async () => { const result = await sendMessageAction({ receiverId, productId, orderId, body }); setMessage(result.message); if (result.ok) { form.reset(); window.location.assign("/mesajlar"); } }); }}><b>{receiverName} kullanıcısına mesaj</b><textarea name="body" minLength={1} maxLength={2000} required placeholder="Mesajınızı yazın"/><button className="button primary" disabled={pending}>{pending ? "Gönderiliyor…" : "Mesaj gönder"}</button>{message && <small>{message}</small>}</form>;
}
