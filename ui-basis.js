/* OSA – Oberfläche Teil 1: Helfer, Zustand, Abgleich, Sicherungen, Dialoge, Eintrags-Dialog */
"use strict";
/* ============================================================
   Oberfläche, Teil 1: Helfer, Zustand, Dialoge, Eintrags-Dialog
   ============================================================ */
function add(e, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    e.append(typeof k === "string" ? t(k) : k instanceof Node ? k : String(k));
  }
}
function h(tag, a, ...kids) {
  const e = document.createElement(tag);
  if (a) for (const [k, v] of Object.entries(a)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "rtitle") e.setAttribute("title", v);
    else if (k === "value") e.value = v;
    else if (k === "checked") e.checked = !!v;
    else if (k === "disabled") e.disabled = !!v;
    else e.setAttribute(k, (k === "title" || k === "placeholder" || k === "aria-label") && typeof v === "string" ? t(v) : v);
  }
  add(e, kids);
  return e;
}
const R = s => document.createTextNode(String(s));          // Nutzerdaten: nie übersetzen
const T = s => document.createTextNode(t(s));        // berechneter deutscher Text, wird übersetzt
const $ = s => document.querySelector(s);

/* ---------- Zustand ---------- */
let daten, einst;
let verlauf = [];
const ui = { tab: "heute", statMo: null, statMonat: null, statModus: "woche", geld: "uebersicht", essen: "einkauf", kalTag: null, wetter: { tage: {}, status: "aus", name: "" }, faMontag: null, gespeichert: null, ansicht: "woche", tag: heute(), einkauf: "liste", budgetMonat: heute(), spPlan: heute(), suche: "", sucheArt: "Alle", ferien: {}, ferienStatus: "" };
const GEMELDET_KEY = "alltagsplaner.gemeldet.v1";
const gemeldet = new Set((() => { try { const a = JSON.parse(localStorage.getItem(GEMELDET_KEY) || "[]"); return Array.isArray(a) ? a.slice(-400) : []; } catch (e) { return []; } })());
{ const add = gemeldet.add.bind(gemeldet); gemeldet.add = k => { const r = add(k); try { localStorage.setItem(GEMELDET_KEY, JSON.stringify([...gemeldet].slice(-400))); } catch (e) { } return r; }; }   // bereits gemeldete Erinnerungen überstehen ein Neuladen
const UI_KEY = "alltagsplaner.ui.v1";
try { Object.assign(ui, { tab: "heute" }, JSON.parse(localStorage.getItem(UI_KEY) || "{}").ui || {}); } catch (e) { }
function uiSpeichern() { try { localStorage.setItem(UI_KEY, JSON.stringify({ ui: { tab: ui.tab, ansicht: ui.ansicht, einkauf: ui.einkauf, geld: ui.geld, essen: ui.essen, statModus: ui.statModus } })); } catch (e) { } }

/* Nur Objekte in den Listen zulassen - eine kaputte oder fremde Datei darf die App nicht lahmlegen */
function datenBereinigen(obj) {
  const ist = x => !!x && typeof x === "object" && !Array.isArray(x);
  if (!ist(obj)) return {};
  for (const k of ["aufgaben", "essen", "budget", "noten", "einkauf"]) obj[k] = Array.isArray(obj[k]) ? obj[k].filter(ist) : [];
  for (const k of ["rezepte", "faecher", "gericht_mahlzeit", "einstellungen", "rezept_portionen", "geloescht"]) if (!ist(obj[k])) obj[k] = {};
  for (const k of ["vorraete", "preise", "kalorien"]) if (typeof obj[k] !== "string") obj[k] = "";
  return obj;
}
/* ---------- Abgleich zwischen Geräten (Zusammenführen) ----------
   Jeder Eintrag (Aufgaben, Mahlzeiten, Buchungen, Noten, Einkauf) bekommt eine Kennung (id) und eine Änderungszeit (geaendert).
   Gelöschte Einträge hinterlassen einen Löschvermerk (geloescht), damit sie beim Zusammenführen nicht zurückkommen. */
const SYNC_LISTEN = ["aufgaben", "essen", "budget", "noten", "einkauf"];
const _syncStand = new Map();   // Kennung → { j: Inhalt als JSON, g: Änderungszeit } beim letzten Speichern
const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function stabil(x) { if (Array.isArray(x)) return "[" + x.map(stabil).join(",") + "]"; if (x && typeof x === "object") return "{" + Object.keys(x).sort().map(k => JSON.stringify(k) + ":" + stabil(x[k])).join(",") + "}"; return JSON.stringify(x); }
const syncInhalt = (e, mitId) => { const c = Object.assign({}, e); delete c.geaendert; if (!mitId) delete c.id; return stabil(c); };
function syncVorbereiten(d) {   // Kennungen vergeben; Einträge ohne Zeitangabe gelten als alt (0)
  d.geloescht = d.geloescht && typeof d.geloescht === "object" && !Array.isArray(d.geloescht) ? d.geloescht : {};
  for (const l of SYNC_LISTEN) for (const e of d[l] || []) { if (!e.id) e.id = neueId(); if (typeof e.geaendert !== "number") e.geaendert = 0; }
  return d;
}
function syncInit(d) { syncVorbereiten(d); _syncStand.clear(); for (const l of SYNC_LISTEN) for (const e of d[l]) _syncStand.set(e.id, { j: JSON.stringify(e), g: e.geaendert }); }
function syncPflegen(d, jetzt = Date.now()) {   // bei jedem Speichern: geänderte Einträge bekommen die aktuelle Zeit, gelöschte einen Löschvermerk
  d.geloescht = d.geloescht && typeof d.geloescht === "object" && !Array.isArray(d.geloescht) ? d.geloescht : {};
  const da = new Set();
  for (const l of SYNC_LISTEN) for (const e of d[l] || []) {
    if (!e.id) e.id = neueId();
    da.add(e.id);
    const st = _syncStand.get(e.id);
    if (!st) { if (!e.geaendert) e.geaendert = jetzt; }
    else if (st.g !== e.geaendert) { /* Änderungszeit von außen gesetzt (Zusammenführen): übernehmen */ }
    else if (st.j !== JSON.stringify(e)) e.geaendert = jetzt;   // Inhalt hat sich geändert
    if (d.geloescht[e.id]) { delete d.geloescht[e.id]; e.geaendert = jetzt; }   // zurückgeholt (z. B. per „Rückgängig“)
    _syncStand.set(e.id, { j: JSON.stringify(e), g: e.geaendert });
  }
  for (const id of [..._syncStand.keys()]) if (!da.has(id)) { d.geloescht[id] = jetzt; _syncStand.delete(id); }
  for (const [id, z] of Object.entries(d.geloescht)) if (jetzt - z > 120 * 864e5) delete d.geloescht[id];
}
function zeilenVereinen(a, b, nachName) {   // Textlisten (Vorräte, Preise, Kalorien): fehlende Zeilen ergänzen, eigene Zeilen behalten
  const zeilen = String(a || "").split(/\r?\n/).map(z => z.trim()).filter(Boolean), schl = z => (nachName ? String(z.split(/[:=]/)[0]) : z).trim().toLowerCase(), da = new Set(zeilen.map(schl));
  let neu = 0;
  for (const z of String(b || "").split(/\r?\n/).map(z => z.trim()).filter(Boolean)) if (!da.has(schl(z))) { zeilen.push(z); da.add(schl(z)); neu++; }
  return [zeilen.join("\n"), neu];
}
/* Führt die Daten aus „fremd“ in „lokal“ zusammen (lokal wird verändert). Je Eintrag gewinnt die neuere Änderung; gelöscht bleibt gelöscht,
   außer der Eintrag wurde danach woanders noch geändert. Gleiche Einträge ohne gemeinsame Kennung (alte Sicherungen) werden nicht doppelt angelegt. */
