/* OSA – Oberfläche Teil 4: Einstellungen, Programmfarben, Daten, QR-Übertragung */
"use strict";
/* ============================================================
   Oberfläche, Teil 4: Einstellungen, Daten, Kopfzeile, Start
   ============================================================ */
const REITER = [["heute", "Heute"], ["kalender", "Kalender"], ["fristen", "Aufgaben"], ["plus", "+"], ["stundenplan", "Stundenplan"], ["faecher", "Lernziele"], ["noten", "Noten"], ["geld", "Geld"], ["essen", "Essen/Einkauf"], ["statistik", "Statistik"], ["suche", "Suche"], ["einstellungen", "Einstellungen"]];
const FIX = new Set(["heute", "kalender", "plus", "einstellungen"]);
const REITER_STANDARD = REITER.map(r => r[0]);   // Ausgangsreihenfolge (gilt, solange keine eigene gespeichert ist)
function reiterReihenfolgeAnwenden() {
  const gespeichert = Array.isArray(einst.reiter_reihenfolge) ? einst.reiter_reihenfolge : [];
  const rang = k => { const i = gespeichert.indexOf(k); return i >= 0 ? i : (k === "essen" && gespeichert.includes("geld") ? gespeichert.indexOf("geld") + 0.5 : 1000 + REITER_STANDARD.indexOf(k)); };   // neue, unbekannte Reiter hinten in Standardreihenfolge
  REITER.sort((a, b) => rang(a[0]) - rang(b[0]));
}
/* teilKeys: neue Reihenfolge einiger Reiter (z. B. nur der sichtbaren); alle anderen behalten ihren Platz */
function reiterNeuOrdnen(teilKeys) {
  const jetzt = REITER.map(r => r[0]), menge = new Set(teilKeys); let i = 0;
  const neu = jetzt.map(k => menge.has(k) ? teilKeys[i++] : k);
  aendern(() => { einst.reiter_reihenfolge = neu; reiterReihenfolgeAnwenden(); });
}
document.addEventListener("keydown", e => { if (e.key === "Alt") document.documentElement.classList.add("alt-an"); });
document.addEventListener("keyup", e => { if (e.key === "Alt") document.documentElement.classList.remove("alt-an"); });
window.addEventListener("blur", () => document.documentElement.classList.remove("alt-an"));
/* Reiter per Ziehen umsortieren: Maus/Stift bei gedrückter Alt-Taste, Finger nach langem Druck; Tastatur: Alt + Umschalt + Pfeil */
function reiterZiehbar(behaelter, auswahl) {
  const eintraege = () => [...behaelter.children].filter(x => x.dataset && x.dataset.reiter);
  behaelter.addEventListener("keydown", ev => {
    if (!ev.altKey || !ev.shiftKey || !/^Arrow(Left|Right|Up|Down)$/.test(ev.key)) return;
    const el = ev.target.closest("[data-reiter]"); if (!el || !behaelter.contains(el)) return;
    ev.preventDefault();
    const liste = eintraege(), i = liste.indexOf(el), j = i + (/Left|Up/.test(ev.key) ? -1 : 1);
    if (j < 0 || j >= liste.length) return;
    liste.splice(i, 1); liste.splice(j, 0, el);
    const k = el.dataset.reiter; reiterNeuOrdnen(liste.map(x => x.dataset.reiter));
    setTimeout(() => { const n = document.querySelector(`${auswahl} [data-reiter="${k}"]`); if (n) n.focus(); }, 0);
  });
  behaelter.addEventListener("pointerdown", ev => {
    const el = ev.target.closest("[data-reiter]"); if (!el || ev.button !== 0 || !behaelter.contains(el)) return;
    if (ev.pointerType !== "touch" && !ev.altKey) return;   // mit Maus oder Stift nur bei gedrückter Alt-Taste, sonst ist es ein normaler Klick
    const finger = ev.pointerType === "touch", x0 = ev.clientX, y0 = ev.clientY; let ziehen = false, geist = null, timer = 0;
    const sperre = e => e.preventDefault();
    const senkrecht = () => { const l = eintraege(); if (l.length < 2) return false; const a = l[0].getBoundingClientRect(), b = l[1].getBoundingClientRect(); return b.top > a.bottom - 4; };
    const starten = () => {
      ziehen = true; unterdrueckeKlick = true; el.classList.add("zieht"); document.body.classList.add("reiter-zieht");
      const r = el.getBoundingClientRect(); geist = el.cloneNode(true); geist.classList.add("reiter-geist"); geist.removeAttribute("data-reiter");
      geist.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;pointer-events:none;z-index:70`;
      geist._dx = x0 - r.left; geist._dy = y0 - r.top; document.body.append(geist);
      document.addEventListener("touchmove", sperre, { passive: false });
    };
    const bew = e2 => {
      if (!ziehen) {
        const d = Math.hypot(e2.clientX - x0, e2.clientY - y0);
        if (finger) { if (d > 8) ende(true); return; }   // Finger wandert vor dem langen Druck: normales Scrollen
        if (d < 6) return; starten();
      }
      geist.style.left = e2.clientX - geist._dx + "px"; geist.style.top = e2.clientY - geist._dy + "px";
      const sk = senkrecht(), pos = sk ? e2.clientY : e2.clientX; let vorher = null;
      for (const x of eintraege().filter(x => x !== el)) { const r = x.getBoundingClientRect(), mitte = sk ? r.top + r.height / 2 : r.left + r.width / 2; if (pos < mitte) { vorher = x; break; } }
      if (vorher !== el.nextElementSibling) behaelter.insertBefore(el, vorher);
    };
    const hoch = () => ende(false), abbruch = () => ende(true);
    const ende = abgebrochen => {
      clearTimeout(timer);
      document.removeEventListener("pointermove", bew); document.removeEventListener("pointerup", hoch); document.removeEventListener("pointercancel", abbruch); document.removeEventListener("touchmove", sperre);
      if (!ziehen) return;
      ziehen = false; if (geist) geist.remove(); el.classList.remove("zieht"); document.body.classList.remove("reiter-zieht"); setTimeout(() => { unterdrueckeKlick = false; }, 80);
      if (abgebrochen) render(); else reiterNeuOrdnen(eintraege().map(x => x.dataset.reiter));
    };
    document.addEventListener("pointermove", bew); document.addEventListener("pointerup", hoch); document.addEventListener("pointercancel", abbruch);
    if (finger) timer = setTimeout(starten, 420);
  });
}

function sektion(titel, ...inh) { return h("div", { class: "card" }, h("h3", null, titel), h("div", { style: "display:flex;flex-direction:column;gap:12px" }, inh)); }
function setzen(key, wert, neu = false) { ui.gespeichert = new Date(); aendern(() => { einst[key] = wert; }, !neu); if (neu) return; }
function zahlFeld(label, key, min, max, schritt = 1) {
  const i = h("input", { type: "number", min, max, step: schritt, value: einst[key] });
  i.onchange = () => { const w = Math.min(Math.max(parseFloat(i.value) || 0, min), max); setzen(key, w, true); };
  return feld(label, i);
}
function schalter(label, key, onNeu = true) {
  const c = h("input", { type: "checkbox", checked: !!einst[key], onchange: () => { setzen(key, c.checked, onNeu); } });
  return h("label", { class: "row", style: "cursor:pointer" }, c, label);
}

function einstellungenTab() {
  /* Sprache */
  const sp = auswahl(Object.entries(SPRACHEN), einst.sprache, true);
  sp.onchange = () => { einst.sprache = sp.value; spracheSetzen(sp.value); aendern(() => { }); };
  const design = auswahl(DESIGN_AUSWAHL, einst.design);
  design.onchange = () => setzen("design", design.value, true);
  const stufe = auswahl([["Klein", "Klein"], ["Normal", "Normal"], ["Groß", "Groß"], ["Sehr groß", "Sehr groß"]], einst.schrift_stufe);
  stufe.onchange = () => setzen("schrift_stufe", stufe.value, true);
  /* Reiter */
  const reiter = h("div", { class: "tog reiter-liste" }, REITER.filter(r => !FIX.has(r[0])).map(([k, l]) => h("button", { class: einst.reiter_aus.includes(k) ? "" : "on", "data-reiter": k, onclick: () => unterdrueckeKlick ? null : aendern(() => { const i = einst.reiter_aus.indexOf(k); if (i >= 0) einst.reiter_aus.splice(i, 1); else einst.reiter_aus.push(k); }) }, l)));
  reiterZiehbar(reiter, '.reiter-liste');
  /* Kategorien */
  const kat = h("div", { class: "list" });
  einst.kategorien.forEach((k, i) => {
    kat.append(h("div", { class: "li" }, h("span", { class: "dot", style: `background:${einst.farben[k] || "var(--surf2)"}` }), h("div", { class: "tx" }, R(k)),
      h("div", { style: "max-width:230px" }, farbwahl(einst.farben[k] || "", c => aendern(() => { einst.farben[k] = c; }))),
      h("button", { class: "btn sm bad", disabled: einst.kategorien.length < 2, onclick: () => bestaetigen("Kategorie entfernen? Bestehende Einträge behalten ihren Namen.", () => aendern(() => { einst.kategorien.splice(i, 1); }), "Entfernen") }, "Entfernen")));
  });
  const neuKat = h("input", { type: "text", placeholder: "Neue Kategorie", style: "flex:1" });
  const katAdd = () => { const n = neuKat.value.trim(); if (!n || einst.kategorien.includes(n)) return; aendern(() => { einst.kategorien.push(n); einst.farben[n] = "#e2e4e8"; }); };
  neuKat.onkeydown = e => { if (e.key === "Enter") katAdd(); };
  const essenFarbe = farbwahl(einst.farben.Essen || "", c => aendern(() => { einst.farben.Essen = c; }));
  /* Ferien */
  const fArt = auswahl(Object.entries(FERIEN_ARTEN), einst.ferien_art);
  fArt.onchange = () => { aendern(() => { einst.ferien_art = fArt.value; }); ferienAktualisieren(true); };
  let anzeigeNamen = null; try { anzeigeNamen = new Intl.DisplayNames([sprache], { type: "region" }); } catch (e) { }
  const fLand = auswahl(Object.entries(FERIEN_LAENDER).map(([k, v]) => [k, (anzeigeNamen && anzeigeNamen.of(k)) || v]), einst.ferien_land, true);
  fLand.onchange = () => { aendern(() => { einst.ferien_land = fLand.value; einst.ferien_region = ""; }); ferienAktualisieren(true); };
  const fReg = auswahl([["", "Ganzes Land"]].concat(Object.entries(FERIEN_REGIONEN_DE)), einst.ferien_region);
  fReg.onchange = () => { aendern(() => { einst.ferien_region = fReg.value; }); ferienAktualisieren(true); };
  const fIcs = h("input", { type: "url", placeholder: "https://… (optional, .ics-Adresse der Hochschule)", value: einst.ferien_ics });
  fIcs.onchange = () => { aendern(() => { einst.ferien_ics = fIcs.value.trim(); }); ferienAktualisieren(true); };
  /* Feiertage */
  const feiLand = auswahl(Object.keys(FEIERTAGE_LAENDER_NAMEN).map(k => [k, (anzeigeNamen && anzeigeNamen.of(k)) || FEIERTAGE_LAENDER_NAMEN[k]]).concat([["aus", t("Keine Feiertage anzeigen")]]), feiertageLand(), true);
  feiLand.onchange = () => aendern(() => { einst.feiertage_land = feiLand.value; if (einst.feiertage_region === "aus") einst.feiertage_region = ""; });
  const feiReg = auswahl([["", "Nur bundesweite Feiertage"]].concat(Object.entries(FERIEN_REGIONEN_DE)), einst.feiertage_region === "aus" ? "" : (einst.feiertage_region || ""));
  feiReg.onchange = () => setzen("feiertage_region", feiReg.value, true);
  const feiertage = sektion("Feiertage im Kalender", h("p", { class: "mut small", style: "margin:0" }, "Gesetzliche Feiertage, ohne Internet berechnet. Für Deutschland kannst du ein Bundesland wählen, dann kommen die Landesfeiertage dazu. Ein- und ausblenden kannst du sie auch im Kalender über „Filter“."),
    feld("Land", feiLand), feiertageLand() === "DE" ? feld("Bundesland", feiReg) : null);
  const ferien = sektion("Ferien im Kalender", h("p", { class: "mut small", style: "margin:0" }, "Schulferien kommen live aus dem Internet (OpenHolidays) und passen sich dem gewählten Land an."),
    feld("Anzeige", fArt), einst.ferien_art !== "aus" ? feld("Land", fLand) : null, einst.ferien_art === "schule" && einst.ferien_land === "DE" ? feld("Bundesland", fReg) : null,
    einst.ferien_art === "akademisch" ? feld("Kalender-Adresse der Hochschule (.ics)", fIcs) : null,
    einst.ferien_art === "akademisch" && !einst.ferien_ics ? h("p", { class: "mut small", style: "margin:0" }, "Ohne Adresse werden Richtwerte für die vorlesungsfreie Zeit angezeigt (Mitte Februar – Mitte April, Mitte Juli – Mitte Oktober).") : null,
    einst.ferien_art !== "aus" ? h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => ferienAktualisieren(true) }, "Jetzt aktualisieren"), ui.ferienStatus ? h("span", { class: "mut small" }, ui.ferienStatus) : null) : null);

  /* Die Einstellungen sind in Kategorien aufgeteilt: Übersicht (Handy) bzw. Liste links (PC), dazu ein Suchfeld */
  const zuruecksetzen = h("div", { class: "row" }, h("button", { class: "btn", onclick: () => bestaetigen("Alle Einstellungen auf die Standardwerte zurücksetzen? Deine Einträge bleiben erhalten.", () => aendern(() => {
    const e = einstellungenLaden({}); e.willkommen_gezeigt = true; einst = e; daten.einstellungen = e; spracheSetzen(e.sprache); ui.gespeichert = new Date(); pfSchema = null; ferienAktualisieren(true); wetterAktualisieren(true);
  }), "Zurücksetzen") }, "Auf Standard zurücksetzen"));
  const KATS = [
    ["reiter", "🧭", "Menü und Reiter", () => [leistenSektion(), sektion("Angezeigte Reiter", reiter,
      h("p", { class: "mut small", style: "margin:0" }, "Tipp: Halte Alt gedrückt und zieh die Reiter mit der linken Maustaste an eine andere Stelle, um die Reihenfolge zu ändern (am Handy: lange gedrückt halten)."),
      (einst.reiter_reihenfolge || []).length ? h("div", { class: "row" }, h("button", { class: "btn sm", onclick: () => aendern(() => { einst.reiter_reihenfolge = []; reiterReihenfolgeAnwenden(); }) }, "Reihenfolge zurücksetzen")) : null)]],
    ["aussehen", "🎨", "Aussehen", () => [sektion("Sprache", feld("Sprache der Oberfläche", sp)),
      sektion("Darstellung", feld("Farbschema", design), schalter("Reiter an der Seite (links) statt oben", "reiter_seite"), schalter("Weiche Übergänge beim Wechseln der Reiter", "reiter_animation"), feld("Schriftgröße", stufe)),
      programmfarbenSektion()]],
    ["kalender", "📅", "Kalender", () => [sektion("Wochenansicht", h("div", { class: "grid2" }, zahlFeld("Erste Stunde", "woche_von", 0, 22), zahlFeld("Letzte Stunde", "woche_bis", 1, 24))),
      feiertage, ferien, wetterSektion(), sektion("Kategorien und Farben", kat, h("div", { class: "row" }, neuKat, h("button", { class: "btn", onclick: katAdd }, "Hinzufügen")))]],
    ["termine", "⏰", "Termine und Erinnerungen", () => [sektion("Standarddauer", h("div", { class: "grid2" }, zahlFeld("Standarddauer Termin (Min.)", "termin_dauer", 5, 600, 5), zahlFeld("Dauer Lehrveranstaltung (Min.)", "stundenplan_dauer", 5, 600, 5))),
      sektion("Erinnerungen", schalter("Erinnerungen anzeigen", "erinnerung_an"), benachrichtigungSchalter(), einst.essen_an !== false ? schalter("Auch für Mahlzeiten", "erinnerung_essen") : null, zahlFeld("Minuten vorher", "erinnerung_minuten", 0, 240, 5),
        h("p", { class: "mut small", style: "margin:0" }, "Erinnerungen erscheinen, solange das Fenster geöffnet ist."))]],
    ["essen", "🍝", "Essen und Einkauf", () => [
      /* ganz oben: Mahlzeiten im Kalender ein/aus */
      sektion("Mahlzeiten im Kalender", schalter("Mahlzeiten im Kalender planen", "essen_an"),
        h("p", { class: "mut small", style: "margin:0" }, einst.essen_an !== false ? "Beim Anlegen gibt es die Art „Essen“, und deine Mahlzeiten erscheinen im Kalender." : "Ausgeschaltet: Beim Anlegen gibt es kein „Essen“, und Mahlzeiten werden im Kalender nicht angezeigt. Bereits eingetragene Mahlzeiten bleiben gespeichert und sind beim Einschalten wieder da.")),
      sektion("Rezepte und Preise", schalter("Rezepte, Vorräte und Preise zeigen (Unterseite in Essen/Einkauf, für den Essensplan)", "rezepte_an"), schalter("Preisvorschläge für Zutaten aus dem Internet (Open Prices)", "preis_vorschlag")),
      einst.essen_an === false ? null : sektion("Kalorien", schalter("Kalorien zählen (Rezepte, Heute und Statistik)", "kalorien_an"),
        einst.kalorien_an !== false ? zahlFeld("Tagesziel (kcal, 0 = keins)", "kalorien_ziel", 0, 10000, 50) : null,
        einst.kalorien_an !== false ? schalter("Kalorien-Vorschläge für unbekannte Zutaten aus dem Internet (Open Food Facts)", "kcal_vorschlag") : null,
        h("p", { class: "mut small", style: "margin:0" }, "Kalorien werden aus einer eingebauten Tabelle geschätzt; Rezepte zählen pro Portion. Einzelne Mahlzeiten kannst du im Kalender mit eigenen Kalorien versehen.")),
      einst.essen_an === false ? null : sektion("Mahlzeiten", zahlFeld("Dauer Mahlzeit (Min.)", "mahlzeit_dauer", 5, 240, 5),
        h("div", { class: "grid2" }, MAHLZEITEN.map(m => { const i = h("input", { type: "time", value: einst.mahlzeit_zeiten[m] }); i.onchange = () => { aendern(() => { einst.mahlzeit_zeiten[m] = i.value || einst.mahlzeit_zeiten[m]; }, true); }; return feld(m, i); })),
        feld("Farbe für Essen", essenFarbe))]],
    ["daten", "💾", "Daten und Datenschutz", () => [datenSektion(), importSektion(), sektion("Datenschutz", datenschutzInhalt()),
      sektion("Über OSA", h("p", { class: "mut small", style: "margin:0" }, R(`OSA – Open Smart Agenda · ${t("Version")} ${APP_VERSION}`)), h("div", { class: "row" }, h("button", { class: "btn", onclick: () => wasIstNeuDialog("") }, "Was ist neu")), zuruecksetzen)]]
  ];
  if (ui.einstKat && !KATS.some(k => k[0] === ui.einstKat)) ui.einstKat = null;
  const aktiv = ui.einstKat || KATS[0][0];   // PC: ohne Auswahl die erste Kategorie zeigen; Handy: ohne Auswahl die Übersicht
  const wahl = k => { ui.einstKat = k; ui.einstSuche = ""; uiSpeichern(); render(); window.scrollTo(0, 0); };
  const nav = h("nav", { class: "einst-nav", "aria-label": "Einstellungen" }, KATS.map(([k, ic, titel]) =>
    h("button", { class: "einst-kat" + (aktiv === k ? " on" : ""), onclick: () => wahl(k) },
      h("span", { class: "ic", "aria-hidden": "true" }, ic), h("span", { class: "tx" }, h("b", null, titel), h("span", { class: "mut small" }, R(einstZusammenfassung(k)))), h("span", { class: "pfeil", "aria-hidden": "true" }, "›"))));
  const inhalt = h("div", { class: "einst-inhalt" });
  for (const [k, , titel, fn] of KATS) inhalt.append(h("div", { class: "einst-gruppe", "data-kat": k, hidden: k !== aktiv },
    h("div", { class: "einst-kopf" }, h("button", { class: "btn sm einst-zurueck", onclick: () => wahl(null) }, R("‹ " + t("Einstellungen"))), h("h2", null, titel)), fn().filter(Boolean)));
  inhalt.append(einstStatus() || h("span"));
  const wurzel = h("div", { class: "einst" + (ui.einstKat ? " hat-kat" : "") }, nav, inhalt);
  /* Suche: blendet passende Abschnitte aus allen Kategorien ein, ohne neu zu zeichnen (Tastatur bleibt offen) */
  const suche = h("input", { type: "search", class: "einst-suche", placeholder: "Einstellung suchen …", value: ui.einstSuche || "", "aria-label": "Einstellung suchen" });
  const keinTreffer = h("p", { class: "empty", hidden: true }, "Keine passende Einstellung gefunden.");
  const filtern = () => {
    const q = suche.value.trim().toLowerCase(); ui.einstSuche = suche.value;
    wurzel.classList.toggle("sucht", !!q); let treffer = 0;
    for (const g of inhalt.querySelectorAll(".einst-gruppe")) {
      let inGruppe = 0;
      for (const s of g.children) { if (s.classList.contains("einst-kopf")) continue; const passt = !q || s.textContent.toLowerCase().includes(q); s.hidden = !passt; if (passt) inGruppe++; }
      g.hidden = q ? !inGruppe : g.dataset.kat !== aktiv; treffer += inGruppe;
    }
    keinTreffer.hidden = !q || treffer > 0;
  };
  suche.addEventListener("input", filtern);
  inhalt.prepend(keinTreffer);
  if (ui.einstSuche) setTimeout(filtern, 0);
  return h("div", null, kopfZeile("Einstellungen"), suche, wurzel);
}

/* ---------- Programmfarben ---------- */
let pfSchema = null;
function programmfarbenSektion() {
  const schema = aktivesSchema();   // immer das aktive Farbschema; gewählt wird es oben unter „Farbschema“
  const eigene = () => ((einst.programmfarben = einst.programmfarben || {})[schema] = (einst.programmfarben[schema] || {}));
  const zeilen = Object.entries(PROGRAMMFARBEN).map(([k, [name, hinweis]]) => {
    const aktuell = ((einst.programmfarben || {})[schema] || {})[k] || THEMEN[schema][k];
    const pick = h("input", { type: "color", value: aktuell, style: "width:42px;height:32px;padding:2px;cursor:pointer" });
    const hex = h("input", { type: "text", value: aktuell, style: "width:96px;font-family:ui-monospace,monospace", maxlength: 7 });
    let gesichert = false, spaeter = 0;   // beim Ziehen im Farbwähler nur EIN Schritt für „Rückgängig“, gespeichert wird danach
    const anwenden = (w, endgueltig) => {
      w = w.trim().toLowerCase(); if (!HEX_FARBE.test(w)) return false;
      if (!gesichert) { verlauf.push(JSON.stringify(daten)); if (verlauf.length > 40) verlauf.shift(); gesichert = true; }
      if (w === THEMEN[schema][k].toLowerCase()) delete eigene()[k]; else eigene()[k] = w;
      themaAnwenden(); pick.value = w; hex.value = w;
      clearTimeout(spaeter);
      if (endgueltig) { speichern(); gesichert = false; } else spaeter = setTimeout(() => { speichern(); gesichert = false; }, 700);
      return true;
    };
    pick.oninput = () => anwenden(pick.value, false);
    pick.onchange = () => anwenden(pick.value, true);
    hex.onchange = () => { if (!anwenden(hex.value, true)) { toast("Kein Farbcode (Beispiel: #4f6bed)."); hex.value = pick.value; } };
    return h("div", { class: "li" }, pick, h("div", { class: "tx" }, h("b", null, name), h("div", { class: "mut small" }, hinweis)), hex);
  });
  return sektion("Programmfarben", h("p", { class: "mut small", style: "margin:0" }, "Eigene Farben für das gewählte Farbschema. Änderungen gelten sofort."),
    h("div", { class: "list" }, zeilen),
    h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { aendern(() => { delete (einst.programmfarben || {})[schema]; }); } }, "Auf Standard zurücksetzen")),
    farbVorlagenBereich(schema));
}
/* Eigene Farbvorlagen: aktuelle Programmfarben (samt Farbschema) unter einem Namen speichern und mit einem Klick wieder anwenden */
const FARB_VORLAGEN_MAX = 30;
function farbVorlagenBereich(schema) {
  const liste = (Array.isArray(einst.farb_vorlagen) ? einst.farb_vorlagen : []).filter(v => v && typeof v.name === "string" && v.farben && typeof v.farben === "object");
  const nameFeld = h("input", { type: "text", id: "farb-vorlage-name", maxlength: 40, placeholder: "Name der Vorlage, z. B. Mein Dunkelblau", style: "flex:1;min-width:160px" });
  const farbenVon = v => { const T0 = THEMEN[v.schema] || THEMEN.ozean, f = k => (HEX_FARBE.test(v.farben[k]) ? v.farben[k] : T0[k]); return [f("bg"), f("karte"), f("akzent"), f("text")]; };
  const speichernVorlage = () => {
    const n = nameFeld.value.trim().replace(/\s+/g, " ");
    if (!n) return toast("Bitte einen Namen für die Vorlage eintragen.");
    const gleich = liste.some(v => v.name.toLowerCase() === n.toLowerCase());
    if (!gleich && liste.length >= FARB_VORLAGEN_MAX) return toast("Es sind höchstens 30 Vorlagen möglich.");
    const tun = () => aendern(() => {
      const l = einst.farb_vorlagen = Array.isArray(einst.farb_vorlagen) ? einst.farb_vorlagen : [];
      const neu = { name: n, schema, farben: JSON.parse(JSON.stringify((einst.programmfarben || {})[schema] || {})) }, i = l.findIndex(x => x && String(x.name).toLowerCase() === n.toLowerCase());
      if (i >= 0) l[i] = neu; else l.push(neu);
    });
    if (gleich) bestaetigen(`${t("Vorlage")} „${n}“ ${t("gibt es schon. Überschreiben?")}`, tun, "Überschreiben"); else tun();
  };
  nameFeld.onkeydown = ev => { if (ev.key === "Enter") speichernVorlage(); };
  const anwenden = v => aendern(() => {
    if (v.schema in THEMEN) einst.design = v.schema;
    einst.programmfarben = einst.programmfarben || {};
    if (Object.keys(v.farben).length) einst.programmfarben[v.schema] = JSON.parse(JSON.stringify(v.farben)); else delete einst.programmfarben[v.schema];
  });
  const zeile = v => h("div", { class: "li", "data-vorlage": v.name },
    h("span", { style: "display:inline-flex;gap:2px;flex:none" }, farbenVon(v).map(c => h("i", { style: `display:inline-block;width:14px;height:24px;border-radius:4px;background:${c};border:1px solid var(--line)` }))),
    h("div", { class: "tx" }, h("b", null, R(v.name)), h("div", { class: "mut small" }, ((DESIGN_AUSWAHL.find(x => x[0] === v.schema) || [])[1]) || R(String(v.schema)))),
    h("button", { class: "btn sm", "data-aktion": "anwenden", onclick: () => anwenden(v) }, "Anwenden"),
    h("button", { class: "btn sm bad", "data-aktion": "loeschen", title: "Vorlage löschen", "aria-label": "Vorlage löschen", onclick: () => bestaetigen("Diese Vorlage löschen?", () => aendern(() => { einst.farb_vorlagen = einst.farb_vorlagen.filter(x => x !== v); })) }, "✕"));
  return h("div", { class: "farb-vorlagen", style: "margin-top:12px;display:flex;flex-direction:column;gap:8px" }, h("h3", { style: "margin:6px 0 0" }, "Eigene Vorlagen"),
    h("p", { class: "mut small", style: "margin:0" }, "Speichere deine aktuellen Farben unter einem eigenen Namen und wende sie später mit einem Klick wieder an."),
    h("div", { class: "row" }, nameFeld, h("button", { class: "btn pri", "data-aktion": "vorlage-speichern", onclick: speichernVorlage }, "Als Vorlage speichern")),
    liste.length ? h("div", { class: "list" }, liste.map(zeile)) : h("div", { class: "mut small" }, "Noch keine Vorlagen."));
}

/* ---------- Daten, Export, Import ---------- */
function sicherungStatus() {   // „Letzte Sicherung: …“ (Browser: zuletzt heruntergeladene Datei; PC: zuletzt geschriebene Tagessicherung)
  let letzte = null; try { letzte = localStorage.getItem(DOWNLOAD_KEY); } catch (e) { }
  const tage = letzte ? diffDays(heute(), parseISO(letzte)) : null;
  const text = tage === null ? t("Noch keine Sicherung heruntergeladen.") : `${t("Letzte Sicherung")}: ${tage <= 0 ? t("heute") : `${t("vor")} ${tage} ${t(tage === 1 ? "Tag" : "Tagen")}`}`;
  return h("p", { class: "mut small", "data-sicherung-status": "1", style: "margin:0;font-weight:600" }, R("💾 " + text));
}
/* Dauerhafter Speicher: Der Browser darf Seitendaten bei Platzmangel von sich aus löschen, solange der Speicher nicht „persistent“ ist.
   Wir bitten einmal darum (Chrome/Edge entscheiden still, Firefox fragt), danach höchstens alle 30 Tage wieder; Ergebnis steht in den Einstellungen. */
const PERSIST_KEY = "alltagsplaner.persist.v1";
async function speicherSchuetzen(erzwingen) {
  try {
    if (pcApi()) { ui.speicherSchutz = "pc"; return; }
    if (!navigator.storage || !navigator.storage.persist || !navigator.storage.persisted) { ui.speicherSchutz = "nicht verfügbar"; return; }
    if (await navigator.storage.persisted()) { ui.speicherSchutz = "ja"; return; }
    let zuletzt = null; try { zuletzt = localStorage.getItem(PERSIST_KEY); } catch (e) { }
    if (!erzwingen && (!datenVorhanden(daten) || (zuletzt && diffDays(heute(), parseISO(zuletzt)) < 30))) { ui.speicherSchutz = "nein"; return; }
    try { localStorage.setItem(PERSIST_KEY, iso(heute())); } catch (e) { }
    ui.speicherSchutz = (await navigator.storage.persist()) ? "ja" : "nein";
  } catch (e) { ui.speicherSchutz = "nicht verfügbar"; }
}
function speicherStatus() {
  const s = ui.speicherSchutz || "nein";
  if (s === "pc") return null;   // die exe hat einen festen Datenordner
  const text = s === "ja" ? "Speicher: dauerhaft geschützt – der Browser löscht die Daten nicht von selbst." : s === "nein" ? "Speicher: nicht garantiert – bei Platzmangel darf der Browser die Daten löschen. Lade deshalb regelmäßig eine Sicherung." : "Speicher: Dieser Browser kann keinen dauerhaften Speicher zusichern. Lade regelmäßig eine Sicherung.";
  return h("div", { class: "row", "data-speicher-status": s, style: "align-items:center;gap:8px" }, h("span", { class: "mut small", style: "flex:1;min-width:200px" }, R("🛡 " + t(text))),
    s === "nein" ? h("button", { class: "btn sm", "data-aktion": "persist", onclick: async () => { await speicherSchuetzen(true); toast(ui.speicherSchutz === "ja" ? "Der Speicher ist jetzt dauerhaft geschützt." : "Der Browser hat den dauerhaften Speicher nicht zugesichert."); render(); } }, "Dauerhaften Speicher anfragen") : null);
}
function sicherungErinnerungFeld() {
  const s = auswahl([[0, "Aus"], [3, "Alle 3 Tage"], [7, "Jede Woche"], [14, "Alle 2 Wochen"], [30, "Jeden Monat"]], typeof einst.sicherung_erinnerung === "number" ? einst.sicherung_erinnerung : 7);
  s.onchange = () => setzen("sicherung_erinnerung", +s.value, true);
  return h("div", null, feld("Erinnerung zum Sichern (Karte auf „Heute“)", s), h("p", { class: "mut small", style: "margin:4px 0 0" }, "In der PC-Version legt OSA.exe jeden Tag selbst eine Sicherungsdatei an, dort erscheint keine Erinnerung."));
}
function datenSektion() {
  const von = h("input", { type: "date", value: iso(montagVon(heute())) }), bis = h("input", { type: "date", value: iso(addDays(montagVon(heute()), 55)) });
  const mitEssen = h("input", { type: "checkbox", checked: true }), mitAuf = h("input", { type: "checkbox", checked: true });
  const datei = h("input", { type: "file", accept: ".json,application/json,.txt", hidden: true });
  datei.onchange = async () => { const f = datei.files[0]; if (f) importieren(await f.text()); datei.value = ""; };
  const ta = h("textarea", { placeholder: "Oder den Inhalt einer Sicherungsdatei (osa.json) hier einfügen …" });
  const speicherInfo = speicher._ok ? null : h("div", { class: "warnbox" }, "Der Browser erlaubt hier kein dauerhaftes Speichern. Deine Daten bleiben nur bis zum Schließen erhalten – bitte regelmäßig eine Sicherung anlegen.");
  const pcInfo = pcApi() ? h("div", { class: "row", style: "align-items:center" },
    h("span", { class: "mut small", style: "flex:1;min-width:200px" }, R(`💾 ${t("Automatische Sicherung: jeden Tag eine Datei im Ordner „OSA-Daten\\Sicherungen“ neben der OSA.exe, die letzten 14 Tage bleiben.")}${ui.pcSicherung ? ` ${t("Zuletzt gesichert")}: ${pad(ui.pcSicherung.zeit.getHours())}:${pad(ui.pcSicherung.zeit.getMinutes())}` : ""}`)),
    h("button", { class: "btn sm", onclick: () => pcApi().ordner_oeffnen() }, "Ordner öffnen")) : null;
  return sektion("Daten und Export",
    speicherInfo, pcInfo,
    h("p", { class: "mut small", style: "margin:0" }, "Alle Daten liegen nur in diesem Browser. Mit einer Sicherung kannst du sie auf ein anderes Gerät oder in die Desktop-Version übertragen (gleiches Format wie osa.json)."),
    sicherungStatus(), speicherStatus(), sicherungErinnerungFeld(),
    h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { sicherungHeruntergeladen(); dateiAngebot(`osa-${iso(heute())}.json`, JSON.stringify(daten, null, 1), "application/json", "Sicherung"); } }, "Sicherung anlegen"),
      h("button", { class: "btn", onclick: () => datei.click() }, "Sicherung laden …"), datei,
      h("button", { class: "btn", onclick: uebertragenDialog }, "Auf anderes Gerät übertragen …"), h("button", { class: "btn", onclick: () => verlauf.length ? rueckgaengig() : toast("Nichts zum Rückgängigmachen.") }, "Letzte Änderung rückgängig")),
    h("h3", { style: "margin-top:6px" }, "Automatische Sicherungen"),
    h("p", { class: "mut small", style: "margin:0" }, "Einmal pro Tag legt die Seite im Browser eine Kopie an (die letzten 3 Tage). Zum Schutz vor Datenverlust lade trotzdem ab und zu eine Sicherung herunter."),
    sicherungsListe(),
    ta, h("div", { class: "row" }, h("button", { class: "btn", onclick: () => ta.value.trim() ? importieren(ta.value) : toast("Bitte erst Text einfügen.") }, "Eingefügten Text laden")),
    h("h3", { style: "margin-top:6px" }, "Kalender-Export (.ics)"),
    h("div", { class: "grid2" }, feld("Von", von), feld("Bis", bis)),
    h("div", { class: "row" }, h("label", { class: "row" }, mitAuf, "Aufgaben"), h("label", { class: "row" }, mitEssen, "Mahlzeiten"),
      h("button", { class: "btn pri", onclick: () => dateiAngebot("osa-kalender.ics", icsExportieren(daten, parseISO(von.value), parseISO(bis.value), mitEssen.checked, mitAuf.checked, einst.mahlzeit_dauer), "text/calendar", "Kalender-Export") }, "Exportieren")),
    h("h3", { style: "margin-top:6px" }, "Alles löschen"),
    h("div", { class: "row" }, h("button", { class: "btn bad", onclick: () => bestaetigen("Wirklich ALLE Daten in diesem Browser löschen? Das lässt sich nur über „Rückgängig“ oder eine Sicherung zurückholen.", () => aendern(() => { const l = leereDaten(); for (const k of Object.keys(daten)) delete daten[k]; Object.assign(daten, datenErgaenzen(l, einst.kategorien)); daten.einstellungen = einst; }), "Alles löschen") }, "Alle Daten löschen")));
}
function importieren(text) {
  let obj; try { obj = JSON.parse(text); } catch (e) { return toast("Das ist keine gültige Sicherungsdatei (JSON)."); }
  if (!obj || typeof obj !== "object" || Array.isArray(obj) || !("aufgaben" in obj || "essen" in obj || "rezepte" in obj)) return toast("In der Datei wurden keine Planer-Daten gefunden.");
  obj = datenBereinigen(obj);
  const na = obj.aufgaben.length, ne = obj.essen.length;
  const ersetzen = () => bestaetigen(`${t("Die aktuellen Daten werden ersetzt durch")}: ${na} ${t("Aufgaben/Termine")}, ${ne} ${t("Mahlzeiten")}. ${t("Fortfahren?")}`, () => {
    let e, d;
    try { e = einstellungenLaden(obj); d = datenErgaenzen(obj, e.kategorien); } catch (err) { toast("Die Datei konnte nicht gelesen werden: " + (err && err.message ? err.message : err)); return false; }   // vorher prüfen, damit nichts halb ersetzt wird
    aendern(() => { for (const k of Object.keys(daten)) delete daten[k]; Object.assign(daten, d); einst = e; daten.einstellungen = e; spracheSetzen(e.sprache); ferienAktualisieren(true); });
  }, "Ersetzen");
  const probe = () => { const k = JSON.parse(JSON.stringify(daten)), f = JSON.parse(JSON.stringify(obj)); return [k, datenZusammenfuehren(k, datenErgaenzen(f, einst.kategorien), einst.kategorien)]; };
  let vorschau; try { vorschau = probe()[1]; } catch (err) { return toast("Die Datei konnte nicht gelesen werden: " + (err && err.message ? err.message : err)); }
  dialog("Sicherung laden", [
    h("p", { style: "margin:0" }, R(`${t("Die Datei enthält")}: ${na} ${t("Aufgaben/Termine")}, ${ne} ${t("Mahlzeiten")}.`)),
    h("p", { style: "margin:0" }, h("b", null, "Zusammenführen (empfohlen)"), R(": "), "Neue und neuere Einträge aus der Datei kommen dazu, Einträge, die dort gelöscht wurden, verschwinden. Alles andere bleibt, wie es ist."),
    h("p", { class: "mut small", style: "margin:0", "data-vorschau": "1" }, R(`→ ${vorschau.neu} ${t("neu")}, ${vorschau.aktualisiert} ${t("aktualisiert")}, ${vorschau.geloescht} ${t("gelöscht")}${vorschau.weitere ? `, ${vorschau.weitere} ${t("weitere Angaben (Rezepte, Preise …)")}` : ""}`)),
    h("p", { style: "margin:0" }, h("b", null, "Ersetzen"), R(": "), "Alle aktuellen Daten werden durch die Datei ersetzt.")],
    [{ text: "Abbrechen" }, { text: "Ersetzen", fn: () => { setTimeout(ersetzen, 0); } }, { text: "Zusammenführen", art: "pri", fn: () => {
      let k, st; try { [k, st] = probe(); } catch (err) { toast("Die Datei konnte nicht gelesen werden: " + (err && err.message ? err.message : err)); return false; }
      aendern(() => {
        for (const key of Object.keys(daten)) delete daten[key];
        Object.assign(daten, k); daten.einstellungen = einst;
        for (const kat of st.kategorien) { einst.kategorien.push(kat); if (st.farben[kat]) einst.farben[kat] = st.farben[kat]; }
      });
      toast(`${t("Zusammengeführt")}: ${st.neu} ${t("neu")}, ${st.aktualisiert} ${t("aktualisiert")}, ${st.geloescht} ${t("gelöscht")}`, true);
    } }]);
}

/* ---------- Auf anderes Gerät übertragen: QR-Codes, ohne Internet ----------
   Senden: Daten packen (deflate), in Stücke teilen, als durchlaufende QR-Code-Folge zeigen.
   Empfangen: Kamera liest die Codes, sammelt alle Stücke und übergibt sie an importieren(). */
const QR_STUECK = 500;   // Zeichen pro Code: klein genug, dass er vom Bildschirm sicher lesbar ist
const b64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function qrPacken(text) {
  if (typeof CompressionStream === "function") {
    const strom = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return "z" + b64(new Uint8Array(await new Response(strom).arrayBuffer()));
  }
  return "r" + b64(new TextEncoder().encode(text));   // ältere Browser: ungepackt
}
async function qrEntpacken(s) {
  const bytes = unb64(s.slice(1));
  if (s[0] === "r") return new TextDecoder().decode(bytes);
  return await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
}
function uebertragenDialog() {
  let zu = () => { };
  zu = dialog("Auf anderes Gerät übertragen", [
    h("p", { style: "margin:0" }, "So kommen deine Einträge ohne Internet auf ein anderes Gerät, zum Beispiel vom PC aufs Handy:"),
    h("ol", { class: "neu-liste" }, h("li", null, "Auf dem Gerät mit deinen Daten: „Senden“ – es erscheint ein QR-Code, der durchläuft."), h("li", null, "Auf dem anderen Gerät: „Empfangen“ – die Kamera öffnet sich."), h("li", null, "Kamera auf den Code halten, bis alle Teile gelesen sind. Danach fragt OSA, ob die Daten übernommen werden sollen.")),
    h("p", { class: "mut small", style: "margin:0" }, "Beim Empfangen kannst du wählen: Zusammenführen (empfohlen – neue und neuere Einträge kommen dazu) oder Ersetzen. Mit „Rückgängig“ lässt sich beides zurücknehmen. Für einen vollständigen Abgleich in beide Richtungen sendest du danach vom anderen Gerät noch einmal."),
    h("div", { class: "mehr-gitter" }, h("button", { class: "btn pri", onclick: () => { zu(); qrSenden(); } }, "Senden"), h("button", { class: "btn", onclick: () => { zu(); qrEmpfangen(); } }, "Empfangen"))],
    [{ text: "Abbrechen" }]);
}
async function qrSenden() {
  const gepackt = await qrPacken(JSON.stringify(daten));
  const id = Math.random().toString(36).slice(2, 6), n = Math.max(1, Math.ceil(gepackt.length / QR_STUECK));
  const teile = Array.from({ length: n }, (_, i) => `OSA1|${id}|${i}|${n}|${gepackt.slice(i * QR_STUECK, (i + 1) * QR_STUECK)}`);
  const leinwand = h("canvas", { class: "qr-bild" }), info = h("b", { style: "text-align:center;font-size:15px" });
  let i = 0, pause = false;
  const zeichnen = () => {
    const q = qrcode(0, "L"); q.addData(teile[i]); q.make();
    const k = q.getModuleCount(), rand = 4, zelle = 5, ctx = leinwand.getContext("2d");
    leinwand.width = leinwand.height = (k + 2 * rand) * zelle;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, leinwand.width, leinwand.height); ctx.fillStyle = "#000";
    for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) if (q.isDark(y, x)) ctx.fillRect((x + rand) * zelle, (y + rand) * zelle, zelle, zelle);
    info.textContent = n > 1 ? `${t("Teil")} ${i + 1} / ${n}` : "";
  };
  const gehe = schritt => { i = (i + schritt + n) % n; zeichnen(); };
  zeichnen();
  /* Ein Code alle 2 Sekunden: ruhig genug zum Mitlesen, die Kamera sammelt die Teile in beliebiger Reihenfolge */
  const takt = n > 1 ? setInterval(() => { if (!leinwand.isConnected) { clearInterval(takt); return; } if (!pause) gehe(1); }, 2000) : 0;
  const pauseKnopf = h("button", { class: "btn sm", onclick: () => { pause = !pause; pauseKnopf.textContent = t(pause ? "Weiter" : "Pause"); } }, "Pause");
  dialog("Senden", [
    h("p", { class: "mut small", style: "margin:0" }, "Auf dem anderen Gerät: Einstellungen › Daten und Export › Auf anderes Gerät übertragen › Empfangen. Dann die Kamera auf diesen Code halten."),
    n > 1 ? h("p", { class: "warnbox", style: "margin:0" }, R(`${t("Deine Daten passen nicht in einen einzigen Code und sind auf")} ${n} ${t("Codes verteilt. Die Codes wechseln deshalb absichtlich – halte die Kamera einfach drauf, bis alle Teile gelesen sind. Die Reihenfolge ist egal.")}`)) : null,
    h("div", { style: "display:flex;justify-content:center" }, leinwand),
    n > 1 ? h("div", { class: "row", style: "justify-content:center;gap:8px" }, h("button", { class: "btn sm", "aria-label": "Teil zurück", onclick: () => gehe(-1) }, "‹"), info, h("button", { class: "btn sm", "aria-label": "Teil vor", onclick: () => gehe(1) }, "›"), pauseKnopf) : null,
    h("p", { class: "mut small", style: "margin:0" }, "Der Code enthält alle deine Einträge. Zeig ihn nur deinen eigenen Geräten.")],
    [{ text: "Fertig", art: "pri", fn: () => { clearInterval(takt); } }]);
}
async function qrEmpfangen() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return kameraHilfeDialog("nichtverfuegbar");
  const video = h("video", { class: "qr-video" }); video.muted = true; video.setAttribute("playsinline", ""); video.setAttribute("muted", "");
  const balken = h("div", { class: "qr-balken" }, h("div")), info = h("p", { class: "mut small", style: "margin:0;text-align:center" }, "Halte die Kamera auf den QR-Code am anderen Gerät.");
  const leinwand = document.createElement("canvas"), ctx = leinwand.getContext("2d", { willReadFrequently: true });
  let strom = null, aktiv = true, id = null, n = 0;
  const teile = new Map(), stopp = () => { aktiv = false; if (strom) strom.getTracks().forEach(s => s.stop()); };
  const zu = dialog("Empfangen", [video, balken, info], [{ text: "Abbrechen", fn: () => { stopp(); } }]);
  try { strom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }); }
  catch (e) { stopp(); zu(); return kameraHilfeDialog(kameraFehlerArt(e), { erneut: () => qrEmpfangen() }); }
  if (!aktiv) { stopp(); return; }
  video.srcObject = strom; try { await video.play(); } catch (e) { }
  const lesen = async () => {
    if (!aktiv) return;
    if (!video.isConnected) { stopp(); return; }   // Dialog wurde geschlossen
    if (video.readyState >= 2 && video.videoWidth) {
      const b = Math.min(video.videoWidth, 900), hoehe = Math.round(video.videoHeight * b / video.videoWidth);
      leinwand.width = b; leinwand.height = hoehe; ctx.drawImage(video, 0, 0, b, hoehe);
      const code = jsQR(ctx.getImageData(0, 0, b, hoehe).data, b, hoehe, { inversionAttempts: "dontInvert" });
      if (code && code.data.startsWith("OSA1|")) {
        const [, cid, nr, ges, ...rest] = code.data.split("|");
        if (cid !== id) { id = cid; n = +ges; teile.clear(); }   // neue Übertragung erkannt
        if (!teile.has(+nr)) {
          teile.set(+nr, rest.join("|"));
          balken.firstChild.style.width = `${teile.size / n * 100}%`;
          const fehlt = Array.from({ length: n }, (_, k) => k).filter(k => !teile.has(k)).map(k => k + 1);
          info.textContent = `${teile.size} / ${n} ${t("Teile gelesen")}` + (fehlt.length && fehlt.length <= 6 ? ` · ${t("Es fehlt noch")}: ${fehlt.join(", ")}` : "");
        }
        if (teile.size === n) {
          stopp(); zu();
          try { importieren(await qrEntpacken(Array.from({ length: n }, (_, k) => teile.get(k)).join(""))); }
          catch (e) { toast("Die Übertragung war unvollständig. Bitte noch einmal versuchen."); }
          return;
        }
      }
    }
    setTimeout(lesen, 120);
  };
  lesen();
}

