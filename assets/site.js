/* santehnikiskengarags.lv - phone menu (owner rule 12), jump to the form, floating button, paused hero light, lead route.
   No dependencies. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;

  /* header height for anchors and the sticky drawing */
  const head = $(".site-head");
  if (head && "ResizeObserver" in window) new ResizeObserver(() => root.style.setProperty("--head-h", `${head.offsetHeight}px`)).observe(head);

  /* phone menu: dims and blurs the page, stops it scrolling behind */
  const toggle = $(".burger"), nav = $("#nav"), backdrop = $(".nav-backdrop");
  if (toggle && nav) {
    const label = toggle.getAttribute("aria-label");
    const setOpen = (open) => {
      root.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", label);
    };
    toggle.addEventListener("click", () => setOpen(!root.classList.contains("nav-open")));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    if (backdrop) backdrop.addEventListener("click", () => setOpen(false));
    addEventListener("keydown", (e) => { if (e.key === "Escape" && root.classList.contains("nav-open")) { setOpen(false); toggle.focus(); } });
    matchMedia("(min-width: 1181px)").addEventListener("change", (m) => { if (m.matches) setOpen(false); });
  }

  /* the floating phone button steps aside while a lead form is on screen or being filled in */
  const sticky = $(".mcta"), forms = $$("[data-form-zone], .hero .band--act");   // also while the hero button is on screen
  
  if (sticky && forms.length) {
    const seen = new Set();
    let focused = false;
    const update = () => sticky.classList.toggle("is-away", focused || seen.size > 0);
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => (en.isIntersecting ? seen.add(en.target) : seen.delete(en.target)));
        update();
      });
      forms.forEach((f) => io.observe(f));
    }
    forms.forEach((f) => {
      f.addEventListener("focusin", () => { focused = true; update(); });
      f.addEventListener("focusout", () => { setTimeout(() => { focused = forms.some((x) => x.contains(document.activeElement)); update(); }, 0); });
    });
  }

  /* the window light stops drifting when the hero is off screen */
  const light = $(".light");
  if (light && "IntersectionObserver" in window) new IntersectionObserver((e) => light.classList.toggle("is-still", !e[0].isIntersecting)).observe(light);

  /* jump to the form and focus its first field */
  $$("[data-to-form]").forEach((a) => a.addEventListener("click", (e) => {
    const zone = $("#forma");
    if (!zone) return;
    e.preventDefault();
    zone.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    const first = $$("input:not([type=hidden]), select, textarea", zone).find((el) => el.tabIndex !== -1 && el.offsetParent !== null);
    setTimeout(() => first && first.focus({ preventScroll: true }), 450);
  }));
})();

/* Lead route (owner rule 6; kit submit sequence). The inline form script builds the owner's ORIGINAL data object and calls
   window.leadSend(data, proxy, webhook): the site's own Pages Function first (/api/forma/pieteikums saves the lead in KV and
   forwards it to Activepieces with retries), twice, 1.5 s apart; then the original webhook directly as the last resort; after
   a direct success a fire-and-forget {action:"direct_ok"} tells the proxy. Resolves true when one leg answered ok. */
window.leadSend = async (data, proxy, webhook) => {
  const post = (url, body, ms) => {
    const c = new AbortController(), timer = setTimeout(() => c.abort(), ms);
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: c.signal })
      .catch(() => ({ ok: false }))                                             // network error counts as a failed attempt
      .finally(() => clearTimeout(timer));
  };
  const id = (window.crypto && typeof crypto.randomUUID === "function") ? crypto.randomUUID()
    : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
  const pause = () => new Promise((r) => setTimeout(r, 1500));
  let res = { ok: false };
  if (proxy) {
    res = await post(proxy, { ...data, client_id: id, attempt: "proxy-1" }, 35000);
    if (!res.ok) { await pause(); res = await post(proxy, { ...data, client_id: id, attempt: "proxy-2" }, 35000); }
  }
  if (!res.ok && webhook) {
    if (proxy) await pause();
    res = await post(webhook, { ...data, via: "direct-fallback", record_id: id }, 20000);
    if (res.ok && proxy) post(proxy, { action: "direct_ok", id }, 8000);
  }
  return !!res.ok;
};
