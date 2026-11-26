/* OSA – Timer, Wetter, Kürzel, Wochenraster-Ziehen, .ics-Import, Willkommens-Assistent, Start */
"use strict";
/* ============================================================
   Bewegung, Timer, Wetter, Kürzel, Assistent, Import wie in OSA
   ============================================================ */
let unterdrueckeKlick = false;
function animiert() { return einst.reiter_animation !== false && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); }
function aufdecken(el) {
  if (!el || !el.animate) return;
  /* Vorhang wie im Programm: eine Fläche in Hintergrundfarbe mit weichem Rand fährt von oben nach unten weg und deckt den Inhalt auf.
     Bewegt wird nur eine Verschiebung (transform) - das läuft auf der Grafikkarte und ruckelt nicht. */
  ui._animBis = performance.now() + 720;
  const sicht = Math.max(80, Math.min(el.offsetHeight, window.innerHeight)), kante = 150;
  const alt = getComputedStyle(el).position, vorhang = document.createElement("div");
  vorhang.className = "vorhang"; vorhang.style.height = sicht + kante + "px";
  vorhang.style.background = `linear-gradient(to bottom, var(--bg) calc(100% - ${kante}px), color-mix(in srgb, var(--bg) 55%, transparent) calc(100% - ${kante * 0.45}px), transparent)`;
  if (alt === "static") el.style.position = "relative";
  el.append(vorhang);
  const a = vorhang.animate([{ transform: "translateY(0)" }, { transform: `translateY(${sicht}px)` }], { duration: 700, easing: "cubic-bezier(.3,.05,.15,1)", fill: "forwards" });
  const weg = () => { vorhang.remove(); if (alt === "static") el.style.position = ""; };
  a.onfinish = weg; a.oncancel = weg; setTimeout(weg, 1500);   // Sicherheitsnetz: der Vorhang bleibt nie stehen
}
function pillenMerken() {
  const o = {};
  document.querySelectorAll(".nav,.sidenav,.sub").forEach((n, i) => { const b = n.querySelector("button.on"); if (b) o[n.className.split(" ")[0] + i] = { left: b.offsetLeft, width: b.offsetWidth, top: b.offsetTop, height: b.offsetHeight }; });
  return o;
}
function pillenZeichnen(alt) {
  document.querySelectorAll(".nav,.sidenav,.sub").forEach((n, i) => {
    const b = n.querySelector("button.on"); if (!b) return;
    const ind = h("i", { class: "ind" }); n.prepend(ind); n.classList.add("ind-ok");
    const z = { left: b.offsetLeft, width: b.offsetWidth, top: b.offsetTop, height: b.offsetHeight }, a = alt[n.className.split(" ")[0] + i];
    Object.assign(ind.style, { left: z.left + "px", top: z.top + "px", width: z.width + "px", height: z.height + "px" });
    if (a && animiert() && ind.animate && (a.left !== z.left || a.width !== z.width || a.top !== z.top))
      ind.animate([{ transform: `translate(${a.left - z.left}px, ${a.top - z.top}px)`, width: a.width + "px", height: a.height + "px" }, { transform: "translate(0, 0)", width: z.width + "px", height: z.height + "px" }], { duration: 340, easing: "cubic-bezier(.3,.6,.15,1)" });
  });
}
const kwNr = d => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), tg = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - tg); const j0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x - j0) / 864e5 + 1) / 7); };

/* ---------- Fokus-Timer ---------- */
const timer = { phase: "fokus", laeuft: false, rest: null, ende: 0, gesamt: 0, beginn: null, runden: 0, meldung: "", fach: "" };
const timerDauer = p => (p === "fokus" ? einst.timer_fokus : einst.timer_pause) * 60;
function timerInit() { if (timer.rest === null) timer.rest = timer.gesamt = timerDauer("fokus"); }
function timerPhase(p) { timer.phase = p; timer.gesamt = timer.rest = timerDauer(p); }
function timerAnzeigen() {
  if (!einst) return;
  timerInit();
  const rest = Math.max(0, Math.ceil(timer.rest)), zeit = `${pad(Math.floor(rest / 60))}:${pad(rest % 60)}`;
  const z = $("#timer-zeit"); if (z) z.textContent = zeit;
  const k = $("#timer-start"); if (k) k.textContent = t(timer.laeuft ? "Pause" : (timer.rest < timer.gesamt - 0.5 ? "Weiter" : "Start"));
  const s = $("#timer-status"); if (s) s.textContent = `${t(timer.phase === "fokus" ? "Fokus" : "Pause")}  ·  ${t("Runden")}: ${timer.runden}${timer.meldung ? "  ·  " + timer.meldung : ""}`;
  document.title = timer.laeuft ? `${zeit} ${timer.phase === "fokus" ? "Fokus" : "Pause"} – OSA` : "OSA – Open Student Agenda";
}
function timerStartPause() {
  timerInit();
  if (timer.laeuft) { timer.rest = Math.max(0, (timer.ende - Date.now()) / 1000); timer.laeuft = false; }
  else { if (timer.phase === "fokus" && !timer.beginn) { timer.beginn = new Date(); timer.meldung = ""; } timer.ende = Date.now() + timer.rest * 1000; timer.laeuft = true; }
  timerAnzeigen();
}
function timerVerbuchen(min) {
  const fach = timer.fach, beginn = timer.beginn || new Date(Date.now() - min * 60000);
  aendern(() => {
    if (fach && !(fach in daten.faecher)) daten.faecher[fach] = { ziel: 0 };
    daten.aufgaben.push({ name: fach ? `Lernen: ${fach}` : "Lernen", typ: "aufgabe", dauer: Math.max(1, Math.round(min)), prio: 2, kategorie: einst.kategorien.includes("Uni") ? "Uni" : einst.kategorien[0], fach, raum: "", dozent: "", vorlauf: 0, notiz: "Fokus-Timer", checkliste: [], datum: iso(beginn), uhrzeit: `${pad(beginn.getHours())}:${pad(beginn.getMinutes())}`, enddatum: "", wiederholung: "keine", wiederholen_bis: "", erledigt: true, erledigt_tage: [], farbe: "", ausnahmen: {} });
  });
  timer.runden++; timer.beginn = null; timer.meldung = `✓ ${Math.round(min)} Min verbucht`;
}
function timerPhaseFertig() {
  timer.laeuft = false;
  if (timer.phase === "fokus") {
    const min = Math.round(timer.gesamt / 60), fach = timer.fach, pause = einst.timer_pause;
    timerVerbuchen(min);
    const msg = `${min} Min verbucht${fach ? " für " + fach : ""}.${pause ? ` Jetzt ${pause} Min Pause.` : ""}`;
    toast("Fokus geschafft! " + msg, true); systemMeldung("Fokus geschafft! " + msg);
    timerPhase(pause ? "pause" : "fokus"); if (pause) timerStartPause();
  } else {
    toast("Pause vorbei – bereit für die nächste Runde?"); systemMeldung("Pause vorbei – bereit für die nächste Runde?");
    timer.beginn = null; timerPhase("fokus");
  }
  timerAnzeigen();
}
function timerFertigKlick() {
  timerInit();
  if (timer.laeuft) { timer.rest = Math.max(0, (timer.ende - Date.now()) / 1000); timer.laeuft = false; }
  const gelaufen = timer.gesamt - timer.rest;
  if (timer.phase !== "fokus" || gelaufen < 30) { timerAnzeigen(); return toast("Es gibt noch keine Lernzeit zum Verbuchen. Starte zuerst eine Fokus-Runde."); }
  timerVerbuchen(Math.max(1, Math.round(gelaufen / 60))); timerPhase("fokus"); timerAnzeigen();
}
function timerReset() { timer.laeuft = false; timer.beginn = null; timer.meldung = ""; timerPhase("fokus"); timerAnzeigen(); }
setInterval(() => { if (!timer.laeuft) return; timer.rest = (timer.ende - Date.now()) / 1000; if (timer.rest <= 0) timerPhaseFertig(); else timerAnzeigen(); }, 250);
function timerKarte() {
  timerInit();
  const fachSel = auswahl([["", "–"]].concat(Object.keys(daten.faecher).sort((a, b) => a.localeCompare(b)).map(f => [f, f])), timer.fach, true);
  fachSel.onchange = () => { timer.fach = fachSel.value; };
  const fok = h("input", { type: "number", min: 5, max: 180, step: 5, value: einst.timer_fokus, style: "width:84px" }), pau = h("input", { type: "number", min: 0, max: 60, step: 5, value: einst.timer_pause, style: "width:84px" });
  const dauer = () => { const f = Math.round(+fok.value), p = Math.round(+pau.value); if (!(f >= 5 && f <= 180 && p >= 0 && p <= 60)) return; einst.timer_fokus = f; einst.timer_pause = p; speichern(); if (!timer.laeuft && !timer.beginn && timer.phase === "fokus") { timerPhase("fokus"); timerAnzeigen(); } };
  fok.onchange = dauer; pau.onchange = dauer;
  return h("div", { class: "card", style: "margin-bottom:14px" }, h("h3", null, "Fokus-Timer"),
    h("div", { class: "row", style: "gap:22px" }, h("div", { class: "timer-zeit", id: "timer-zeit" }, "25:00"),
      h("div", { style: "display:flex;flex-direction:column;gap:10px;flex:1;min-width:240px" }, h("div", { class: "row" }, feld("Fach", fachSel), feld("Fokus (Min)", fok), feld("Pause (Min)", pau)),
        h("div", { class: "row" }, h("button", { class: "btn pri", id: "timer-start", onclick: timerStartPause }, "Start"), h("button", { class: "btn", onclick: timerFertigKlick }, "Fertig und verbuchen"), h("button", { class: "btn", onclick: timerReset }, "Zurücksetzen"), h("span", { class: "mut small", id: "timer-status" })))));
}