function datenZusammenfuehren(lokal, fremd, eigeneKategorien = []) {
  const stat = { neu: 0, aktualisiert: 0, geloescht: 0, weitere: 0, kategorien: [], farben: {} };
  const kopie = o => JSON.parse(JSON.stringify(o));
  syncVorbereiten(lokal); syncVorbereiten(fremd);
  const tomb = {};
  for (const [id, z] of Object.entries(lokal.geloescht)) tomb[id] = z;
  for (const [id, z] of Object.entries(fremd.geloescht)) tomb[id] = Math.max(tomb[id] || 0, z);
  for (const l of SYNC_LISTEN) {
    const eigene = lokal[l] = lokal[l] || [], nach = new Map(eigene.map(e => [e.id, e])), fps = new Map(), fremdIds = new Set((fremd[l] || []).map(e => e.id));
    for (const e of eigene) { const f = syncInhalt(e, false); if (!fps.has(f)) fps.set(f, []); fps.get(f).push(e); }
    for (const r of fremd[l] || []) {
      const x = nach.get(r.id);
      if (x) { if ((r.geaendert || 0) > (x.geaendert || 0)) { const c = kopie(r); for (const k of Object.keys(x)) delete x[k]; Object.assign(x, c); stat.aktualisiert++; } continue; }
      const gleich = (fps.get(syncInhalt(r, false)) || []).find(e => !fremdIds.has(e.id));
      if (gleich) { nach.delete(gleich.id); gleich.id = r.id; gleich.geaendert = Math.max(gleich.geaendert || 0, r.geaendert || 0); nach.set(gleich.id, gleich); continue; }
      if (tomb[r.id] && tomb[r.id] >= (r.geaendert || 0)) continue;   // hier schon gelöscht
      const c = kopie(r); eigene.push(c); nach.set(c.id, c); stat.neu++;
    }
    for (let i = eigene.length - 1; i >= 0; i--) { const e = eigene[i]; if (tomb[e.id] && tomb[e.id] > (e.geaendert || 0)) { eigene.splice(i, 1); stat.geloescht++; } }
  }
  const lebend = new Set(); for (const l of SYNC_LISTEN) for (const e of lokal[l]) lebend.add(e.id);
  for (const id of Object.keys(tomb)) if (lebend.has(id)) delete tomb[id];
  lokal.geloescht = tomb;
  for (const k of ["rezepte", "rezept_portionen", "faecher", "gericht_mahlzeit"]) {
    const a = lokal[k] = lokal[k] && typeof lokal[k] === "object" ? lokal[k] : {};
    for (const [n, v] of Object.entries(fremd[k] || {})) if (!(n in a)) { a[n] = kopie(v); stat.weitere++; }
  }
  for (const [k, nachName] of [["vorraete", false], ["preise", true], ["kalorien", true]]) { const [text, n] = zeilenVereinen(lokal[k], fremd[k], nachName); lokal[k] = text; stat.weitere += n; }
  const fe = fremd.einstellungen || {};
  for (const k of Array.isArray(fe.kategorien) ? fe.kategorien : []) if (!eigeneKategorien.includes(k)) { stat.kategorien.push(k); if (fe.farben && fe.farben[k]) stat.farben[k] = fe.farben[k]; }
  return stat;
}
function laden() {
  let obj = {};
  try { const txt = speicher.lesen(); if (txt) obj = JSON.parse(txt); } catch (e) { obj = {}; }
  obj = datenBereinigen(obj);
  einst = einstellungenLaden(obj);
  daten = datenErgaenzen(obj, einst.kategorien);
  daten.einstellungen = einst;
  syncInit(daten);
  spracheSetzen(einst.sprache);
}
function speichern() { daten.einstellungen = einst; syncPflegen(daten); speicher.schreiben(JSON.stringify(daten)); pcSicherungPlanen(false); }

/* ---------- PC (OSA.exe): Tagessicherung als Datei über das Startprogramm (osa_app.py) ----------
   Eine Datei pro Tag in OSA-Daten\Sicherungen, die letzten 14 bleiben. Nach Änderungen wird sie nach 30 s aktualisiert. */
let _pcSicherungTimer = 0;
function pcApi() { try { return window.pywebview && window.pywebview.api && window.pywebview.api.sicherung_schreiben ? window.pywebview.api : null; } catch (e) { return null; } }
function pcSicherungPlanen(sofort) {
  const api = pcApi(); if (!api) return;
  clearTimeout(_pcSicherungTimer);
  _pcSicherungTimer = setTimeout(() => {
    if (!datenVorhanden(daten)) return;
    daten.einstellungen = einst;
    api.sicherung_schreiben(iso(heute()), JSON.stringify(daten)).then(r => {
      if (r && r.ok) { ui.pcSicherung = { zeit: new Date(), ordner: r.ordner }; sicherungHeruntergeladen(); }
    }).catch(() => { });
  }, sofort ? 500 : 30000);
}
window.addEventListener("pywebviewready", () => { pcSicherungPlanen(true); setTimeout(() => { if (ui.tab === "einstellungen" || ui.tab === "heute") render(); }, 900); });

