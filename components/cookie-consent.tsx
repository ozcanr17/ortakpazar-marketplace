"use client";

import { useEffect, useState } from "react";
import { updateConsentAction } from "@/app/actions/marketplace";

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  useEffect(() => { const show = () => { const saved = localStorage.getItem("ortakpazar-consent"); if (saved) { try { const consent = JSON.parse(saved) as { analytics?: boolean; marketing?: boolean }; setAnalytics(consent.analytics === true); setMarketing(consent.marketing === true); } catch { setAnalytics(false); setMarketing(false); } } setDetails(Boolean(saved)); setOpen(true); }; const timer = window.setTimeout(() => { if (localStorage.getItem("ortakpazar-consent") === null) show(); }, 0); window.addEventListener("ortakpazar-cookie-settings", show); return () => { window.clearTimeout(timer); window.removeEventListener("ortakpazar-cookie-settings", show); }; }, []);
  if (!open) return null;
  const save = async (nextAnalytics: boolean, nextMarketing: boolean) => {
    const anonymousId = localStorage.getItem("ortakpazar-anonymous") ?? crypto.randomUUID();
    localStorage.setItem("ortakpazar-anonymous", anonymousId);
    localStorage.setItem("ortakpazar-consent", JSON.stringify({ necessary: true, analytics: nextAnalytics, marketing: nextMarketing }));
    setOpen(false);
    await updateConsentAction({ analytics: nextAnalytics, marketing: nextMarketing, anonymousId }).catch(() => undefined);
  };
  return <div className="cookie-banner" role="dialog" aria-label="Çerez tercihleri"><div><b>Gizliliğiniz sizin kontrolünüzde</b><p>Zorunlu çerezler platformun çalışması için kullanılır. Analitik ve pazarlama çerezleri siz izin vermeden çalışmaz.</p>{details && <div className="cookie-options"><label><input type="checkbox" checked disabled/> Zorunlu <small>Her zaman açık</small></label><label><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)}/> Analitik <small>Varsayılan kapalı</small></label><label><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)}/> Pazarlama <small>Varsayılan kapalı</small></label></div>}</div><div className="cookie-actions"><button onClick={() => save(false, false)}>Reddet</button><button onClick={() => setDetails(!details)}>Tercihler</button><button className="solid" onClick={() => save(details ? analytics : true, details ? marketing : true)}>Kabul et</button></div></div>;
}