/* ---------- Wetter (Open-Meteo, ohne Anmeldung) ---------- */
const WETTER_GEO = "https://geocoding-api.open-meteo.com/v1/search", WETTER_API = "https://api.open-meteo.com/v1/forecast", WETTER_KEY = "alltagsplaner.wetter.v1";
function wetterSymbol(c) {
  if (c == null) return ""; if (c === 0) return "☀"; if (c === 1 || c === 2) return "⛅"; if (c === 3) return "☁"; if (c === 45 || c === 48) return "≈";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return "☂"; if ([71, 73, 75, 77, 85, 86].includes(c)) return "❄"; if ([95, 96, 99].includes(c)) return "⚡"; return "·";
}
async function wetterAktualisieren(neu = false) {
  if (!einst.wetter_an) { ui.wetter = { tage: {}, status: "aus", name: "" }; return; }
  const ort = (einst.wetter_ort || "").trim();
  if (ort.length < 2) { ui.wetter = { tage: {}, status: "kein_ort", name: "" }; return; }
  let cache = {}; try { cache = JSON.parse(localStorage.getItem(WETTER_KEY) || "{}"); } catch (e) { }
  const alt = cache[ort.toLowerCase()];
  if (alt && !neu && Date.now() - alt.t < 3 * 3600e3) { ui.wetter = { tage: alt.tage, status: "cache", name: alt.name }; render(); return; }
  ui.wetter = { tage: alt ? alt.tage : {}, status: "lädt", name: alt ? alt.name : "" };
  try {
    let lat, lon, name;
    if (alt && alt.lat != null) ({ lat, lon, name } = alt);
    else {
      const g = await (await fetch(`${WETTER_GEO}?name=${encodeURIComponent(ort)}&count=1&language=de&format=json`)).json(), tr = (g.results || [])[0];
      if (!tr) { ui.wetter = { tage: {}, status: "unbekannt", name: "" }; render(); return; }
      lat = tr.latitude; lon = tr.longitude; name = tr.name + (tr.country ? ", " + tr.country : "");
    }
    const v = await (await fetch(`${WETTER_API}?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&past_days=7&forecast_days=16`)).json(), d = v.daily, tage = {};
    d.time.forEach((tz, i) => { if (d.temperature_2m_max[i] != null && d.temperature_2m_min[i] != null) tage[tz] = { code: d.weather_code[i], max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]) }; });
    cache[ort.toLowerCase()] = { t: Date.now(), lat, lon, name, tage }; try { localStorage.setItem(WETTER_KEY, JSON.stringify(cache)); } catch (e) { }
    ui.wetter = { tage, status: "frisch", name };
  } catch (e) { ui.wetter = alt ? { tage: alt.tage, status: "alt", name: alt.name } : { tage: {}, status: "fehler", name: "" }; }
  render();
}
function wetterSektion() {
  const ort = h("input", { type: "text", value: einst.wetter_ort || "", placeholder: "z. B. Berlin" });
  ort.onchange = () => { setzen("wetter_ort", ort.value.trim(), false); wetterAktualisieren(true); };
  const an = h("input", { type: "checkbox", checked: !!einst.wetter_an, onchange: () => { setzen("wetter_an", an.checked, true); wetterAktualisieren(true); } });
  const status = { aus: "", "lädt": "Lade Wetter …", kein_ort: "Bitte einen Ort eingeben.", unbekannt: "Diesen Ort habe ich nicht gefunden.", frisch: "Aktuell geladen", cache: "Aktuell (gespeichert)", alt: "Internet nicht erreichbar – ältere Daten", fehler: "Wetter nicht verfügbar (Internet?)" }[ui.wetter.status] || "";
  return sektion("Wetter", h("label", { class: "row", style: "cursor:pointer" }, an, "Wetter in der Wochenansicht zeigen"), feld("Ort", ort),
    h("p", { class: "mut small", style: "margin:0" }, R((ui.wetter.name && ["frisch", "cache", "alt"].includes(ui.wetter.status) ? ui.wetter.name + ": " : "") + t(status))),
    h("p", { class: "mut small", style: "margin:0" }, "Die Vorhersage kommt kostenlos von Open-Meteo. Dafür wird der Ortsname aus diesem Feld ins Internet geschickt, sonst nichts."));
}
/* Kurzinfo unter jeder Kategorie in der Übersicht der Einstellungen */
function einstZusammenfassung(k) {
  const an = x => t(x ? "eingeschaltet" : "ausgeschaltet");
  try {
    if (k === "reiter") {
      const sichtbar = sichtbareReiter().filter(([r]) => r !== "plus").length, namen = leistenAuswahl().map(r => t((REITER.find(x => x[0] === r) || [r, r])[1]));
      return `${sichtbar} ${t("Reiter sichtbar")} · ${t("Leiste")}: ${namen.join(", ") || "–"}`;
    }
    if (k === "aussehen") return [t((DESIGN_AUSWAHL.find(d => d[0] === einst.design) || ["", "Automatisch (System)"])[1]), SPRACHEN[einst.sprache] || "", t(einst.schrift_stufe || "Normal")].filter(Boolean).join(" · ");
    if (k === "kalender") { const land = feiertageLand(); return `${einst.woche_von}–${einst.woche_bis} ${t("Uhr")} · ${t("Feiertage")}: ${land === "aus" ? an(false) : land} · ${t("Ferien")}: ${an(einst.ferien_art !== "aus")}`; }
    if (k === "termine") return `${t("Termin")} ${einst.termin_dauer} min · ${t("Lehrveranstaltung")} ${einst.stundenplan_dauer} min · ${t("Erinnerungen")}: ${an(einst.erinnerung_an)}`;
    if (k === "essen") return `${t("Mahlzeiten")}: ${an(einst.essen_an !== false)} · ${t("Rezepte")}: ${an(einst.rezepte_an)} · ${t("Preisvorschläge")}: ${an(einst.preis_vorschlag !== false)}`;
    if (k === "daten") {
      if (pcApi()) return t("Automatische Sicherung jeden Tag");
      const letzte = localStorage.getItem(DOWNLOAD_KEY);
      return `${t("Letzte Sicherung")}: ${letzte ? (letzte === iso(heute()) ? t("heute") : deDatum(letzte)) : t("noch keine")}`;
    }
  } catch (e) { }
  return "";
}
function einstStatus() {
  const g = ui.gespeichert; if (!g) return null;
  return h("p", { class: "mut small", style: "margin:14px 2px 0" }, R(`✓ ${t("Einstellungen gespeichert.")} (${pad(g.getHours())}:${pad(g.getMinutes())}:${pad(g.getSeconds())})`));
}
function limitFeld() {
  const i = h("input", { type: "number", min: 0, step: 10, value: einst.budget_limit || "", placeholder: "0", style: "width:96px" });
  const setze = () => setzen("budget_limit", Math.max(0, parseFloat(String(i.value).replace(",", ".")) || 0), true);
  i.onkeydown = e => { if (e.key === "Enter") setze(); };
  const essen = h("input", { type: "checkbox", checked: !!einst.budget_essen, onchange: () => setzen("budget_essen", essen.checked, true) });
  return h("div", { class: "row", style: "gap:6px" }, h("label", { class: "row", style: "gap:6px;cursor:pointer", title: "Geschätzte Essenskosten aus Rezepten und Preisen im Budget mitrechnen (braucht Rezepte, Vorräte und Preise)" }, essen, h("span", { class: "small" }, "Essenspreise einrechnen")), h("span", { class: "mut small" }, "Monatsbudget (€)"), i, h("button", { class: "btn sm", onclick: setze }, "Setzen"));
}