/* ---------- Handy/Browser: Erinnerung, eine Sicherung herunterzuladen ---------- */
const ERSTE_NUTZUNG_KEY = "alltagsplaner.ersteNutzung.v1", SICHERUNG_SPAETER_KEY = "alltagsplaner.sicherungSpaeter.v1";
function sicherungsKarte() {
  try {
    if (pcApi() || !datenVorhanden(daten)) return null;   // am PC sichert die OSA.exe selbst
    if (!localStorage.getItem(ERSTE_NUTZUNG_KEY)) localStorage.setItem(ERSTE_NUTZUNG_KEY, iso(heute()));
    const N = typeof einst.sicherung_erinnerung === "number" ? einst.sicherung_erinnerung : 7;   // Erinnerung nach N Tagen ohne Sicherung; 0 = aus
    if (N <= 0) return null;
    const spaeter = localStorage.getItem(SICHERUNG_SPAETER_KEY); if (spaeter && diffDays(heute(), parseISO(spaeter)) < Math.min(3, N)) return null;
    const letzte = localStorage.getItem(DOWNLOAD_KEY), seitNutzung = diffDays(heute(), parseISO(localStorage.getItem(ERSTE_NUTZUNG_KEY)));
    const tage = letzte ? diffDays(heute(), parseISO(letzte)) : null;
    if (tage === null ? seitNutzung < Math.min(N, 3) : tage < N) return null;
    const text = tage === null ? t("Du hast noch keine Sicherung angelegt.") : `${t("Deine letzte Sicherung ist")} ${tage} ${t("Tage her.")}`;
    return h("div", { class: "card sicherungs-karte", style: "margin-bottom:14px" },
      h("b", null, R("💾 " + text)),
      h("p", { class: "mut small", style: "margin:6px 0 10px" }, "Deine Einträge liegen nur auf diesem Gerät. Wird die App entfernt oder löscht der Browser seine Daten, sind sie ohne Sicherung weg."),
      h("div", { class: "row" },
        h("button", { class: "btn pri", onclick: () => { sicherungHeruntergeladen(); daten.einstellungen = einst; dateiAngebot(`osa-${iso(heute())}.json`, JSON.stringify(daten, null, 1), "application/json", "Sicherung"); render(); } }, "Jetzt sichern"),
        h("button", { class: "btn", onclick: uebertragenDialog }, "Auf anderes Gerät übertragen …"),
        h("button", { class: "btn ghost", onclick: () => { try { localStorage.setItem(SICHERUNG_SPAETER_KEY, iso(heute())); } catch (e) { } render(); } }, "Später")));
  } catch (e) { return null; }
}

