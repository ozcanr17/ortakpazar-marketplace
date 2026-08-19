"use client";

import { useEffect, useState } from "react";
import { updateConsentAction } from "@/app/actions/marketplace";

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setOpen(localStorage.getItem("ortakpazar-consent") === null), 0); return () => window.clearTimeout(timer); }, []);
  if (!open) return null;
  const save = async (nextAnalytics: boolean, nextMarketing: boolean) => {
    const anonymousId = localStorage.getItem("ortakpazar-anonymous") ?? crypto.randomUUID();
    const result = await updateConsentAction({ analytics: nextAnalytics, marketing: nextMarketing, anonymousId });
    if (result.ok) { localStorage.setItem("ortakpazar-anonymous", result.id ?? anonymousId); localStorage.setItem("ortakpazar-consent", JSON.stringify({ necessary: true, analytics: nextAnalytics, marketing: nextMarketing })); setOpen(false); }
  };
  return <div className="cookie-banner" role="dialog" aria-label="Çerez tercihleri"><div><b>Gizliliğiniz sizin kontrolünüzde</b><p>Zorunlu çerezler platformun çalışması için kullanılır. Analitik ve pazarlama çerezleri siz izin vermeden çalışmaz.</p>{details && <div className="cookie-options"><label><input type="checkbox" checked disabled/> Zorunlu <small>Her zaman açık</small></label><label><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)}/> Analitik <small>Varsayılan kapalı</small></label><label><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)}/> Pazarlama <small>Varsayılan kapalı</small></label></div>}</div><div className="cookie-actions"><button onClick={() => save(false, false)}>Reddet</button><button onClick={() => setDetails(!details)}>Tercihler</button><button className="solid" onClick={() => save(details ? analytics : true, details ? marketing : true)}>Kabul et</button></div></div>;
}
