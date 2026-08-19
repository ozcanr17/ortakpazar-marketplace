"use client";

import { useState, useTransition } from "react";
import { confirmDeliveryAction, createDataRequestAction, createReviewAction, openDisputeAction, shipOrderAction } from "@/app/actions/marketplace";

export function PrivacyActions() {
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState("");
  return <div className="privacy-actions"><button disabled={pending} onClick={() => startTransition(async () => setMessage((await createDataRequestAction("EXPORT")).message))}>Verilerimi dışa aktar</button><button disabled={pending} className="danger" onClick={() => startTransition(async () => setMessage((await createDataRequestAction("DELETION")).message))}>Hesap silme talebi oluştur</button>{message && <p className="form-message">{message}</p>}</div>;
}

export function OrderActions({ orderId, mode, status }: { orderId: string; mode: "BUYER" | "SELLER"; status: string }) {
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState("");
  const ship = () => { const company = window.prompt("Kargo firması"); const trackingNumber = window.prompt("Takip numarası"); if (company && trackingNumber) startTransition(async () => setMessage((await shipOrderAction({ orderId, company, trackingNumber })).message)); };
  const dispute = () => { const description = window.prompt("Sorunu en az 20 karakterle açıklayın"); if (description) startTransition(async () => setMessage((await openDisputeAction({ orderId, reason: "OTHER", description })).message)); };
  const review = () => { const rating = Number(window.prompt("1-5 arasında puan verin")); if (rating) startTransition(async () => setMessage((await createReviewAction({ orderId, rating })).message)); };
  return <div className="order-actions">{mode === "SELLER" && status === "SELLER_PREPARING" && <button disabled={pending} onClick={ship}>Kargoya ver</button>}{mode === "BUYER" && ["DELIVERED", "BUYER_CONFIRMATION_PENDING"].includes(status) && <button disabled={pending} onClick={() => startTransition(async () => setMessage((await confirmDeliveryAction(orderId)).message))}>Teslim aldım</button>}{!["REFUNDED", "CANCELLED"].includes(status) && <button disabled={pending} onClick={dispute}>Sorun bildir</button>}{status === "COMPLETED" && <button disabled={pending} onClick={review}>Değerlendir</button>}{message && <small>{message}</small>}</div>;
}