/* ---------- Automatische Tagessicherungen (wie der Ordner "sicherungen" im Programm) ---------- */
const SICHERUNG_KEY = "alltagsplaner.sicherungen.v1", DOWNLOAD_KEY = "alltagsplaner.letzteSicherung.v1", SICHERUNG_BEHALTEN = 3;
function sicherungenLesen() { try { const o = JSON.parse(localStorage.getItem(SICHERUNG_KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
function sicherungenSchreiben(o) {
  const tage = Object.keys(o).sort();
  while (tage.length > SICHERUNG_BEHALTEN) delete o[tage.shift()];
  for (;;) { try { localStorage.setItem(SICHERUNG_KEY, JSON.stringify(o)); return true; } catch (e) { if (tage.length <= 1) return false; delete o[tage.shift()]; } }
}
function datenVorhanden(d) { return !!(d.aufgaben.length || d.essen.length || Object.keys(d.rezepte || {}).length || Object.keys(d.faecher || {}).length || (d.noten || []).length || (d.budget || []).length || (d.einkauf || []).length); }
function sicherungTaeglich() {
  try {
    if (!datenVorhanden(daten)) return;
    const o = sicherungenLesen(), heuteIso = iso(heute());
    if (!o[heuteIso]) { daten.einstellungen = einst; const txt = JSON.stringify(daten); if (txt.length < 1200000) { o[heuteIso] = txt; sicherungenSchreiben(o); } }   // sehr große Datenbestände nicht doppelt ablegen
    /* Die Erinnerung zum Herunterladen steht jetzt als Karte auf „Heute“ (sicherungsKarte), nicht mehr als kurzer Hinweis */
  } catch (e) { }
}
function sicherungHeruntergeladen() { try { localStorage.setItem(DOWNLOAD_KEY, iso(heute())); } catch (e) { } }
function sicherungsListe() {
  const o = sicherungenLesen(), tage = Object.keys(o).sort().reverse();
  if (!tage.length) return h("p", { class: "mut small", style: "margin:0" }, "Noch keine automatische Sicherung. Die erste entsteht beim nächsten Start, sobald Daten vorhanden sind.");
  return h("div", { class: "list" }, tage.map(tag => {
    let info = ""; try { const d = JSON.parse(o[tag]); info = `${(d.aufgaben || []).length} ${t("Aufgaben/Termine")}, ${(d.essen || []).length} ${t("Mahlzeiten")}`; } catch (e) { }
    return h("div", { class: "li" }, h("div", { class: "tx" }, h("b", null, R(deDatum(tag))), h("div", { class: "mut small" }, R(info))),
      h("button", { class: "btn sm", onclick: () => dateiAngebot(`osa-${tag}.json`, o[tag], "application/json", "Sicherung") }, "Herunterladen"),
      h("button", { class: "btn sm", onclick: () => importieren(o[tag]) }, "Wiederherstellen"));
  }));
}
function aendern(fn, still = false) {
  verlauf.push(JSON.stringify(daten)); if (verlauf.length > 40) verlauf.shift();
  fn(); speichern(); if (!still) render();
}
function rueckgaengig() {
  if (!verlauf.length) return toast("Nichts zum Rückgängigmachen.");
  const obj = JSON.parse(verlauf.pop());
  einst = einstellungenLaden(obj); daten = datenErgaenzen(obj, einst.kategorien); daten.einstellungen = einst;
  spracheSetzen(einst.sprache); speichern(); render();
}
function aktivesSchema() {
  if (einst.design in THEMEN) return einst.design;
  try { return matchMedia("(prefers-color-scheme: dark)").matches ? "dunkel" : "ozean"; } catch (e) { return "ozean"; }   // helles Standard-Design: Ozean
}
function themaAnwenden() {
  const r = document.documentElement, schema = aktivesSchema(), T0 = THEMEN[schema] || THEMEN.ozean;
  if (themaAnwenden._alt && themaAnwenden._alt !== schema && einst.reiter_animation !== false && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    r.classList.add("wechsel"); clearTimeout(themaAnwenden._t); themaAnwenden._t = setTimeout(() => r.classList.remove("wechsel"), 420);
  }
  themaAnwenden._alt = schema;
  if (einst.design === "auto") { if (r.dataset.eigen) { delete r.dataset.theme; delete r.dataset.eigen; } }
  else { r.dataset.theme = T0.dunkel ? "dark" : "light"; r.dataset.eigen = "1"; }
  r.style.colorScheme = T0.dunkel ? "dark" : "light";
  const eigene = (einst.programmfarben || {})[schema] || {};
  for (const [k, v] of Object.entries(THEMA_VAR)) {
    const wert = (k in eigene && HEX_FARBE.test(eigene[k])) ? eigene[k] : T0[k];
    if (wert) r.style.setProperty(v, wert);
  }
  if (eigene.akzent && HEX_FARBE.test(eigene.akzent) && !("auswahl" in eigene)) r.style.setProperty("--acc-soft", `color-mix(in srgb, ${eigene.akzent} 18%, ${T0.karte})`);
  r.style.zoom = ({ Klein: 0.9, Normal: 1, "Groß": 1.15, "Sehr groß": 1.3 })[einst.schrift_stufe] || 1;
  let mt = document.querySelector("meta[name=theme-color]"); if (!mt) { mt = document.createElement("meta"); mt.name = "theme-color"; document.head.append(mt); } mt.content = T0.bg;
  faviconAnwenden(r.style.getPropertyValue("--acc") || T0.akzent, r.style.getPropertyValue("--acc-fg") || "#fff");
}
/* Logo (Ring mit zwei Strichen und Funke): folgt immer der Hauptfarbe; Header und Browser-Symbol nutzen dieselbe Zeichnung */
function logoSvg(acc, fg, groesse) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"${groesse ? ` width="${groesse}" height="${groesse}"` : ""} aria-hidden="true"><rect width="512" height="512" rx="114" fill="${acc}"/><circle cx="236" cy="276" r="128" fill="none" stroke="${fg}" stroke-width="44"/><g stroke="${fg}" stroke-width="30" stroke-linecap="round"><path d="M196 248h80"/><path d="M196 304h80"/></g><path d="M404 66L417 99L450 112L417 125L404 158L391 125L358 112L391 99Z" fill="${fg}"/></svg>`;
}
function faviconAnwenden(acc, fg) {
  try {
    if (!HEX_FARBE.test(acc) || !HEX_FARBE.test(fg)) return;
    let l = document.querySelector("link[rel=icon]"); if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.append(l); }
    l.type = "image/svg+xml"; l.href = "data:image/svg+xml," + encodeURIComponent(logoSvg(acc, fg));
    const api = pcApi();   // Programm (.exe): Symbol in Titelleiste und Taskleiste mitändern
    if (api && api.fenster_icon && faviconAnwenden._zuletzt !== acc + fg) {
      faviconAnwenden._zuletzt = acc + fg;
      const bild = new Image();
      bild.onload = () => { try { const c = document.createElement("canvas"); c.width = c.height = 128; c.getContext("2d").drawImage(bild, 0, 0, 128, 128); api.fenster_icon(c.toDataURL("image/png").split(",")[1]); } catch (e) { } };
      bild.src = l.href;
    }
  } catch (e) { }
}
window.addEventListener("pywebviewready", () => { try { if (einst) themaAnwenden(); } catch (e) { } });   // .exe: Fensterschnittstelle ist erst jetzt da
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (einst && einst.design === "auto") themaAnwenden(); }); } catch (e) { }
try { new MutationObserver(() => { if (einst && einst.design === "auto") themaAnwenden(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) { }

/* ---------- Toasts und Dialoge ---------- */
function toast(text, roh = false) {
  let box = $(".toasts"); if (!box) { box = h("div", { class: "toasts", role: "status" }); document.body.append(box); }
  const el = h("div", { class: "toast" }, h("span", null, roh ? R(text) : text), h("button", { "aria-label": "Schließen", onclick: () => el.remove() }, "×"));
  box.append(el); setTimeout(() => el.remove(), 7000);
}
function dialog(titel, inhalt, knoepfe = [], opt = {}) {
  const ov = h("div", { class: "ov" });
  const vorher = document.activeElement;
  const schliessen = () => { ov.remove(); document.removeEventListener("keydown", esc); try { if (vorher && vorher.isConnected && vorher.focus) vorher.focus({ preventScroll: true }); } catch (e) { } };
  const esc = e => {
    const alle = document.querySelectorAll(".ov"); if (alle[alle.length - 1] !== ov) return;   // nur der oberste Dialog reagiert
    if (e.key === "Escape") { if (e._behandelt) return; e._behandelt = true; schliessen(); return; }
    if (e.key === "Tab") {   // Fokus bleibt im Dialog
      const els = [...ov.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
      if (!els.length) return;
      const erst = els[0], letzt = els[els.length - 1], a = document.activeElement;
      if (!ov.contains(a)) { e.preventDefault(); erst.focus(); }
      else if (e.shiftKey && a === erst) { e.preventDefault(); letzt.focus(); }
      else if (!e.shiftKey && a === letzt) { e.preventDefault(); erst.focus(); }
    }
  };
  const foot = h("div", { class: "foot" });
  for (const k of knoepfe) foot.append(h("button", { class: "btn " + (k.art || ""), onclick: async () => { if (k.fn) { const r = await k.fn(); if (r === false) return; } schliessen(); } }, k.text));
  const d = h("div", { class: "dlg", role: "dialog", "aria-modal": "true", style: opt.breit ? "width:min(860px,100%)" : "" },
    titel ? h("h2", null, opt.rohTitel ? R(titel) : titel) : null, h("div", { class: "body" }, inhalt), knoepfe.length ? foot : null);
  ov.append(d);
  ov.addEventListener("mousedown", e => { if (e.target === ov) schliessen(); });
  document.addEventListener("keydown", esc);
  document.body.append(ov);
  const first = d.querySelector("input[type=text],input[type=number],textarea"); if (first && !opt.keinFokus) first.focus();
  return schliessen;
}
function bestaetigen(text, onJa, jaText = "Löschen") {
  dialog(null, h("p", { style: "margin:0" }, text), [{ text: "Abbrechen" }, { text: jaText, art: "bad", fn: onJa }]);
}
async function kopieren(text) {
  try { await navigator.clipboard.writeText(text); toast("In die Zwischenablage kopiert."); return true; } catch (e) { return false; }
}
/* ---------- Kamera-Zugriff: Hilfefenster mit Weg zu den Einstellungen ----------
   Eine Seite darf die Systemeinstellungen nicht selbst öffnen. Wo es einen erlaubten Weg gibt, führt ein Knopf direkt hin
   (Windows: Kamera-Datenschutz, in der exe über das Startprogramm; Mac: Datenschutz › Kamera); sonst steht die Anleitung für das jeweilige Gerät da. */
function kameraFehlerArt(e) {   // verweigert | keine | belegt | nichtverfuegbar | unbekannt
  const n = e && e.name;
  return n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError" ? "verweigert" : n === "NotFoundError" || n === "OverconstrainedError" || n === "DevicesNotFoundError" ? "keine"
    : n === "NotReadableError" || n === "AbortError" || n === "TrackStartError" ? "belegt" : "unbekannt";
}
function kameraUmgebung() {
  const ua = navigator.userAgent || "", pf = navigator.platform || "";
  const os = /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) || (pf === "MacIntel" && navigator.maxTouchPoints > 1) ? "ios" : /Win/i.test(pf + ua) ? "windows" : /Mac/i.test(pf) ? "mac" : "andere";
  const browser = /Edg\//.test(ua) ? "edge" : /Firefox\//.test(ua) ? "firefox" : /Chrome\/|CriOS/.test(ua) ? "chrome" : /Safari\//.test(ua) ? "safari" : "andere";
  return { os, browser, exe: !!pcApi() };
}
function systemLinkOeffnen(adresse) { const a = document.createElement("a"); a.href = adresse; document.body.append(a); a.click(); a.remove(); }
function kameraHilfeDialog(art, opt = {}) {   // opt.erneut: nochmal versuchen; opt.eintippen: ohne Kamera weitermachen
  const u = kameraUmgebung(), api = pcApi();
  const TITEL = { verweigert: "Kamera-Zugriff nicht erlaubt", keine: "Keine Kamera gefunden", belegt: "Kamera nicht nutzbar", nichtverfuegbar: "Kamera hier nicht verfügbar", unbekannt: "Kamera-Zugriff nicht möglich" };
  const TEXT = {
    verweigert: "OSA darf die Kamera nicht benutzen. Erlaube den Zugriff in den Einstellungen und tippe danach auf „Erneut versuchen“.",
    keine: "Auf diesem Gerät wurde keine Kamera gefunden (oder sie ist ausgeschaltet).",
    belegt: "Die Kamera lässt sich nicht öffnen – vermutlich nutzt sie gerade eine andere App (z. B. Zoom oder Teams). Schließe diese App und versuche es noch einmal.",
    nichtverfuegbar: "Dieser Browser erlaubt die Kamera hier nicht. Das geht nur auf sicheren Seiten (https) oder in der installierten App.",
    unbekannt: "Die Kamera konnte nicht gestartet werden. Prüfe die Einstellungen und versuche es noch einmal."
  };
  const schritte = [];
  const knoepfe = [];
  if (art === "verweigert" || art === "unbekannt") {
    if (u.os === "windows") {
      schritte.push("Windows-Einstellungen › Datenschutz & Sicherheit › Kamera öffnen.", "„Kamerazugriff“ und „Desktop-Apps den Zugriff auf Ihre Kamera erlauben“ einschalten.",
        "Einzelne Desktop-Apps wie OSA stehen in der Liste erst, nachdem sie die Kamera benutzt haben – bis dahin gilt nur dieser eine Schalter.");
      knoepfe.push(h("button", { class: "btn pri", "data-aktion": "kamera-windows", onclick: () => { if (api && api.kamera_einstellungen_oeffnen) api.kamera_einstellungen_oeffnen(); else systemLinkOeffnen("ms-settings:privacy-webcam"); } }, "Windows-Kamera-Einstellungen öffnen"));
    } else if (u.os === "mac") {
      schritte.push("Systemeinstellungen › Datenschutz & Sicherheit › Kamera öffnen.", "Den Schalter für diesen Browser einschalten.");
      knoepfe.push(h("button", { class: "btn pri", "data-aktion": "kamera-mac", onclick: () => systemLinkOeffnen("x-apple.systempreferences:com.apple.preference.security?Privacy_Camera") }, "Mac-Kamera-Einstellungen öffnen"));
    } else if (u.os === "android") {
      schritte.push("Tippe in der Adresszeile auf das Symbol links neben der Adresse (Schloss oder Regler).", "Wähle „Berechtigungen“ › „Kamera“ › „Zulassen“.", "Bei der installierten App: Android-Einstellungen › Apps › diese App › Berechtigungen › Kamera.");
    } else if (u.os === "ios") {
      schritte.push("In Safari das „aA“-Symbol links in der Adresszeile antippen › „Website-Einstellungen“ › „Kamera“ › „Erlauben“.", "Oder: iPhone-Einstellungen › Safari › Kamera › „Fragen“ oder „Erlauben“.");
    } else schritte.push("Klicke links neben der Adresse auf das Schloss- oder Regler-Symbol › „Kamera“ › „Zulassen“.");
    if (!u.exe && (u.os === "windows" || u.os === "mac" || u.os === "andere")) {
      const adr = { edge: "edge://settings/content/camera", chrome: "chrome://settings/content/camera", firefox: "about:preferences#privacy" }[u.browser];
      if (adr) { schritte.push(`${t("Browser-Einstellung für Kameras")}: ${adr} (${t("in die Adresszeile einfügen")})`); knoepfe.push(h("button", { class: "btn", "data-aktion": "kamera-adresse", onclick: () => kopieren(adr) }, "Adresse der Browser-Einstellung kopieren")); }
    }
  }
  let zu = () => { };
  const spaeter = fn => () => { setTimeout(fn, 0); };
  zu = dialog(TITEL[art] || TITEL.unbekannt, [
    h("p", { style: "margin:0" }, TEXT[art] || TEXT.unbekannt),
    schritte.length ? h("ol", { class: "neu-liste", "data-kamera-schritte": "1" }, schritte.map(s => h("li", null, s))) : null,
    knoepfe.length ? h("div", { class: "row", style: "gap:8px;flex-wrap:wrap" }, knoepfe) : null],
    [{ text: "Schließen" }, ...(opt.eintippen ? [{ text: "Nummer eintippen", fn: spaeter(opt.eintippen) }] : []), ...(opt.erneut ? [{ text: "Erneut versuchen", art: "pri", fn: spaeter(opt.erneut) }] : [])]);
  return zu;
}
function teilenMoeglich(name, text, mime) {
  try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [new File([text], name, { type: mime })] })); } catch (e) { return false; }
}
function dateiAngebot(name, text, mime, titel = "Datei speichern") {
  const ta = h("textarea", { readonly: "readonly", style: "min-height:150px;font:12px ui-monospace,monospace" });
  ta.value = text;
  let direkt = true;
  const lade = () => {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: mime }));
      const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { direkt = false; }
  };
  dialog(titel, [
    h("p", { class: "mut small", style: "margin:0" }, R(name), " ", "– falls der Download in dieser Ansicht gesperrt ist, kopiere den Text und speichere ihn in einer Datei."),
    ta
  ], [
    { text: "Schließen" },
    { text: "Kopieren", fn: async () => { if (!(await kopieren(text))) { ta.select(); toast("Text markiert – bitte mit Strg+C kopieren."); } return false; } },
    ...(teilenMoeglich(name, text, mime) ? [{ text: "Teilen", fn: async () => { try { await navigator.share({ files: [new File([text], name, { type: mime })], title: name }); } catch (e) { /* abgebrochen */ } return false; } }] : []),
    { text: "Herunterladen", art: "pri", fn: () => { lade(); return false; } }
  ]);
}