/* ---------- Einkaufsliste: eigene Erinnerung ---------- */
function ekErinnerungZeile() {
  const an = h("input", { type: "checkbox", checked: !!einst.einkauf_erinnerung }), tg = auswahl([["Täglich", "Täglich"]].concat(WOCHENTAGE.map(w => [w, w])), einst.einkauf_tag || "Samstag"), zt = h("input", { type: "time", value: einst.einkauf_zeit || "10:00" });
  const geaendert = () => {
    if (!/^\d{2}:\d{2}$/.test(zt.value)) return;
    einst.einkauf_erinnerung = an.checked; einst.einkauf_tag = tg.value; einst.einkauf_zeit = zt.value; speichern(); ui.gespeichert = new Date();
    const jetzt = new Date(); if (an.checked && `${pad(jetzt.getHours())}:${pad(jetzt.getMinutes())}` >= zt.value) gemeldet.add("einkauf|" + iso(jetzt));   // Uhrzeit heute schon vorbei: erst beim nächsten Mal
  };
  an.onchange = geaendert; tg.onchange = geaendert; zt.onchange = geaendert;
  return h("div", { class: "row", style: "margin:0 0 12px" }, h("label", { class: "row", style: "cursor:pointer;gap:8px" }, an, "Erinnere mich an die Liste"), tg, h("span", { class: "mut" }, "um"), zt, h("span", { class: "mut small" }, "Uhr (nur wenn noch etwas offen ist)"));
}
function einkaufErinnerungFaellig(jetzt) {
  if (!einst.einkauf_erinnerung) return null;
  const tg = einst.einkauf_tag; if (tg !== "Täglich" && WOCHENTAGE.indexOf(tg) !== wochentagNr(jetzt)) return null;
  const zeit = /^\d{2}:\d{2}$/.test(einst.einkauf_zeit) ? einst.einkauf_zeit : "10:00";
  if (`${pad(jetzt.getHours())}:${pad(jetzt.getMinutes())}` < zeit || gemeldet.has("einkauf|" + iso(jetzt))) return null;
  const offen = daten.einkauf.filter(e => !e.gekauft).map(e => e.text); if (!offen.length) return null;
  return `${offen.length} Artikel auf der Einkaufsliste: ${offen.slice(0, 4).join(", ")}${offen.length > 4 ? " …" : ""}`;
}

/* ---------- Wochenraster: Ziehen zum Anlegen und Verschieben ---------- */
function ghostWeg() { document.querySelectorAll(".dghost").forEach(g => g.remove()); }
function ghostZeigen(col, von, bisMin, v0, hh, hover, text) {
  /* Ein einziges Vorschau-Element wiederverwenden (kein Neuaufbau bei jeder Mausbewegung) */
  let g = col.querySelector(":scope > .dghost");
  document.querySelectorAll(".dghost").forEach(x => { if (x !== g) x.remove(); });
  if (!g) { g = document.createElement("div"); col.append(g); }
  const kl = "dghost" + (hover ? " hov" : ""); if (g.className !== kl) g.className = kl;
  g.style.top = (von / 60 - v0) * hh + "px"; g.style.height = Math.max((bisMin - von) / 60 * hh, 14) + "px";
  const tx = text || `${minutenText(von)} – ${minutenText(bisMin)}`; if (g.textContent !== tx) g.textContent = tx;
}
function dragAnbinden(col, tag, von, hh, nurHover = false, dauerMin = einst.termin_dauer, neuFn = null) {   // neuFn(tag, startMinute, dauer): eigener Dialog statt „Neuer Termin“
  const minuteAn = (y, runden) => { const r = col.getBoundingClientRect(), m = von * 60 + (y - r.top) / hh * 60; return runden ? Math.round(m / 15) * 15 : Math.floor(m / 15) * 15; };
  const leer0 = ev => ev.target === col || ev.target.classList.contains("hl") || ev.target.classList.contains("dghost");
  col.addEventListener("pointermove", ev => {
    if (ev.pointerType === "touch" || ev.buttons || !leer0(ev)) { if (!ev.buttons) ghostWeg(); return; }
    const m = Math.max(von * 60, Math.min(minuteAn(ev.clientY, false), 1440 - dauerMin));
    if (col._hm === m && col.querySelector(":scope > .dghost.hov")) return;
    col._hm = m;
    ghostZeigen(col, m, m + dauerMin, von, hh, true, t("+ Neu um ") + minutenText(m));
  });
  col.addEventListener("pointerleave", () => { if (!document.querySelector(".dghost:not(.hov)")) ghostWeg(); });
  col.addEventListener("pointerdown", ev => {
    if (nurHover || ev.button !== 0 || ev.pointerType === "touch" || !leer0(ev)) return;
    const m0 = Math.max(0, minuteAn(ev.clientY, false)), y0 = ev.clientY; let bewegt = false, zielWert = null;
    ghostWeg();
    const bew = e2 => {
      if (!bewegt && Math.abs(e2.clientY - y0) < 6) return; bewegt = true;
      const jetzt = Math.max(0, Math.min(1440, minuteAn(e2.clientY, true)));
      let start, ende; if (jetzt >= m0) { start = m0; ende = Math.max(jetzt, m0 + 15); } else { start = jetzt; ende = m0 + 15; }
      ende = Math.min(ende, 1440); zielWert = [start, ende - start]; ghostZeigen(col, start, ende, von, hh, false);
    };
    const hoch = () => {
      document.removeEventListener("pointermove", bew); document.removeEventListener("pointerup", hoch); ghostWeg();
      if (bewegt && zielWert) {
        unterdrueckeKlick = true; setTimeout(() => { unterdrueckeKlick = false; }, 60);
        if (neuFn) neuFn(tag, zielWert[0], zielWert[1]);
        else eintragDialog({ tag, art: "termin", vorgabe: { uhrzeit: minutenText(zielWert[0]), datum: iso(tag), dauer: zielWert[1] } });
      }
    };
    document.addEventListener("pointermove", bew); document.addEventListener("pointerup", hoch);
  });
}
function verschiebenStarten(ev, it, cols, von, hh, ganztag = false) {
  if (ev.button !== 0 || ev.pointerType === "touch") return;
  const el = ev.currentTarget, y0 = ev.clientY, x0 = ev.clientX, r0 = el.getBoundingClientRect(), versatz = y0 - r0.top, dauer = Math.max(dauerVon(it), 15);
  let bewegt = false, zielWert = null;
  const spalteBei = x => cols.reduce((best, c) => { const r = c.el.getBoundingClientRect(), d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0; return !best || d < best.d ? { c, d } : best; }, null).c;
  const bew = e2 => {
    if (!bewegt && Math.abs(e2.clientY - y0) < 6 && Math.abs(e2.clientX - x0) < 6) return;
    if (!bewegt) { bewegt = true; el.style.opacity = ".4"; document.body.style.cursor = "grabbing"; }
    const sp = spalteBei(e2.clientX); cols.forEach(c => c.el.classList.toggle("drop", ganztag && c === sp));
    if (ganztag) { zielWert = { tag: sp.tag, minute: null }; return; }
    const r = sp.el.getBoundingClientRect(), m = Math.max(von * 60, Math.min(1440 - dauer, Math.round((von * 60 + (e2.clientY - versatz - r.top) / hh * 60) / 15) * 15));
    zielWert = { tag: sp.tag, minute: m }; ghostZeigen(sp.el, m, m + dauer, von, hh, false, `${minutenText(m)}  ${titelVon(it)}`);
  };
  const hoch = () => {
    document.removeEventListener("pointermove", bew); document.removeEventListener("pointerup", hoch);
    el.style.opacity = ""; document.body.style.cursor = ""; ghostWeg(); cols.forEach(c => c.el.classList.remove("drop"));
    if (bewegt && zielWert) { unterdrueckeKlick = true; setTimeout(() => { unterdrueckeKlick = false; }, 60); eintragVerschieben(it, zielWert.tag, zielWert.minute); }
  };
  document.addEventListener("pointermove", bew); document.addEventListener("pointerup", hoch);
}
/* ---------- Dauer per Ziehen an der Unterkante ändern (in 15-Minuten-Schritten) ---------- */
function dauerZiehen(ev, el, it, beginn, hh) {
  if (ev.button !== 0) return;
  ev.stopPropagation(); ev.preventDefault();   // nicht gleichzeitig verschieben
  const y0 = ev.clientY, hoehe0 = el.style.height, dauer0 = Math.max(it.v.dauer || 30, 15);
  let dauerNeu = dauer0, bewegt = false;
  const anzeige = h("div", { class: "ev-dauer" });
  const bew = e2 => {
    const dy = e2.clientY - y0; if (!bewegt && Math.abs(dy) < 4) return;
    if (!bewegt) { bewegt = true; unterdrueckeKlick = true; el.append(anzeige); el.classList.add("ziehen"); }
    dauerNeu = Math.min(Math.max(15, Math.round((dauer0 + dy / hh * 60) / 15) * 15), 1440 - beginn);
    el.style.height = Math.max(dauerNeu / 60 * hh, 20) + "px";
    anzeige.textContent = `${minutenText(beginn)}–${minutenText(beginn + dauerNeu)} · ${dauerNeu} min`;
  };
  const hoch = () => {
    document.removeEventListener("pointermove", bew); document.removeEventListener("pointerup", hoch);
    anzeige.remove(); el.classList.remove("ziehen"); setTimeout(() => { unterdrueckeKlick = false; }, 60);
    if (bewegt && dauerNeu !== dauer0) dauerSetzen(it, dauerNeu); else el.style.height = hoehe0;
  };
  document.addEventListener("pointermove", bew); document.addEventListener("pointerup", hoch);
}
function dauerSetzen(it, dauer) {
  const q = it.v._quelle, anfang = it.v._anfang;
  if ((q.wiederholung || "keine") === "keine") return aendern(() => { q.dauer = dauer; });
  dialog("Serie ändern", h("p", { style: "margin:0" }, "Dieser Eintrag wiederholt sich. Die neue Dauer nur für diesen Termin oder für die ganze Serie übernehmen?"),
    [{ text: "Abbrechen", fn: () => { render(); } },
     { text: "Ganze Serie", fn: () => aendern(() => { q.dauer = dauer; }) },
     { text: "Nur diesen Termin", art: "pri", fn: () => aendern(() => { q.ausnahmen = q.ausnahmen || {}; const a = q.ausnahmen[anfang] = q.ausnahmen[anfang] || {}; delete a.geloescht; if (dauer === q.dauer) delete a.dauer; else a.dauer = dauer; }) }]);
}
function eintragVerschieben(it, tagNeu, minuteNeu) {
  const v = it.v, q = v._quelle, anfang = v._anfang, tagAlt = parseISO(v._start || iso(it.tag)), uhrAlt = v.uhrzeit || "", uhrNeu = minuteNeu === null ? uhrAlt : minutenText(minuteNeu);
  if (iso(tagNeu) === iso(tagAlt) && uhrNeu === uhrAlt) return;
  const delta = diffDays(tagNeu, tagAlt), sch = s => iso(addDays(parseISO(s), delta));
  const anwenden = modus => aendern(() => {
    if (modus === "einzel") {
      const aus = (q.ausnahmen = q.ausnahmen || {}), a = Object.assign({}, aus[anfang] || {}); delete a.geloescht;
      if (uhrNeu !== (q.uhrzeit || "")) a.uhrzeit = uhrNeu; else delete a.uhrzeit;
      if (iso(tagNeu) !== anfang) a.datum = iso(tagNeu); else delete a.datum;
      if (Object.keys(a).length) aus[anfang] = a; else delete aus[anfang];
    } else {
      q.datum = sch(q.datum); for (const f of ["enddatum", "wiederholen_bis"]) if (q[f]) q[f] = sch(q[f]);
      q.uhrzeit = uhrNeu;
      if (modus === "serie") { const neuAus = {}; for (const [k, a] of Object.entries(q.ausnahmen || {})) { const b = Object.assign({}, a); if (b.datum) b.datum = sch(b.datum); neuAus[sch(k)] = b; } q.ausnahmen = neuAus; }
    }
  });
  if ((q.wiederholung || "keine") !== "keine") dialog("Serie verschieben", h("p", { style: "margin:0" }, "Dieser Eintrag wiederholt sich. Nur diesen Termin verschieben oder die ganze Serie?"),
    [{ text: "Abbrechen" }, { text: "Ganze Serie", fn: () => anwenden("serie") }, { text: "Nur diesen Termin", art: "pri", fn: () => anwenden("einzel") }]);
  else anwenden("einmal");
}

