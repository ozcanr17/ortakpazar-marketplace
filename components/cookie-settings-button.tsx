"use client";

export function CookieSettingsButton() {
  return <button className="footer-cookie-button" onClick={() => window.dispatchEvent(new Event("ortakpazar-cookie-settings"))}>Çerez tercihlerini yönet</button>;
}