/* ---------- Formular-Bausteine ---------- */
function feld(label, el) { return h("label", { class: "f" }, label, el); }
function auswahl(optionen, wert, roh = false) {
  const s = h("select");
  for (const o of optionen) { const [v, l] = Array.isArray(o) ? o : [o, o]; s.append(h("option", { value: v }, roh ? R(l) : l)); }
  s.value = wert; if (s.value !== String(wert) && s.options.length) s.selectedIndex = 0;
  return s;
}
function farbwahl(start, onwahl) {
  let cur = start || "";
  const box = h("div", { class: "sw" });
  const zeichnen = () => {
    box.replaceChildren();
    for (const [n, c] of Object.entries(FARBPALETTE)) {
      const b = h("button", { type: "button", title: n, class: c === cur ? "on" : "", style: `background:${c || "var(--surf2)"}`, onclick: () => { cur = c; onwahl(c); zeichnen(); } });
      box.append(b);
    }
  };
  zeichnen(); return box;
}
const farbeVon = (v, art) => v.farbe || (art === "essen" ? einst.farben.Essen : einst.farben[v.kategorie]) || "#e2e4e8";
/* Farbe pro Fach: gemerkt in daten.faecher[fach].farbe; sonst die Farbe des neuesten Eintrags mit diesem Fach */
function fachFarbe(fach) {
  fach = String(fach || "").trim(); if (!fach) return "";
  const f = daten.faecher[fach]; if (f && f.farbe) return f.farbe;
  for (let i = daten.aufgaben.length - 1; i >= 0; i--) { const a = daten.aufgaben[i]; if (a.fach === fach && a.farbe) return a.farbe; }
  return "";
}
function fachFarbeMerken(fach, farbe) {   // nur innerhalb von aendern() aufrufen
  fach = String(fach || "").trim(); if (!fach || !farbe) return;
  daten.faecher[fach] = Object.assign({ ziel: 0 }, daten.faecher[fach] || {}, { farbe });
}