/* ---------- Tastenkürzel, Hilfe, Schnell-Dialog ---------- */
function schnellAnlegen(text) {
  const e = schnellErkennen(text, new Date(), einst.kategorien);
  if (!e) return [null, "Ich brauche mindestens einen Namen, zum Beispiel „Mathe lernen morgen 10 Uhr“."];
  if (e.fehler) return [null, e.fehler];
  return [schnellEintragen(e), null];
}
function schnellDialog() {
  const eing = h("input", { type: "text", placeholder: "Mathe-Klausur Freitag 14 Uhr", style: "font-size:16px" }), vor = h("p", { class: "mut small", style: "margin:0;min-height:20px" }, "Zum Beispiel: Mathe-Klausur Freitag 14 Uhr, Lernen morgen 9-11 Uhr #Uni, Mittag Nudeln 650 kcal, Mensa 4,50 €.");
  eing.oninput = () => { const e = eing.value.trim() ? schnellErkennen(eing.value, new Date(), einst.kategorien) : null; vor.style.color = e ? (e.fehler ? "var(--bad)" : "var(--acc)") : ""; vor.textContent = e ? (e.fehler ? e.fehler : "→ " + schnellVorschau(e) + (e.datum ? "" : "  ·  heute")) : t("Zum Beispiel: Mathe-Klausur Freitag 14 Uhr, Lernen morgen 9-11 Uhr #Uni, Mittag Nudeln 650 kcal, Mensa 4,50 €."); };
  let zu = () => { };
  const anlegen = () => { const [b, f] = schnellAnlegen(eing.value); if (f) { vor.style.color = "var(--bad)"; vor.textContent = t(f); return; } zu(); toast("Angelegt: " + b, true); };
  eing.onkeydown = ev => { if (ev.key === "Enter") anlegen(); };
  zu = dialog("Was steht an?", [eing, vor], [{ text: "Abbrechen" }, { text: "Hinzufügen", art: "pri", fn: () => { anlegen(); return false; } }]);
}
function hilfeDialog() {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || ""), alt = mac ? "⌥" : "Alt", strg = mac ? "⌘" : t("Strg");
  const zeile = (k, tx) => h("div", { class: "row", style: "gap:14px;margin:3px 0" }, h("b", { style: "width:150px;color:var(--acc);flex:none" }, R(k)), h("span", null, tx));
  dialog("Tastenkürzel und Tipps", [
    h("h3", null, "Tastenkürzel"),
    zeile(`${alt} + N`, "Schnell etwas hinzufügen (von überall)"), zeile(`${strg} + K`, "Suchen"), zeile(`${alt} + 1 … 9`, "Zum 1. … 9. sichtbaren Reiter wechseln"), zeile(`${alt} + ,`, "Einstellungen öffnen"), zeile(`${alt} + ${t("Ziehen")}`, "Reiter mit gedrückter linker Maustaste an eine andere Stelle ziehen (Reihenfolge ändern)"), zeile(`${alt} + ${t("Umschalt")} + ←/→`, "Ausgewählten Reiter verschieben"),
    zeile(`${strg} + Z`, "Letzte Änderung rückgängig machen"), zeile("F1", "Diese Hilfe"),
    h("h3", { style: "margin-top:14px" }, "Schnell-Eingabe: so schreibst du"),
    ...[["Mathe-Klausur Freitag 14 Uhr", "Termin am nächsten Freitag"], ["Lernen morgen 9-11 Uhr #Uni", "2 Stunden, Kategorie Uni"], ["Zahnarzt 3.12. um 8:30", "mit Datum und Uhrzeit"], ["Wäsche waschen in 3 Tagen", "Aufgabe ohne Uhrzeit"], ["Training heute 18 Uhr für 90 min", "mit Dauer"], ["Referat vorbereiten !", "Ausrufezeichen = wichtig"]].map(([a, b]) => h("div", { class: "row", style: "gap:14px;margin:3px 0" }, h("b", { style: "width:250px;flex:none" }, R(t(a))), h("span", { class: "mut" }, b))),
    h("p", { class: "mut small", style: "margin:12px 0 0" }, "Im Wochenkalender: auf eine freie Stelle ziehen = neuer Termin, einen Eintrag ziehen = verschieben."),
    h("h3", { style: "margin-top:14px" }, "Auf anderes Gerät übertragen (QR-Code)"),
    h("ol", { class: "neu-liste" },
      h("li", null, "Einstellungen › Daten und Export › „Auf anderes Gerät übertragen …“"),
      h("li", null, "Auf dem Gerät mit deinen Daten „Senden“, auf dem anderen Gerät „Empfangen“ und die Kamera auf den Code halten."),
      h("li", null, "Größere Datenmengen werden auf mehrere Codes verteilt, die alle 2 Sekunden wechseln. Die Reihenfolge ist egal – einfach draufhalten, bis alle Teile gelesen sind."),
      h("li", null, "Zu schnell? Mit „Pause“ bleibt ein Code stehen, mit ‹ › blätterst du selbst. Beim Empfangen siehst du, welche Teile noch fehlen.")),
    h("p", { class: "mut small", style: "margin:8px 0 0" }, "Beim Empfangen werden die Daten auf dem empfangenden Gerät ersetzt – mit „Rückgängig“ holst du den alten Stand zurück.")], [{ text: "Schließen", art: "pri" }], { breit: true });
}
function reiterNr(n) {
  const liste = REITER.filter(([k]) => k !== "plus" && k !== "einstellungen" && k !== "suche" && (FIX.has(k) || !einst.reiter_aus.includes(k) || (k === "suche" && ui._sucheTemp))), z = liste[n - 1]; if (!z) return;
  ui.tab = z[0]; uiSpeichern(); render(); window.scrollTo(0, 0);
}
function suchFokus() {
  if (einst.reiter_aus.includes("suche")) ui._sucheTemp = true;
  ui.tab = "suche"; render();
  setTimeout(() => { const i = document.querySelector("main input[type=text]"); if (i) { i.focus(); i.select(); } }, 0);
}
function tastenkuerzelBinden() {
  document.addEventListener("keydown", e => {
    const tippt = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || "") || (e.target && e.target.isContentEditable);
    if (e.key === "F1") { e.preventDefault(); if (!document.querySelector(".ov")) hilfeDialog(); return; }
    if (document.querySelector(".ov")) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (/^Digit[1-9]$/.test(e.code)) { e.preventDefault(); reiterNr(+e.code.slice(5)); }
      else if (e.code === "KeyN") { e.preventDefault(); schnellDialog(); }
      else if (e.code === "Comma") { e.preventDefault(); ui.tab = "einstellungen"; render(); }
    } else if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") { e.preventDefault(); suchFokus(); }
    else if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !e.shiftKey && !tippt) { e.preventDefault(); rueckgaengig(); }
  });
}

