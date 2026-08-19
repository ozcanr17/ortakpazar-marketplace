"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { forgotPasswordAction, loginAction, logoutAction, registerAction, resetPasswordAction } from "@/app/actions/auth";

export function LoginForm({ returnTo = "/profil" }: { returnTo?: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return <form className="auth-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { try { const result = await loginAction({ email: String(data.get("email")), password: String(data.get("password")), remember: data.get("remember") === "on", returnTo }); setMessage(result.message); if (result.ok && result.redirectTo) window.location.assign(result.redirectTo); } catch { setMessage("Giriş tamamlanamadı. Lütfen tekrar deneyin"); } }); }}><label>E-posta veya kullanıcı adı<input name="email" type="text" autoComplete="username" required placeholder="E-posta veya admin"/></label><label>Parola<input name="password" type="password" autoComplete="current-password" required/></label><div className="form-between"><label className="check"><input name="remember" type="checkbox"/> Beni hatırla</label><Link prefetch={false} href="/sifremi-unuttum">Parolamı unuttum</Link></div>{message && <p className="form-message">{message}</p>}<button className="button primary full" disabled={pending}>{pending ? "Giriş yapılıyor…" : "Giriş yap"}</button><p className="form-alt">Hesabın yok mu? <Link prefetch={false} href="/kayit">Ücretsiz kaydol</Link></p></form>;
}

export function RegisterForm({ legalDocuments }: { legalDocuments: Array<{ id: string; title: string }> }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return <form className="auth-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { try { const result = await registerAction({ firstName: String(data.get("firstName")), lastName: String(data.get("lastName")), email: String(data.get("email")), password: String(data.get("password")), legalDocumentIds: data.getAll("legalDocumentIds").map(String), marketingConsent: data.get("marketingConsent") === "on" }); setMessage(result.message); if (result.ok && result.redirectTo) window.location.assign(result.redirectTo); } catch { setMessage("Kayıt tamamlanamadı. Lütfen tekrar deneyin"); } }); }}><div className="two-col"><label>Ad<input name="firstName" autoComplete="given-name" required/></label><label>Soyad<input name="lastName" autoComplete="family-name" required/></label></div><label>E-posta<input name="email" type="email" autoComplete="email" required/></label><label>Parola<input name="password" type="password" autoComplete="new-password" minLength={10} required/><small>En az 10 karakter, büyük/küçük harf ve rakam</small></label>{legalDocuments.map((document) => <label className="check legal-check" key={document.id}><input name="legalDocumentIds" value={document.id} type="checkbox" required/> {document.title} metnini okudum ve kabul ediyorum</label>)}<label className="check legal-check"><input name="marketingConsent" type="checkbox"/> Kampanya iletileri almak istiyorum. Bu izin üyelik şartı değildir.</label>{message && <p className="form-message">{message}</p>}<button className="button primary full" disabled={pending}>{pending ? "Hesap oluşturuluyor…" : "Hesap oluştur"}</button><p className="form-alt">Zaten hesabın var mı? <Link prefetch={false} href="/giris">Giriş yap</Link></p></form>;
}

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [resetLink, setResetLink] = useState("");
  return <form className="auth-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { try { const result = await forgotPasswordAction(String(data.get("email"))); setMessage(result.message); setResetLink(result.redirectTo ?? ""); } catch { setMessage("Talep tamamlanamadı"); } }); }}><label>E-posta<input name="email" type="email" autoComplete="email" required/></label>{message && <p className="form-message">{message}</p>}{resetLink && <a className="button outline full" href={resetLink}>Demo sıfırlama bağlantısını aç</a>}<button className="button primary full" disabled={pending}>Sıfırlama talebi gönder</button></form>;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return <form className="auth-form" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); startTransition(async () => { try { const result = await resetPasswordAction({ token, password: String(data.get("password")) }); setMessage(result.message); if (result.ok && result.redirectTo) window.location.assign(result.redirectTo); } catch { setMessage("Parola güncellenemedi"); } }); }}><label>Yeni parola<input name="password" type="password" autoComplete="new-password" minLength={10} required/></label>{message && <p className="form-message">{message}</p>}<button className="button primary full" disabled={pending || !token}>Parolayı güncelle</button></form>;
}

export function LogoutButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return <div><button className="button outline" disabled={pending} onClick={() => start(async () => { try { const result = await logoutAction(); setMessage(result.message); if (result.ok && result.redirectTo) window.location.assign(result.redirectTo); } catch { setMessage("Çıkış tamamlanamadı"); } })}>{pending ? "Çıkış yapılıyor…" : "Çıkış yap"}</button>{message && <p className="form-message">{message}</p>}</div>;
}