/* ---------- Eintrag-Dialog (Aufgabe / Termin / Essen) ---------- */
function eintragDialog(o = {}) {
  const neu = !o.v;
  let art = o.v ? (o.art || "aufgabe") : (o.art || "aufgabe");
  const v = o.v || {};
  const q = o.quelle || {};
  const terminVorgabe = o.vorgabe || {};
  const w = {};   // Eingabefelder
  const kopf = h("div");
  const body = h("div", { class: "body" });
  const kategorien = einst.kategorien.slice(); for (const k of [v.kategorie, terminVorgabe.kategorie]) if (k && !kategorien.includes(k)) kategorien.push(k);
  let farbe = v.farbe || "", farbeSelbst = !!v.farbe;   // farbeSelbst: Nutzer hat selbst eine Farbe gewählt → nicht automatisch ändern
  if (!o.v && !farbe) farbe = fachFarbe(terminVorgabe.fach || "");
  const wiederholt = (q.wiederholung || v.wiederholung || "keine") !== "keine";
  const dtag = o.tag ? iso(o.tag) : (terminVorgabe.datum || iso(ui.tag));

  const bauen = () => {
    body.replaceChildren();
    /* Lehrveranstaltung (aus dem Stundenplan): immer ein Termin, daher keine Art-Auswahl */
    if (!o.lv) {
      const typ = auswahl([["aufgabe", "Aufgabe"], ["termin", "Termin"], ["essen", "Essen"]].filter(([k]) => k !== "essen" || einst.essen_an !== false || art === "essen"), art);   // „Essen“ nur, wenn Mahlzeiten eingeschaltet sind
      typ.disabled = !neu;
      typ.onchange = () => { art = typ.value; bauen(); };
      body.append(feld("Art", typ));
    }
    if (art === "essen") {
      const dl = h("datalist", { id: "gerichte" }); for (const g of gerichtVorschlaege(daten)) dl.append(h("option", { value: g }));
      w.name = h("input", { type: "text", list: "gerichte", value: v.gericht || terminVorgabe.gericht || "", placeholder: "z. B. Nudeln mit Tomatensauce" });
      w.mahlzeit = auswahl(MAHLZEITEN.map(m => [m, m]), v.mahlzeit || terminVorgabe.mahlzeit || "Mittagessen");
      body.append(dl, feld("Gericht", w.name), feld("Mahlzeit", w.mahlzeit));
      w.mahlzeit.onchange = () => { const g = daten.gericht_mahlzeit[w.name.value.trim().toLowerCase()]; };
      if (einst.kalorien_an !== false) {
        w.kcal = h("input", { type: "number", min: 0, step: 10, value: v.kcal > 0 ? v.kcal : "", placeholder: "z. B. 650" });
        const vorschlag = () => { const r = rezeptKalorien(daten, w.name.value); w.kcal.placeholder = r.zutaten && r.summe > 0 ? `≈ ${Math.round(r.proPortion)} (${t("laut Rezept")})` : "z. B. 650"; };
        w.name.addEventListener("input", vorschlag); vorschlag();
        body.append(feld("Kalorien (optional)", w.kcal));
      }
    } else {
      w.name = h("input", { type: "text", value: v.name || terminVorgabe.name || "", placeholder: o.lv ? "z. B. Analysis I" : art === "termin" ? "z. B. Vorlesung Statistik" : "z. B. Übungsblatt 3 abgeben" });
      body.append(feld("Titel", w.name));
    }
    w.datum = h("input", { type: "date", value: (!neu && !v._start && !v.datum) ? "" : (v._start || v.datum || dtag) });   // Aufgabe ohne Datum bleibt ohne Datum
    w.enddatum = h("input", { type: "date", value: v.enddatum || "" });
    w.uhr = h("input", { type: "time", value: v.uhrzeit || terminVorgabe.uhrzeit || "" });
    body.append(h("div", { class: "grid2" }, feld(art === "aufgabe" ? "Datum (leer lassen = ohne Datum)" : "Datum", w.datum), feld(art === "aufgabe" ? "Frist bis (optional)" : "Enddatum (optional)", w.enddatum), feld("Uhrzeit", w.uhr)));
    if (art !== "essen") {
      w.dauer = h("input", { type: "number", min: 5, step: 5, value: v.dauer ?? terminVorgabe.dauer ?? (o.lv ? einst.stundenplan_dauer : art === "termin" ? einst.termin_dauer : 30) });
      w.prio = auswahl([[1, "hoch"], [2, "mittel"], [3, "niedrig"]], v.prio ?? terminVorgabe.prio ?? 2);
      w.kat = auswahl(kategorien.map(k => [k, k]), v.kategorie || terminVorgabe.kategorie || kategorien[0], true);
      const faecher = [["", "–"]].concat(Object.keys(daten.faecher).map(f => [f, f]));
      if (v.fach && !(v.fach in daten.faecher)) faecher.push([v.fach, v.fach]);
      if (o.lv) {   // freies Feld mit Vorschlägen; leer = Titel wird als Fach genommen
        const fl = h("datalist", { id: "lv-faecher" }); for (const f of Object.keys(daten.faecher)) fl.append(h("option", { value: f }));
        w.fach = h("input", { type: "text", list: "lv-faecher", value: v.fach || terminVorgabe.fach || "", placeholder: "leer = wie Titel" });
        body.append(fl);
      } else w.fach = auswahl(faecher, v.fach || terminVorgabe.fach || "", true);
      w.raum = h("input", { type: "text", value: v.raum || terminVorgabe.raum || "" });
      w.dozent = h("input", { type: "text", value: v.dozent || terminVorgabe.dozent || "" });
      body.append(h("div", { class: "grid2" }, feld("Dauer (Minuten)", w.dauer), art === "aufgabe" ? feld("Priorität", w.prio) : null, feld("Kategorie", w.kat), feld("Fach", w.fach)),
        h("div", { class: "grid2" }, feld("Raum", w.raum), feld("Dozent", w.dozent)));
      if (art === "aufgabe") { w.vorlauf = h("input", { type: "number", min: 0, value: v.vorlauf || 0 }); body.append(feld("Vorlauf-Erinnerung (Tage vor der Frist, 0 = aus)", w.vorlauf)); }
    }
    const wd = auswahl(WIEDERHOLUNGEN.map(x => [x, x]), v.wiederholung || terminVorgabe.wiederholung || "keine");
    w.wdh = wd; w.bis = h("input", { type: "date", value: v.wiederholen_bis || "" });
    const bisFeld = feld(o.lv ? "Semesterende (optional)" : "Wiederholen bis (optional)", w.bis);
    const sichtbar = () => { bisFeld.hidden = wd.value === "keine"; };
    wd.onchange = sichtbar; sichtbar();
    if (wiederholt && !neu) { /* Wiederholung bleibt änderbar, gilt dann für alle */ }
    body.append(h("div", { class: "grid2" }, feld("Wiederholung", wd), bisFeld));
    /* Neue Einträge: sobald ein Fach feststeht, dessen Farbe vorauswählen (solange keine eigene gewählt wurde) */
    const farbFeld = h("div"), farbeZeichnen = () => farbFeld.replaceChildren(farbwahl(farbe, c => { farbe = c; farbeSelbst = true; }));
    farbeZeichnen(); body.append(feld("Farbe", farbFeld));
    if (neu && art !== "essen" && w.fach) {
      const fachJetzt = () => (w.fach.value || "").trim() || (o.lv ? w.name.value.trim() : "");
      const nachziehen = () => { if (farbeSelbst) return; const f = fachFarbe(fachJetzt()); if (f !== farbe) { farbe = f; farbeZeichnen(); } };
      w.fach.addEventListener("input", nachziehen); w.fach.addEventListener("change", nachziehen);
      if (o.lv) w.name.addEventListener("input", nachziehen);   // bei Lehrveranstaltungen ist ein leeres Fach = Titel
    }
    w.notiz = h("textarea", { placeholder: "Notiz …" }); w.notiz.value = v.notiz || terminVorgabe.notiz || "";
    body.append(feld("Notiz", w.notiz));
    if (art !== "essen") {
      w.check = h("textarea", { placeholder: "[ ] Teilschritt 1\n[x] Teilschritt 2", style: "min-height:60px" }); w.check.value = checklisteText(v.checkliste || terminVorgabe.checkliste);
      body.append(feld("Teilschritte (Checkliste, eine Zeile pro Schritt)", w.check));
    }
    w.warn = h("div"); body.append(w.warn);
  };

  const lesen = () => {
    const f = { datum: w.datum.value, enddatum: w.enddatum.value, uhrzeit: w.uhr.value, notiz: w.notiz.value.trim(), farbe };
    if (!f.datum) {
      if (art !== "aufgabe") { toast("Bitte ein Datum angeben."); return null; }
      if (f.enddatum) { toast("Für eine Frist braucht die Aufgabe ein Datum."); return null; }
      f.uhrzeit = "";
    }
    if (f.enddatum && f.enddatum < f.datum) { toast("Das Enddatum liegt vor dem Startdatum."); return null; }
    if (art === "essen") {
      f.gericht = w.name.value.trim(); f.mahlzeit = w.mahlzeit.value;
      f.kcal = w.kcal ? Math.max(0, Math.round(parseFloat(String(w.kcal.value).replace(",", ".")) || 0)) : (v.kcal || 0);
      if (!f.gericht) { toast("Bitte ein Gericht eintragen."); return null; }
    } else {
      f.name = w.name.value.trim(); if (!f.name) { toast("Bitte einen Titel eintragen."); return null; }
      f.dauer = Math.max(parseInt(w.dauer.value, 10) || 30, 5); f.kategorie = w.kat.value; f.fach = w.fach.value.trim();
      if (o.lv && !f.fach) f.fach = f.name;   // ohne Fach erscheint sie nicht im Stundenplan
      if (neu && !farbeSelbst && !f.farbe && f.fach) f.farbe = fachFarbe(f.fach);   // gleiche Farbe wie die anderen Einträge des Fachs
      f.raum = w.raum.value.trim(); f.dozent = w.dozent.value.trim();
      f.prio = parseInt(w.prio?.value || v.prio || 2, 10); f.vorlauf = Math.max(parseInt(w.vorlauf?.value || 0, 10) || 0, 0);
      f.checkliste = checklisteParsen(w.check.value);
    }
    f.wiederholung = w.wdh.value; f.wiederholen_bis = f.wiederholung === "keine" ? "" : w.bis.value;
    if (!f.datum && f.wiederholung !== "keine") { toast("Ohne Datum geht keine Wiederholung."); return null; }
    return f;
  };

  const speichernFn = async (ignoriereKonflikt = false) => {
    const f = lesen(); if (!f) return false;
    if (art === "termin" && !ignoriereKonflikt) {
      const kand = Object.assign({ typ: "termin" }, f);
      const k = konflikteFinden(daten, kand, o.quelle || null);
      if (k.length) {
        w.warn.replaceChildren(h("div", { class: "warnbox" }, t("Überschneidung mit:") + "\n" + konfliktText(k)),
          h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn sm", type: "button", onclick: () => { schliessen(); speichernFn(true); } }, "Trotzdem speichern")));
        return false;
      }
    }
    const fertig = () => {
      if (neu) {
        const e = Object.assign({ erledigt: false, erledigt_tage: [], ausnahmen: {} }, f);
        if (art === "essen") daten.essen.push(e); else { e.typ = art; daten.aufgaben.push(e); }
        if (o.lv && e.fach && !(e.fach in daten.faecher)) daten.faecher[e.fach] = { ziel: 0 };   // neues Fach gleich mit anlegen
        if (art !== "essen") fachFarbeMerken(e.fach, e.farbe);   // nächste Veranstaltung mit diesem Fach bekommt dieselbe Farbe
        if (art === "essen") daten.gericht_mahlzeit[f.gericht.toLowerCase()] = f.mahlzeit;
        return;
      }
      const ziel = o.quelle;
      const wiederholteVorlage = (ziel.wiederholung || "keine") !== "keine";
      const anwenden = scope => {
        if (art !== "essen" && farbeSelbst) fachFarbeMerken(f.fach, f.farbe);   // geänderte Farbe gilt ab jetzt fürs ganze Fach
        if (!f.datum || !ziel.datum) { Object.assign(ziel, f); if (!f.enddatum) ziel.enddatum = ""; return; }   // Aufgabe ohne Datum: nichts zu verschieben
        if (!wiederholteVorlage || scope === "alle") {
          const verschiebung = diffDays(parseISO(f.datum), parseISO(v._start || ziel.datum));
          const dauerT = dauerInTagen(ziel);
          const neuStart = addDays(parseISO(ziel.datum), (wiederholteVorlage ? verschiebung : diffDays(parseISO(f.datum), parseISO(ziel.datum))));
          Object.assign(ziel, f);
          ziel.datum = iso(neuStart);
          if (!f.enddatum && !wiederholteVorlage) ziel.enddatum = "";
          if (f.enddatum && wiederholteVorlage) ziel.enddatum = iso(addDays(neuStart, Math.max(diffDays(parseISO(f.enddatum), parseISO(f.datum)), 0)));
          if (wiederholteVorlage && !f.enddatum) ziel.enddatum = "";
        } else {
          ziel.ausnahmen = ziel.ausnahmen || {};
          const a = ziel.ausnahmen[v._anfang] || (ziel.ausnahmen[v._anfang] = {});
          for (const k of EINZEL_FELDER[art === "essen" ? "essen" : "aufgabe"]) if (k in f) a[k] = f[k];
          if (f.checkliste) a.checkliste = f.checkliste;
          delete a.geloescht;
          if (f.datum !== (v._start || ziel.datum)) a.datum = f.datum; else delete a.datum;
        }
      };
      return anwenden;
    };
    if (neu) { aendern(() => fertig()); return true; }
    const anwenden = fertig();
    if ((o.quelle.wiederholung || "keine") === "keine") { aendern(() => anwenden("alle")); return true; }
    dialog("Wiederkehrender Eintrag", h("p", { style: "margin:0" }, "Soll die Änderung nur für diesen Termin oder für alle Wiederholungen gelten?"), [
      { text: "Abbrechen" }, { text: "Nur dieser", fn: () => aendern(() => anwenden("einzeln")) }, { text: "Alle", art: "pri", fn: () => aendern(() => anwenden("alle")) }]);
    return true;
  };

  const loeschen = () => {
    if ((o.quelle.wiederholung || "keine") === "keine") return bestaetigen("Diesen Eintrag löschen?", () => aendern(() => loescheQuelle(o.quelle, art)));
    dialog("Wiederkehrenden Eintrag löschen", h("p", { style: "margin:0" }, "Nur diesen Termin oder alle Wiederholungen löschen?"), [
      { text: "Abbrechen" },
      { text: "Nur dieser", fn: () => aendern(() => { o.quelle.ausnahmen = o.quelle.ausnahmen || {}; (o.quelle.ausnahmen[v._anfang] = o.quelle.ausnahmen[v._anfang] || {}).geloescht = true; }) },
      { text: "Alle", art: "bad", fn: () => aendern(() => loescheQuelle(o.quelle, art)) }]);
  };

  const duplizieren = () => {
    const q = o.quelle, kopie = JSON.parse(JSON.stringify(q));
    delete kopie.id; delete kopie.geaendert; kopie.erledigt = false; kopie.erledigt_tage = []; kopie.ausnahmen = {};
    if (art === "essen") kopie.gericht = `${q.gericht} ${t("(Kopie)")}`; else kopie.name = `${q.name} ${t("(Kopie)")}`;
    aendern(() => { (art === "essen" ? daten.essen : daten.aufgaben).push(kopie); });
    toast(`${t("Dupliziert")}: ${art === "essen" ? kopie.gericht : kopie.name}`, true);
  };
  const alsVorlage = () => {
    const f = lesen(); if (!f) return;
    const l = Array.isArray(einst.aufgaben_vorlagen) ? einst.aufgaben_vorlagen : [], i = l.findIndex(x => x && String(x.name).toLowerCase() === f.name.toLowerCase());
    if (i < 0 && l.length >= 30) return toast("Es sind höchstens 30 Vorlagen möglich.");
    const vorlage = { name: f.name, typ: art, dauer: f.dauer, prio: f.prio, kategorie: f.kategorie, fach: f.fach, raum: f.raum, dozent: f.dozent, uhrzeit: f.uhrzeit, notiz: f.notiz, checkliste: (f.checkliste || []).map(p => ({ text: p.text, erledigt: false })), wiederholung: f.wiederholung };
    aendern(() => { const a = einst.aufgaben_vorlagen = Array.isArray(einst.aufgaben_vorlagen) ? einst.aufgaben_vorlagen : []; if (i >= 0) a[i] = vorlage; else a.push(vorlage); }, true);
    toast(`${t("Vorlage gespeichert")}: ${f.name}`, true);
  };
  bauen();
  const knoepfe = [];
  if (!neu) knoepfe.push({ text: "Löschen", art: "bad", fn: () => { loeschen(); return true; } });
  if (!neu) knoepfe.push({ text: "Duplizieren", fn: () => { duplizieren(); } });
  if (art !== "essen" && !o.lv) knoepfe.push({ text: "Als Vorlage speichern", fn: () => { alsVorlage(); return false; } });
  knoepfe.push({ text: "Abbrechen" }, { text: "Speichern", art: "pri", fn: () => speichernFn() });
  const schliessen = dialog(neu ? (o.lv ? "Lehrveranstaltung anlegen" : "Neuer Eintrag") : "Eintrag bearbeiten", body, knoepfe);
  if (neu) setTimeout(() => { try { w.name.focus(); } catch (e) { } }, 50);
  return schliessen;
}
function loescheQuelle(q, art) {
  const l = art === "essen" ? daten.essen : daten.aufgaben; const i = l.indexOf(q); if (i >= 0) l.splice(i, 1);
}

/* Eintrag per Klick: bearbeiten */
function eintragOeffnen(item) {
  eintragDialog({ v: item.v, quelle: item.v._quelle, art: item.art === "essen" ? "essen" : (item.v.typ || "aufgabe"), tag: item.tag });
}