/* ---------- Kalender importieren (.ics) ---------- */
const WT_KZ = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
function icsZeit(wert) {
  wert = String(wert).trim();
  if (/^\d{8}$/.test(wert)) return { d: new Date(+wert.slice(0, 4), +wert.slice(4, 6) - 1, +wert.slice(6, 8), 12), ganz: true };
  const m = wert.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/i); if (!m) return null;
  const dt = m[7] ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return { d: dt, ganz: false };
}
function icsDauer(tx) { const m = String(tx).trim().match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/); if (!m) return null; const [w, d, hh, mi, s] = m.slice(1).map(x => +x || 0); return w * 10080 + d * 1440 + hh * 60 + mi + Math.floor(s / 60); }
function serienTage(start, freq, intervall, byday, bis, anzahl, grenze) {
  const tage = []; let tag = start;
  for (let n = 0; n < 5000; n++) {
    if (bis && tag > bis) break;
    if (freq === "WEEKLY" && byday.length) {
      const montag = addDays(tag, -wochentagNr(tag));
      for (const wt of [...byday].sort((a, b) => a - b)) { const k = addDays(montag, wt); if (k >= start && (!bis || k <= bis)) tage.push(k); }
      tag = addDays(montag, 7 * intervall);
    } else {
      tage.push(tag);
      if (freq === "DAILY") tag = addDays(tag, intervall); else if (freq === "WEEKLY") tag = addDays(tag, 7 * intervall);
      else if (freq === "MONTHLY") tag = addMonate(start, tage.length * intervall); else tag = addMonate(start, 12 * tage.length * intervall);
    }
    if ((anzahl && tage.length >= anzahl) || tage.length >= grenze) break;
  }
  const u = [...new Map(tage.map(d => [iso(d), d])).values()].sort((a, b) => a - b);
  return anzahl ? u.slice(0, anzahl) : u.slice(0, grenze);
}
function icsUmwandeln(ev) {
  if (!ev.DTSTART) return [];
  const b = icsZeit(ev.DTSTART[1]); if (!b) return [];
  let ende = null;
  if (ev.DTEND) { const e2 = icsZeit(ev.DTEND[1]); ende = e2 ? e2.d : null; }
  else if (ev.DURATION && !b.ganz) { const mn = icsDauer(ev.DURATION[1]); if (mn !== null) ende = new Date(b.d.getTime() + mn * 60000); }
  const entsch = s => String(s || "").replace(/\\(.)/g, (m, c) => c === "n" || c === "N" ? "\n" : c);
  const name = entsch((ev.SUMMARY || ["", ""])[1]).trim() || "(ohne Titel)", ort = entsch((ev.LOCATION || ["", ""])[1]).trim(), notiz = entsch((ev.DESCRIPTION || ["", ""])[1]).trim().slice(0, 500);
  let start, enddatum = "", uhrzeit = "", dauer = 60;
  if (b.ganz) { start = b.d; const letzter = ende ? addDays(ende, -1) : start; enddatum = letzter > start ? iso(letzter) : ""; }
  else { start = new Date(b.d.getFullYear(), b.d.getMonth(), b.d.getDate(), 12); uhrzeit = `${pad(b.d.getHours())}:${pad(b.d.getMinutes())}`; dauer = Math.max(5, Math.min(ende ? Math.round((ende - b.d) / 60000) : 60, 1440)); }
  const basis = { name, uhrzeit, dauer, enddatum, ort, notiz };
  const einzel = tag => Object.assign({}, basis, { datum: iso(tag), wiederholung: "keine", bis: "", ausnahmen: [] });
  const regel = {}; if (ev.RRULE) ev.RRULE[1].split(";").forEach(p => { const i = p.indexOf("="); if (i > 0) regel[p.slice(0, i).trim().toUpperCase()] = p.slice(i + 1).trim(); });
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(regel.FREQ)) return [einzel(start)];
  const freq = regel.FREQ, intervall = Math.max(1, parseInt(regel.INTERVAL || "1", 10) || 1), anzahl = regel.COUNT ? (parseInt(regel.COUNT, 10) || 0) : 0;
  let bis = null; if (regel.UNTIL) { const m = regel.UNTIL.match(/^(\d{4})(\d{2})(\d{2})/); if (m) bis = new Date(+m[1], +m[2] - 1, +m[3], 12); }
  const ausgenommen = new Set(); for (const [, w] of ev.exdate) for (const teil of w.split(",")) { const z = icsZeit(teil); if (z) ausgenommen.add(iso(z.d)); }
  const byday = []; let unbekannt = false;
  for (const kz of (regel.BYDAY || "").split(",")) { const k = kz.trim().toUpperCase(); if (!k) continue; if (k in WT_KZ) byday.push(WT_KZ[k]); else unbekannt = true; }
  let direkt = ({ "DAILY|1": "täglich", "WEEKLY|1": "wöchentlich", "WEEKLY|2": "alle 2 Wochen", "MONTHLY|1": "monatlich", "YEARLY|1": "jährlich" })[`${freq}|${intervall}`] || null;
  if (freq !== "WEEKLY" && (byday.length || unbekannt || regel.BYMONTHDAY || regel.BYSETPOS)) direkt = null;
  if (unbekannt) return [einzel(start)];
  let letzte = bis; if (anzahl) { const tg = serienTage(start, freq, intervall, byday, bis, anzahl, 1000); letzte = tg.length ? tg[tg.length - 1] : start; }
  const serie = (datum, wdh) => Object.assign({}, basis, { datum: iso(datum), wiederholung: wdh, bis: letzte ? iso(letzte) : "", ausnahmen: [...ausgenommen] });
  if (direkt && (freq !== "WEEKLY" || !byday.length || (byday.length === 1 && byday[0] === wochentagNr(start)))) return [serie(start, direkt)];
  if (freq === "WEEKLY" && byday.length && (intervall === 1 || intervall === 2)) {
    const res = [];
    for (const wt of [...new Set(byday)].sort()) {
      let erster = addDays(start, ((wt - wochentagNr(start)) % 7 + 7) % 7); if (wt < wochentagNr(start) && intervall > 1) erster = addDays(erster, 7 * (intervall - 1));
      if (letzte && erster > letzte) continue; res.push(serie(erster, intervall === 1 ? "wöchentlich" : "alle 2 Wochen"));
    }
    return res;
  }
  return serienTage(start, freq, intervall, byday, bis || addDays(heute(), 365), anzahl, 150).filter(tg => !ausgenommen.has(iso(tg))).map(einzel);
}
function icsEreignisse(text) {
  const zeilen = [];
  for (const roh of text.replace(/\r\n?/g, "\n").split("\n")) { if ((roh[0] === " " || roh[0] === "\t") && zeilen.length) zeilen[zeilen.length - 1] += roh.slice(1); else zeilen.push(roh); }
  const res = [], evs = []; let ev = null;
  for (const z of zeilen) {
    const k = z.trim().toUpperCase();
    if (k === "BEGIN:VEVENT") ev = { exdate: [] };
    else if (k === "END:VEVENT" && ev) { evs.push(ev); ev = null; }
    else if (ev && z.includes(":")) { const i = z.indexOf(":"), schl = z.slice(0, i), wert = z.slice(i + 1), basis = schl.split(";")[0].toUpperCase(); if (basis === "EXDATE") ev.exdate.push([schl, wert]); else if (!(basis in ev)) ev[basis] = [schl, wert]; }
    if (evs.length >= 3000) break;
  }
  /* geänderte Vorkommen einer Serie: das Original der Serie auslassen, das geänderte als Einzeltermin übernehmen */
  const geaendert = new Map();
  for (const e of evs) if (e["RECURRENCE-ID"] && e.UID) { const l = geaendert.get(e.UID[1]) || []; l.push(e["RECURRENCE-ID"][1]); geaendert.set(e.UID[1], l); }
  for (const e of evs) {
    if (e.RRULE && e.UID && geaendert.has(e.UID[1])) for (const w of geaendert.get(e.UID[1])) e.exdate.push(["EXDATE", w]);
    res.push(...icsUmwandeln(e));
    if (res.length >= 2000) break;
  }
  return res.slice(0, 2000);
}
function icsImportieren(ereignisse, alsStundenplan) {
  let neu = 0, uebersprungen = 0;
  const bestand = new Set(daten.aufgaben.map(a => [a.name, a.datum, a.uhrzeit || "", a.wiederholung || "keine"].join("|")));
  for (const e of ereignisse) {
    const schl = [e.name, e.datum, e.uhrzeit, e.wiederholung].join("|"); if (bestand.has(schl)) { uebersprungen++; continue; } bestand.add(schl);
    let fach = ""; if (alsStundenplan && e.wiederholung !== "keine" && e.uhrzeit) { fach = e.name; if (!(fach in daten.faecher)) daten.faecher[fach] = { ziel: 0 }; }
    const ausnahmen = {}; if (e.wiederholung !== "keine") for (const tg of e.ausnahmen) { try { if (istRegulaererStart({ datum: e.datum, wiederholung: e.wiederholung, wiederholen_bis: e.bis }, parseISO(tg))) ausnahmen[tg] = { geloescht: true }; } catch (x) { } }
    daten.aufgaben.push({ name: e.name, typ: "termin", dauer: e.dauer, prio: 2, kategorie: einst.kategorien.includes("Uni") ? "Uni" : einst.kategorien[0], fach, raum: e.ort, dozent: "", vorlauf: 0, notiz: e.notiz, checkliste: [], datum: e.datum, uhrzeit: e.uhrzeit, enddatum: e.enddatum, wiederholung: e.wiederholung, wiederholen_bis: e.bis, erledigt: false, erledigt_tage: [], farbe: "", ausnahmen });
    neu++;
  }
  return [neu, uebersprungen];
}
function icsVorschau(text) {
  const ereignisse = icsEreignisse(text);
  if (!ereignisse.length) return toast("In dieser Datei wurden keine Termine gefunden.");
  const serien = ereignisse.filter(e => e.wiederholung !== "keine").length;
  const bestand = new Set(daten.aufgaben.map(a => [a.name, a.datum, a.uhrzeit || "", a.wiederholung || "keine"].join("|"))), doppelt = ereignisse.filter(e => bestand.has([e.name, e.datum, e.uhrzeit, e.wiederholung].join("|"))).length;
  const sp = h("input", { type: "checkbox", checked: true });
  dialog("Kalender importieren", [h("b", { style: "font-size:16px" }, R(`${ereignisse.length} ${t("Termine gefunden")}`)),
    h("p", { style: "margin:0;white-space:pre-line" }, R(`${serien} ${t("davon wiederholen sich (z. B. jede Woche).")}${doppelt ? `\n${doppelt} ${t("gibt es schon bei dir und werden übersprungen.")}` : ""}\n${t("Beispiele")}: ${ereignisse.slice(0, 3).map(e => e.name).join(", ")}${ereignisse.length > 3 ? " …" : ""}`)),
    h("label", { class: "row", style: "cursor:pointer" }, sp, "Wiederkehrende Veranstaltungen als Fächer im Stundenplan anlegen")],
    [{ text: "Abbrechen" }, { text: "Importieren", art: "pri", fn: () => { let r; aendern(() => { r = icsImportieren(ereignisse, sp.checked); }); toast(`${r[0]} Termine hinzugefügt${r[1] ? `, ${r[1]} übersprungen` : ""}. Mit „Rückgängig“ nimmst du den Import zurück.`, true); } }]);
}
function icsDateiWaehlen() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".ics,text/calendar";
  inp.onchange = async () => { if (inp.files[0]) icsVorschau(await inp.files[0].text()); }; inp.click();
}
function icsAdresseDialog() {
  const url = h("input", { type: "url", placeholder: "https://… oder webcal://…" });
  dialog("Kalender aus dem Internet importieren", [feld("Adresse des Kalenders (.ics)", url), h("p", { class: "mut small", style: "margin:0" }, "Manche Anbieter erlauben den Abruf aus dem Browser nicht. Dann lade die Datei herunter und importiere sie als Datei.")],
    [{ text: "Abbrechen" }, { text: "Laden", art: "pri", fn: async () => {
      const u = url.value.trim().replace(/^webcal:\/\//i, "https://"); if (!/^https?:\/\//i.test(u)) { toast("Bitte eine Internetadresse eingeben (https:// oder webcal://)."); return false; }
      try { const r = await fetch(u); if (!r.ok) throw new Error("HTTP " + r.status); icsVorschau(await r.text()); } catch (e) { toast("Der Kalender konnte nicht geladen werden. Lade die Datei herunter und importiere sie als Datei."); }
    } }]);
}
function importSektion() {
  return sektion("Kalender importieren", h("p", { class: "mut small", style: "margin:0" }, "Importiere zum Beispiel den Stundenplan deiner Uni als .ics-Datei. Wiederholungen und ausfallende Termine werden erkannt."),
    h("div", { class: "row" }, h("button", { class: "btn", onclick: icsDateiWaehlen }, "Kalender importieren (.ics) …"), h("button", { class: "btn", onclick: icsAdresseDialog }, "Aus Internetadresse importieren …"), h("button", { class: "btn", onclick: willkommenDialog }, "Willkommens-Assistent …")));
}

/* ---------- Willkommens-Assistent ---------- */
function beispieleAnlegen() {
  const morgen = addDays(heute(), 1), fach = Object.keys(daten.faecher).sort((a, b) => a.localeCompare(b))[0] || "", kat = k => einst.kategorien.includes(k) ? k : einst.kategorien[0];
  const eintrag = (name, tag, uhr, dauer, typ, k, f = "") => ({ name, typ, dauer, prio: 2, kategorie: kat(k), fach: f, raum: "", dozent: "", vorlauf: 0, notiz: "Beispiel zum Ausprobieren - einfach löschen.", checkliste: [], datum: iso(tag), uhrzeit: uhr, enddatum: "", wiederholung: "keine", wiederholen_bis: "", erledigt: false, erledigt_tage: [], farbe: "", ausnahmen: {} });
  daten.aufgaben.push(eintrag("Beispiel: Vorlesung", morgen, "10:00", 90, "termin", "Uni"), eintrag("Beispiel: Lernen", heute(), "", 60, "aufgabe", "Uni", fach), eintrag("Beispiel: Training", morgen, "18:00", 60, "termin", "Sport"));
}
function willkommenDialog() {
  const w = { design: einst.design, sprache: einst.sprache, faecher: "", reiter: {}, benach: true, ort: "", beispiele: true };
  for (const [k] of REITER) if (!FIX.has(k)) w.reiter[k] = !["statistik", "suche"].includes(k);
  let seite = 0, zu = () => { }; const SEITEN = 5, body = h("div", { class: "wiz" });
  const fertig = uebernehmen => {
    zu();
    if (!uebernehmen) { einst.willkommen_gezeigt = true; speichern(); return; }   // Überspringen ist keine Änderung zum Rückgängigmachen
    aendern(() => {
      einst.willkommen_gezeigt = true;
      if (!uebernehmen) return;
      einst.design = w.design; if (w.sprache !== einst.sprache) { einst.sprache = w.sprache; spracheSetzen(w.sprache); }
      for (const zeile of w.faecher.split("\n")) { const m = zeile.match(/^\s*(.*?)(?:\s+(\d+(?:[.,]\d+)?))?\s*(?:h|std\.?)?\s*$/i), name = m ? m[1].trim() : ""; if (name && !(name in daten.faecher)) daten.faecher[name] = { ziel: Math.min(parseFloat((m[2] || "0").replace(",", ".")) || 0, 100) }; }
      einst.reiter_aus = einst.reiter_aus.filter(k => !(k in w.reiter)).concat(Object.entries(w.reiter).filter(([, v]) => !v).map(([k]) => k));
      const ort = w.ort.trim(); if (ort.length >= 2) { einst.wetter_an = true; einst.wetter_ort = ort; }
      if (w.beispiele) beispieleAnlegen();
    });
    if (uebernehmen && w.benach && "Notification" in window && Notification.permission === "default") Notification.requestPermission().then(p => { if (p === "granted") setzen("benachrichtigung", true, true); }).catch(() => { });
    wetterAktualisieren(true);
  };
  const seitenInhalt = () => {
    if (seite === 0) {
      const d = auswahl(DESIGN_AUSWAHL, w.design);
      d.onchange = () => { w.design = d.value; einst.design = d.value; speichern(); themaAnwenden(); };
      /* Sprache sofort umschalten: Assistent und App dahinter werden gleich in der neuen Sprache gezeigt */
      const sp = auswahl(Object.entries(SPRACHEN), w.sprache, true); sp.onchange = () => { w.sprache = sp.value; einst.sprache = sp.value; spracheSetzen(sp.value); speichern(); render(); zeigen(); };
      return [h("h2", null, "Hey, schön, dass du da bist!"), h("p", { class: "mut", style: "margin:0" }, "OSA ist dein Planer für Uni und Alltag: Termine, Aufgaben, Lernziele, Noten und Essen an einem Ort. In fünf kurzen Schritten richten wir alles ein."), feld("Wie soll es aussehen?", d), feld("Sprache / Language", sp)];
    }
    if (seite === 1) { const ta = h("textarea", { placeholder: "Mathe 4\nPhysik 3\nProgrammieren" }); ta.value = w.faecher; ta.oninput = () => { w.faecher = ta.value; }; return [h("h2", null, "Deine Fächer"), h("p", { class: "mut", style: "margin:0" }, "Welche Fächer hast du? Schreib pro Zeile ein Fach, wenn du magst mit einem Wochenziel in Stunden dahinter, zum Beispiel „Mathe 4“. Das kannst du später unter „Lernziele“ ändern."), ta]; }
    if (seite === 2) {
      const namen = Object.fromEntries(REITER.map(([k, l]) => [k, l])), hilfe = { stundenplan: "deine Vorlesungen und Kurse", faecher: "Wochenziele je Fach, Fokus-Timer", noten: "Noten und ECTS-Punkte", fristen: "Aufgaben mit Frist und Checkliste", geld: "Budget, Einnahmen und Ausgaben", essen: "Einkaufsliste, Rezepte und Kalorien", statistik: "Auswertungen deiner Woche", suche: "alles durchsuchen (Strg + K geht immer)" };
      return [h("h2", null, "Welche Reiter brauchst du?"), h("p", { class: "mut", style: "margin:0" }, "Weniger Reiter sind übersichtlicher. Die wichtigsten (Heute, Kalender) sind immer da. Den Rest kannst du jederzeit in den Einstellungen ein- oder ausblenden."),
        h("p", { class: "mut", style: "margin:0" }, "Tipp: Die Reihenfolge änderst du jederzeit: Alt gedrückt halten und einen Reiter mit der linken Maustaste an eine andere Stelle ziehen (am Handy in den Einstellungen unter „Menü und Reiter“ lange gedrückt halten)."),
        ...Object.keys(w.reiter).map(k => { const c = h("input", { type: "checkbox", checked: w.reiter[k], onchange: () => { w.reiter[k] = c.checked; } }); return h("label", { class: "row", style: "cursor:pointer" }, c, h("b", { style: "width:140px" }, namen[k]), h("span", { class: "mut" }, hilfe[k] || "")); })];
    }
    if (seite === 3) {
      const b = h("input", { type: "checkbox", checked: w.benach, onchange: () => { w.benach = b.checked; } }), bs = h("input", { type: "checkbox", checked: w.beispiele, onchange: () => { w.beispiele = bs.checked; } }), ort = h("input", { type: "text", value: w.ort, placeholder: "z. B. Berlin" }); ort.oninput = () => { w.ort = ort.value; };
      return [h("h2", null, "Erinnerungen und Extras"), h("p", { class: "mut", style: "margin:0" }, "Alles hier ist optional und lässt sich später in den Einstellungen ändern."), h("label", { class: "row", style: "cursor:pointer" }, b, "Erinnerungen als Meldung des Geräts erlauben"),
        h("label", { class: "row", style: "cursor:pointer" }, bs, "Ein paar Beispiel-Einträge anlegen, damit du siehst, wie alles aussieht"), feld("Ort für das Wetter in der Wochenansicht (optional)", ort), h("p", { class: "mut small", style: "margin:0" }, "Der Ortsname wird dafür an den Wetterdienst Open-Meteo geschickt."),
        h("div", { class: "row" }, h("button", { class: "btn", onclick: icsDateiWaehlen }, "Uni-Stundenplan importieren (.ics) …"))];
    }
    return [h("h2", null, "Fertig! So findest du dich zurecht"), ...[["Heute", "dein Tag auf einen Blick; oben tippst du schnell etwas ein (Alt + N)"], ["Woche, Monat, Jahr", "dein Kalender; im Wochenraster Termine ziehen und verschieben"], ["Aufgaben", "Aufgaben mit Frist und als einfache Checkliste"], ["+ Neu", "neuen Termin, neue Aufgabe oder Essen anlegen (oben rechts, am Handy unten in der Mitte)"], ["Stundenplan", "deine Vorlesungen und Kurse"], ["Lernziele", "Wochenziele je Fach und der Fokus-Timer"], ["Noten", "Noten, Notenschnitt und ECTS-Punkte"], ["Einkauf & Geld", "Einkaufsliste, Budget und Einkauf abschließen"], ["Einstellungen", "Aussehen, Erinnerungen, Import und mehr"], ["Anderes Gerät", "Einstellungen › Daten und Export › Auf anderes Gerät übertragen: deine Einträge per QR-Code vom PC aufs Handy (oder umgekehrt), ganz ohne Internet"]]
      .map(([a, b]) => h("div", { class: "row", style: "gap:14px;margin:2px 0" }, h("b", { style: "width:170px;color:var(--acc);flex:none" }, a), h("span", null, b)))];
  };
  const zeigen = () => {
    const zurueck = h("button", { class: "btn", disabled: !seite, onclick: () => { seite--; zeigen(); } }, "Zurück"), weiter = h("button", { class: "btn pri", onclick: () => { if (seite === SEITEN - 1) fertig(true); else { seite++; zeigen(); } } }, seite === SEITEN - 1 ? "Los geht's!" : "Weiter");
    body.replaceChildren(...seitenInhalt(), h("div", { class: "fuss" }, h("span", { class: "mut small" }, R(`${t("Schritt")} ${seite + 1} ${t("von")} ${SEITEN}`)), h("div", { class: "sp" }), h("button", { class: "btn ghost", onclick: () => fertig(false) }, "Überspringen"), zurueck, weiter));
  };
  zeigen();
  zu = dialog(null, body, [], { breit: true, keinFokus: true });
}

let renderFehler = 0, letzterSchluessel = null, letzterUnter = null;
function render() {
  const y = window.scrollY, app = $("#app"), fokus = document.activeElement, altPillen = pillenMerken();
  reiterReihenfolgeAnwenden(); themaAnwenden(); document.documentElement.lang = einst.sprache;
  try {
    if (einst.reiter_seite) app.replaceChildren(kopf(), h("div", { class: "wrap side" }, navKnoepfe(h("nav", { class: "sidenav" })), h("main", { class: "mainc" }, tabInhalt())), handyLeiste());
    else app.replaceChildren(kopf(), h("main", { class: "wrap" }, tabInhalt()), handyLeiste());
    renderFehler = 0;
  } catch (e) {
    console.error(e);
    if (++renderFehler < 2) { ui.tab = "kalender"; app.replaceChildren(h("main", { class: "wrap" }, h("div", { class: "card" }, h("h3", null, "Etwas ist schiefgelaufen"), h("pre", { style: "white-space:pre-wrap" }, R(String(e && e.stack || e))), h("button", { class: "btn", onclick: render }, "Neu laden")))); }
  }
  const unter = ui.tab === "kalender" ? ui.ansicht : ui.tab === "essen" ? ui.essen : "";
  const hauptWechsel = letzterSchluessel !== null && ui.tab !== letzterSchluessel;
  const unterWechsel = !hauptWechsel && letzterSchluessel !== null && unter !== letzterUnter;
  letzterSchluessel = ui.tab; letzterUnter = unter;
  const wurzel = document.querySelector("main > div"), seite = wurzel && wurzel.firstElementChild, sub = seite && seite.querySelector(":scope > .sub");
  if (sub) { const w = h("div", { class: "subinh" }); [...seite.children].filter(c => c !== sub && !c.classList.contains("subinh")).forEach(c => w.append(c)); sub.after(w); }
  pillenZeichnen(altPillen);
  if (animiert()) {
    if (hauptWechsel) aufdecken(wurzel);
    else if (unterWechsel) aufdecken((seite && seite.querySelector(":scope > .subinh")) || document.querySelector(".wk,.mo,.jahr"));
    else if (ui._gleiten) { const z = document.querySelector(".wk,.mo,.jahr"); if (z) { ui._animBis = performance.now() + 920; if (!z.parentElement.classList.contains("gleitrahmen")) { const rahmen = h("div", { class: "gleitrahmen" }); z.replaceWith(rahmen); rahmen.append(z); } z.animate([{ transform: `translateX(${Math.sign(ui._gleiten) * 40}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 900, easing: "cubic-bezier(.25,.1,.15,1)" }); } }
  }
  ui._gleiten = 0;
  window.scrollTo(0, y);
  timerAnzeigen();
}

/* Systembenachrichtigungen (nur solange die App geöffnet oder im Hintergrund aktiv ist) */
function benachrichtigungSchalter() {
  if (!("Notification" in window)) return h("p", { class: "mut small", style: "margin:0" }, "Systembenachrichtigungen werden von diesem Browser nicht unterstützt.");
  const c = h("input", { type: "checkbox", checked: !!einst.benachrichtigung && Notification.permission === "granted" });
  c.onchange = async () => {
    if (c.checked) {
      let p = Notification.permission;
      if (p === "default") { try { p = await Notification.requestPermission(); } catch (e) { p = "denied"; } }
      if (p !== "granted") { c.checked = false; setzen("benachrichtigung", false, true); return toast("Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser-Einstellungen."); }
      setzen("benachrichtigung", true, true);
    } else setzen("benachrichtigung", false, true);
  };
  const test = h("button", { class: "btn sm", onclick: () => { toast(t("Test: So sieht eine Erinnerung aus."), true); systemMeldung(t("Test: So sieht eine Erinnerung aus.")); } }, "Testen");
  return h("div", { style: "display:flex;flex-direction:column;gap:4px" }, h("div", { class: "row" }, h("label", { class: "row", style: "cursor:pointer" }, c, "Systembenachrichtigungen"), test),
    h("p", { class: "mut small", style: "margin:0 0 0 26px" }, "Erinnerungen erscheinen auch als Meldung des Geräts, solange die App geöffnet oder im Hintergrund aktiv ist. Eine geschlossene App kann nicht erinnern."));
}
function systemMeldung(text) {
  if (!einst.benachrichtigung || !("Notification" in window) || Notification.permission !== "granted") return;
  const direkt = () => { try { new Notification("OSA", { body: text, icon: "icon-192.png" }); } catch (e) { } };
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(r => r ? r.showNotification("OSA", { body: text, icon: "icon-192.png", tag: text }) : direkt()).catch(direkt);
    else direkt();
  } catch (e) { direkt(); }
}

/* Erinnerungen */
function erinnerungenPruefen() {
  try {
    const jetzt = new Date();
    for (const [schl, text] of faelligeErinnerungen(daten, einst, jetzt, gemeldet)) { gemeldet.add(schl); toast(text, true); systemMeldung(text); }
    for (const [schl, text] of fristErinnerungen(daten, einst, heute(), gemeldet)) { gemeldet.add(schl); toast(text, true); systemMeldung(text); }
    const ek = einkaufErinnerungFaellig(jetzt); if (ek) { gemeldet.add("einkauf|" + iso(jetzt)); toast("Einkaufsliste: " + ek, true); systemMeldung("Einkaufsliste: " + ek); }
  } catch (e) { console.error(e); }
}

laden();
sicherungTaeglich();
speicherSchuetzen(false).then(() => { if (ui.tab === "einstellungen") render(); });
render();
ferienAktualisieren();
wetterAktualisieren();
if (!einst.willkommen_gezeigt) {
  if (!daten.aufgaben.length && !daten.essen.length && !Object.keys(daten.faecher).length && !daten.noten.length) { einst.zuletzt_version = APP_VERSION; setTimeout(willkommenDialog, 500); }   // neue Nutzer: kein „Was ist neu“
  else { einst.willkommen_gezeigt = true; speichern(); }
}
/* Teilen an OSA (Android, installierte App): der geteilte Text kommt als ?title=…&text=…&url=… an */
const _geteilt = (() => {
  try {
    const p = new URLSearchParams(location.search), teile = ["title", "text", "url"].map(k => (p.get(k) || "").trim()).filter(Boolean);
    if (!teile.length) return "";
    history.replaceState(null, "", location.pathname);   // Adresse aufräumen, damit es beim Neuladen nicht noch einmal kommt
    return [...new Set(teile)].join("\n");
  } catch (e) { return ""; }
})();
if (_geteilt) setTimeout(() => geteiltDialog(_geteilt), 700);
/* „Was ist neu“ einmal nach einem Update zeigen (nicht beim allerersten Start, nicht wenn gerade etwas geteilt wurde) */
if (!_geteilt && einst.willkommen_gezeigt && einst.zuletzt_version !== APP_VERSION) {
  const seit = einst.zuletzt_version; einst.zuletzt_version = APP_VERSION; speichern();
  setTimeout(() => { if (!document.querySelector(".ov")) wasIstNeuDialog(seit); }, 900);
}
setInterval(() => { if (ui.tab === "heute" && !document.querySelector(".ov") && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "")) render(); }, 60000);
tastenkuerzelBinden();
setTimeout(erinnerungenPruefen, 1500);
setInterval(erinnerungenPruefen, 30000);
if (!speicher._ok) toast("Hinweis: Der Browser blockiert hier das Speichern – bitte Sicherungen anlegen.");
/* Wischen: links/rechts wechselt Woche, Monat, Jahr */
(function () {
  let sx = 0, sy = 0, st = 0, ziel = null;
  document.addEventListener("touchstart", e => { if (e.touches.length !== 1) { ziel = null; return; } const t0 = e.touches[0]; sx = t0.clientX; sy = t0.clientY; st = Date.now(); ziel = e.target; }, { passive: true });
  document.addEventListener("touchend", e => {
    if (!ziel || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy, z = ziel; ziel = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - st > 700) return;
    if (document.querySelector(".ov") || z.closest("input,textarea,select,.pop")) return;
    const sc = z.closest(".wk-scroll");
    if (sc && !z.closest(".wk-head,.wk-allday") && sc.scrollWidth > sc.clientWidth + 2) {                         // erst am Rand der Tabelle wechseln
      if (dx < 0 && sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 2) return;
      if (dx > 0 && sc.scrollLeft > 2) return;
    }
    const r = dx < 0 ? 1 : -1;
    if (ui.tab === "kalender") schieben(r);
    else if (ui.tab === "stundenplan") { ui.spPlan = addDays(ui.spPlan, 7 * r); render(); }
    else if (ui.tab === "geld") { ui.budgetMonat = addMonate(ui.budgetMonat, r); render(); }
  }, { passive: true });
})();
window.addEventListener("storage", e => { if (e.key === SPEICHER) { laden(); render(); } });
/* Als Handy-App installierbar und offline nutzbar – nur wenn die Seite aus dem Internet (http/https) kommt, nicht als lokale Datei */
if (/^https?:$/.test(location.protocol)) {
  const mf = document.createElement("link"); mf.rel = "manifest"; mf.href = "manifest.webmanifest"; document.head.append(mf);
  if ("serviceWorker" in navigator) {
    /* Update-Hinweis: Der Offline-Speicher (sw.js) bekommt bei jedem Upload eine neue Version. Übernimmt die neue
       Version die Seite, während OSA offen ist, erscheint „Neue Version verfügbar“. Beim allerersten Start nicht. */
    const hatteVersion = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (hatteVersion) updateHinweis(); });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {   // sw.js nie aus dem Zwischenspeicher: Updates kommen sofort an
      const pruefen = () => reg.update().catch(() => { });
      setInterval(pruefen, 30 * 60000);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pruefen(); });
    }).catch(() => { });
  }
}
/* Dialog für geteilten Text: Titel, Datum und Uhrzeit wie bei der Schnell-Eingabe erkennen, ganzer Text kommt in die Notiz */
function geteiltDialog(text) {
  /* Jede Zeile prüfen und die nehmen, in der Datum und/oder Uhrzeit stecken (sonst die erste Zeile) */
  const zeilen = text.split("\n").map(z => z.trim()).filter(Boolean), jetzt = new Date();
  let ersteZeile = zeilen[0] || text, e = null, beste = -1;
  for (const z of zeilen.slice(0, 12)) {
    const p = schnellParsen(z.slice(0, 200), jetzt, einst.kategorien); if (!p || p.fehler || !p.name) continue;
    const punkte = (p.datum ? 2 : 0) + (p.uhrzeit ? 2 : 0);
    if (punkte > beste) { beste = punkte; e = p; ersteZeile = z; }
  }
  const gut = e && !e.fehler && e.name;
  const vorgabe = { name: gut ? e.name : ersteZeile.slice(0, 80), notiz: text, datum: (gut && e.datum) || "", uhrzeit: (gut && e.uhrzeit) || "" };
  if (gut && e.dauer) vorgabe.dauer = e.dauer;
  let zu = () => { };
  const oeffnen = art => { zu(); eintragDialog({ art, tag: vorgabe.datum ? parseISO(vorgabe.datum) : heute(), vorgabe }); };
  zu = dialog("An OSA geteilt", [
    h("p", { class: "mut small", style: "margin:0" }, "Mach daraus einen Eintrag. Titel, Datum und Uhrzeit werden – wenn möglich – erkannt, der ganze Text landet in der Notiz."),
    h("div", { class: "geteilt-text" }, R(text)),
    gut ? h("p", { class: "small", style: "margin:0" }, R(`${t("Erkannt")}: ${schnellVorschau(Object.assign({}, e, { datum: e.datum || iso(heute()) }))}`)) : null,
    h("div", { class: "mehr-gitter" }, h("button", { class: "btn" + (gut && e.uhrzeit ? " pri" : ""), onclick: () => oeffnen("termin") }, "Als Termin"), h("button", { class: "btn" + (gut && e.uhrzeit ? "" : " pri"), onclick: () => oeffnen("aufgabe") }, "Als Aufgabe / Frist"))],
    [{ text: "Abbrechen" }]);
}
function wasIstNeuDialog(seit) {
  const liste = NEUIGKEITEN.filter(n => !seit || n.version > seit);
  const zeigen = liste.length ? liste : NEUIGKEITEN.slice(0, 1);
  dialog("Was ist neu", zeigen.map(n => [h("p", { class: "mut small", style: "margin:0" }, R(`${t("Version")} ${n.version}`)), h("ul", { class: "neu-liste" }, n.punkte.map(p => h("li", null, p)))]).flat(), [{ text: "Alles klar", art: "pri" }]);
}
function updateHinweis() {
  if (document.querySelector(".update-hinweis")) return;
  const leiste = h("div", { class: "update-hinweis", role: "status" },
    h("span", null, "Eine neue Version von OSA ist da."),
    h("button", { class: "btn sm pri", onclick: () => location.reload() }, "Neu laden"),
    h("button", { class: "btn sm ghost", "aria-label": "Später", onclick: () => leiste.remove() }, "Später"));
  document.body.append(leiste);
}
/* Die Bitte um dauerhaften Speicher steht in speicherSchuetzen() (ui-einstellungen.js) und wird beim Start aufgerufen. */

