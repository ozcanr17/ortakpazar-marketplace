"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/app/actions/auth";

export function LoginForm({ returnTo = "/profil" }: { returnTo?: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return <form className="auth-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { const result = await loginAction({ email: String(data.get("email")), password: String(data.get("password")), returnTo }); setMessage(result.message); }); }}><label>E-posta<input name="email" type="email" autoComplete="email" required/></label><label>Parola<input name="password" type="password" autoComplete="current-password" required/></label><div className="form-between"><label className="check"><input type="checkbox"/> Beni hatırla</label><Link href="/sifremi-unuttum">Parolamı unuttum</Link></div>{message && <p className="form-message">{message}</p>}<button className="button primary full" disabled={pending}>{pending ? "Giriş yapılıyor…" : "Giriş yap"}</button><p className="form-alt">Hesabın yok mu? <Link href="/kayit">Ücretsiz kaydol</Link></p></form>;
}

export function RegisterForm({ legalDocuments }: { legalDocuments: Array<{ id: string; title: string }> }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return <form className="auth-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { const result = await registerAction({ firstName: String(data.get("firstName")), lastName: String(data.get("lastName")), email: String(data.get("email")), password: String(data.get("password")), legalDocumentIds: data.getAll("legalDocumentIds").map(String), marketingConsent: data.get("marketingConsent") === "on" }); setMessage(result.message); }); }}><div className="two-col"><label>Ad<input name="firstName" autoComplete="given-name" required/></label><label>Soyad<input name="lastName" autoComplete="family-name" required/></label></div><label>E-posta<input name="email" type="email" autoComplete="email" required/></label><label>Parola<input name="password" type="password" autoComplete="new-password" minLength={10} required/><small>En az 10 karakter, büyük/küçük harf ve rakam</small></label>{legalDocuments.map((document) => <label className="check legal-check" key={document.id}><input name="legalDocumentIds" value={document.id} type="checkbox" required/> {document.title} metnini okudum ve kabul ediyorum</label>)}<label className="check legal-check"><input name="marketingConsent" type="checkbox"/> Kampanya iletileri almak istiyorum. Bu izin üyelik şartı değildir.</label>{message && <p className="form-message">{message}</p>}<button className="button primary full" disabled={pending}>{pending ? "Hesap oluşturuluyor…" : "Hesap oluştur"}</button><p className="form-alt">Zaten hesabın var mı? <Link href="/giris">Giriş yap</Link></p></form>;
}

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState("");
  return <form className="auth-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => setMessage((await forgotPasswordAction(String(data.get("email")))).message)); }}><label>E-posta<input name="email" type="email" autoComplete="email" required/></label>{message && <p className="form-message">{message}</p>}<button className="button primary full" disabled={pending}>Sıfırlama bağlantısı gönder</button></form>;
}

export function ResetPasswordForm() {
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState("");
  return <form className="auth-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => setMessage((await resetPasswordAction(String(data.get("password")))).message)); }}><label>Yeni parola<input name="password" type="password" autoComplete="new-password" minLength={10} required/></label>{message && <p className="form-message">{message}</p>}<button className="button primary full" disabled={pending}>Parolayı güncelle</button></form>;
}
