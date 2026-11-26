/* ============================================================
   Alltagsplaner – Rechenkern (Daten, Wiederholungen, Auswertungen)
   Portiert aus alltag.py; das Datenformat ist dasselbe (osa.json).
   ============================================================ */
"use strict";

/* ---------- Datum und Uhrzeit ---------- */
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const _isoCache = new Map();
const parseISO = s => {
  let ts = _isoCache.get(s);
  if (ts === undefined) { const [y, m, d] = s.split("-").map(Number); ts = new Date(y, m - 1, d, 12).getTime(); if (_isoCache.size > 5000) _isoCache.clear(); _isoCache.set(s, ts); }
  return new Date(ts);
};
const heute = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const diffDays = (a, b) => Math.round((a - b) / 864e5);
const wochentagNr = d => (d.getDay() + 6) % 7;            // Montag = 0
const montagVon = d => addDays(d, -wochentagNr(d));
function kwVon(d) {                          // Kalenderwoche nach ISO 8601 (Woche 1 enthält den 4. Januar)
  const don = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - wochentagNr(d), 12);   // Donnerstag derselben Woche
  const j4 = new Date(don.getFullYear(), 0, 4, 12);
  return 1 + Math.round((diffDays(don, j4) - 3 + wochentagNr(j4)) / 7);
}
const tageImMonat = (j, m) => new Date(j, m, 0).getDate();   // m = 1..12
const deDatum = s => s ? (([y, m, d]) => `${d}.${m}.${y}`)(s.split("-")) : "";
const deKurz = d => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
function datumParsen(text) {                 // "TT.MM.JJJJ" -> "JJJJ-MM-TT"; "" -> ""; ungültig -> null
  text = (text || "").trim();
  if (!text) return "";
  const m = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1], 12);
  if (d.getFullYear() !== +m[3] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[1]) return null;
  return iso(d);
}
function uhrzeitParsen(text) {               // "8:30" -> "08:30"; "" -> ""; ungültig -> null
  text = (text || "").trim();
  if (!text) return "";
  const m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${pad(+m[1])}:${m[2]}`;
}
const minutenVon = u => { const [h, m] = u.split(":").map(Number); return h * 60 + m; };
const minutenText = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const stundenText = min => (min / 60).toFixed(1).replace(".", ",").replace(",0", "") + " h";
const euroText = b => b.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
function addMonate(start, n) {
  const gesamt = start.getFullYear() * 12 + start.getMonth() + n;
  const j = Math.floor(gesamt / 12), m = gesamt % 12;
  return new Date(j, m, Math.min(start.getDate(), tageImMonat(j, m + 1)), 12);
}

/* ---------- Konstanten ---------- */
/* Farbschemata (wie in der Python-Version) und die einstellbaren Programmfarben */
const THEMEN = {
  dunkel: { dunkel: true, bg: "#1e1c2e", karte: "#29273d", kopf: "#322f49", text: "#ece9ff", text2: "#b0adcf", linie: "#423e62", akzent: "#ff9a3d", akzent_text: "#2b1700", knopf: "#383453", knopf_hover: "#46406d", auswahl: "#4a3a2c", heute: "#2f2c48", jetzt: "#ff6b8b", farbtext: "#1f2937" },
  ozean: { bg: "#eef5fe", karte: "#ffffff", kopf: "#dbe9fb", text: "#0f2440", text2: "#5a7596", linie: "#cfe0f5", akzent: "#1d6fe0", akzent_text: "#ffffff", knopf: "#dae8fb", knopf_hover: "#c6dcf7", auswahl: "#cbe0fb", heute: "#e6f0fd", jetzt: "#f26b3a", farbtext: "#1f2937" },
};
/* Reihenfolge und Namen in der Design-Auswahl. "ozean" (blau) heißt in der Oberfläche „Hell“ (Schlüssel bleibt wegen gespeicherter Einstellungen). */
const DESIGN_AUSWAHL = [["auto", "Automatisch (System)"], ["ozean", "Hell"], ["dunkel", "Dunkel"]];
const THEMA_VAR = { bg: "--bg", karte: "--surf", kopf: "--surf2", text: "--fg", text2: "--mut", linie: "--line", akzent: "--acc", akzent_text: "--acc-fg", knopf: "--knopf", knopf_hover: "--knopf-h", auswahl: "--acc-soft", heute: "--heute", jetzt: "--now", farbtext: "--chip-fg" };
const PROGRAMMFARBEN = {
  akzent: ["Hauptfarbe", "Wichtige Knöpfe, aktiver Reiter, heutiger Tag"],
  akzent_text: ["Schrift auf der Hauptfarbe", "Beschriftung der farbigen Knöpfe"],
  auswahl: ["Markierung", "Aktiver Reiter und markierte Elemente"],
  heute: ["Heutiger Tag", "Hintergrund der heutigen Spalte/Zelle"],
  bg: ["Hintergrund", "Seitenhintergrund"],
  karte: ["Flächen", "Karten, Tabellen, Kalenderzellen"],
  text: ["Schriftfarbe", "Normale Schrift"],
  text2: ["Zweite Schriftfarbe", "Hinweise und inaktive Reiter"],
  jetzt: ["Uhrzeit-Linie", "Linie der aktuellen Uhrzeit"]
};
const HEX_FARBE = /^#[0-9a-fA-F]{6}$/;
const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const KURZ_TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MAHLZEITEN = ["Frühstück", "Mittagessen", "Abendessen", "Snack"];
const WIEDERHOLUNGEN = ["keine", "täglich", "wöchentlich", "alle 2 Wochen", "monatlich", "jährlich"];
const BUDGET_KATEGORIEN = ["Lebensmittel", "Wohnen", "Uni", "Mobilität", "Freizeit", "Abos", "Gesundheit", "Job", "Unterstützung", "Sonstiges"];
const PRIO = { 1: "hoch", 2: "mittel", 3: "niedrig" };
const FARBPALETTE = {
  "Standard": "", "Blau": "#cfe2ff", "Grün": "#d1f0d1", "Gelb": "#fff0c2", "Rosa": "#f8d7e8",
  "Orange": "#ffe0b2", "Lila": "#e4d7f7", "Türkis": "#cdeeee", "Grau": "#e2e4e8",
  "Rot": "#f9d0d0", "Dunkelblau": "#aac4f5", "Dunkelgrün": "#a9d8a9"
};
const EINZEL_FELDER = {
  aufgabe: ["name", "dauer", "prio", "kategorie", "fach", "raum", "dozent", "uhrzeit", "notiz", "farbe"],
  essen: ["gericht", "mahlzeit", "uhrzeit", "notiz", "farbe", "kcal"]
};

function startSprache() {
  try {
    for (const l of (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""])) {
      const k = String(l).slice(0, 2).toLowerCase();
      if (["de", "en", "es", "fr"].includes(k)) return k;
    }
  } catch (e) { }
  return "en";
}

function startFeiertagsLand() {
  try {
    for (const l of (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""])) {
      const teile = String(l).split("-"), region = (teile[1] || "").toUpperCase();
      if (region === "UK") return "GB";
      if (["DE", "AT", "CH", "FR", "ES", "IT", "NL", "BE", "GB", "US"].includes(region)) return region;   // eigene Liste: läuft schon beim Laden der Einstellungen
      const sp = teile[0].toLowerCase();
      if (sp === "de") return "DE"; if (sp === "fr") return "FR"; if (sp === "es") return "ES"; if (sp === "it") return "IT"; if (sp === "nl") return "NL";
    }
  } catch (e) { }
  return "aus";
}

const STANDARD_EINSTELLUNGEN = {
  sprache: startSprache(), design: "auto", woche_von: 7, woche_bis: 21, woche_stunde_h: 0,
  termin_dauer: 60, stundenplan_dauer: 90, mahlzeit_dauer: 45,
  mahlzeit_zeiten: { "Frühstück": "08:00", "Mittagessen": "12:30", "Abendessen": "18:30", "Snack": "15:30" },
  erinnerung_an: true, erinnerung_minuten: 15, erinnerung_essen: false,
  essen_an: true,   // Mahlzeiten im Kalender planen (aus: kein „Essen“ beim Anlegen, Mahlzeiten nicht im Kalender; Daten bleiben)
  reiter_aus: [], reiter_reihenfolge: [], reiter_seite: true, leiste: ["heute", "kalender", "fristen"], benachrichtigung: false, filter_aus: [], budget_essen: false, reiter_getrennt: false, sicherung_erinnerung: 7, stat_aus: [], aufgaben_ansicht: "datum", aufgaben_zu: [], aufgaben_sort: "standard", aufgaben_vorlagen: [], kcal_vorschlag: true, kalorien_an: true, kalorien_ziel: 0, rezepte_an: true, preis_vorschlag: true, ects_ziel: 180, budget_limit: 0, schrift_stufe: "Normal", reiter_animation: true, timer_fokus: 25, timer_pause: 5, wetter_an: false, wetter_ort: "", einkauf_erinnerung: false, einkauf_tag: "Samstag", einkauf_zeit: "10:00", willkommen_gezeigt: false,
  ferien_art: "aus", ferien_land: "DE", ferien_region: "", ferien_ics: "",
  feiertage_land: startFeiertagsLand(),   // "DE", "AT", "CH", "FR", "ES", "IT", "NL", "BE", "GB", "US" oder "aus"
  feiertage_region: "",                   // nur Deutschland: "" = bundesweit, "DE-BY" usw. = mit Landesfeiertagen
  zuletzt_version: "",
  kategorien: ["Uni", "Sport", "Haushalt", "Freizeit"],
  farben: { Uni: "#cfe2ff", Sport: "#d1f0d1", Haushalt: "#fff0c2", Freizeit: "#f8d7e8", Essen: "#ffe0b2" },
  programmfarben: {},
  farb_vorlagen: []   // gespeicherte Farbvorlagen: [{ name, schema, farben }]
};

/* ---------- Daten laden, ergänzen, speichern ---------- */
function leereDaten() {
  return { aufgaben: [], essen: [], einstellungen: {}, rezepte: {}, gericht_mahlzeit: {}, faecher: {}, vorraete: "", preise: "", kalorien: "", rezept_portionen: {}, geloescht: {}, budget: [], noten: [], einkauf: [] };
}
function einstellungenLaden(daten) {
  const e = JSON.parse(JSON.stringify(STANDARD_EINSTELLUNGEN));
  for (const [k, v] of Object.entries(daten.einstellungen || {})) {
    if (v && typeof v === "object" && !Array.isArray(v) && e[k] && typeof e[k] === "object" && !Array.isArray(e[k])) Object.assign(e[k], v);
    else if (k in e) e[k] = v;
  }
  e.design = String(e.design || "auto").toLowerCase();
  if (e.design === "pastell" || e.design === "hell") e.design = "ozean";   // alte Farbschemata "Pastell" und das lila "Hell" (Lavendel) gibt es nicht mehr
  if (e.design !== "auto" && !(e.design in THEMEN)) e.design = "auto";
  const roh = daten.einstellungen || {};
  if (!("rezepte_an" in roh)) e.rezepte_an = true;   // beim ersten Start sind alle Reiter und Unterreiter aktiv
  const aus = Array.isArray(e.reiter_aus) ? e.reiter_aus.slice() : [];
  if (!roh.reiter_getrennt) { e.reiter_getrennt = true; if (e.reiter_aus.includes("geld") && !e.reiter_aus.includes("essen")) e.reiter_aus = e.reiter_aus.concat("essen"); }   // früher ein Reiter „Einkauf & Geld“
  if (aus.includes("einkauf") || aus.includes("budget")) {          // früher zwei Reiter, jetzt "Einkauf & Geld"
    const beide = aus.includes("einkauf") && aus.includes("budget");
    e.reiter_aus = aus.filter(k => k !== "einkauf" && k !== "budget");
    if (beide) e.reiter_aus.push("geld");
  }
  return e;
}
function datenErgaenzen(daten, kategorien) {
  daten = Object.assign(leereDaten(), daten);
  if (!Array.isArray(daten.aufgaben)) daten.aufgaben = [];
  if (!Array.isArray(daten.essen)) daten.essen = [];
  if (!Array.isArray(daten.noten)) daten.noten = [];
  if (!Array.isArray(daten.einkauf)) daten.einkauf = [];
  const k0 = (kategorien && kategorien[0]) || "Uni";
  const std = (o, k, v) => { if (!(k in o)) o[k] = v; };
  for (const a of daten.aufgaben) {
    std(a, "kategorie", k0); std(a, "notiz", ""); std(a, "checkliste", []); std(a, "datum", ""); std(a, "uhrzeit", "");
    std(a, "erledigt_tage", []); std(a, "typ", a.uhrzeit ? "termin" : "aufgabe"); std(a, "fach", ""); std(a, "raum", "");
    std(a, "dozent", ""); std(a, "vorlauf", 0); std(a, "erledigt", false); std(a, "dauer", 30); std(a, "prio", 2);
  }
  for (const e of [...daten.aufgaben, ...daten.essen]) {
    std(e, "enddatum", ""); std(e, "wiederholung", "keine"); std(e, "wiederholen_bis", ""); std(e, "farbe", ""); std(e, "ausnahmen", {});
  }
  for (const e of daten.essen) std(e, "uhrzeit", "");
  for (const b of daten.budget) { std(b, "enddatum", ""); std(b, "wiederholung", "keine"); std(b, "wiederholen_bis", ""); std(b, "ausnahmen", {}); }
  return daten;
}

const SPEICHER = "alltagsplaner.daten.v1";
const speicher = {
  lesen() { try { return localStorage.getItem(SPEICHER); } catch (e) { return speicher._mem || null; } },
  schreiben(text) {
    try { localStorage.setItem(SPEICHER, text); speicher._ok = true; return true; } catch (e) { }
    /* Speicher voll: zuerst Platz schaffen (Tagessicherungen, Wetter- und Ferien-Zwischenspeicher), dann noch einmal versuchen */
    for (const k of ["alltagsplaner.sicherungen.v1", "alltagsplaner.wetter.v1", "alltagsplaner.ferien.v1"]) {
      try { localStorage.removeItem(k); localStorage.setItem(SPEICHER, text); speicher._ok = true; return true; } catch (e) { }
    }
    speicher._mem = text; speicher._ok = false; speicher._melden(); return false;
  },
  _letzte: 0,
  _melden() {
    if (Date.now() - speicher._letzte < 8000) return;   // nicht bei jedem Tastendruck erneut
    speicher._letzte = Date.now();
    try { toast("Speichern nicht möglich: Der Speicher des Browsers ist voll oder gesperrt. Lade jetzt eine Sicherung herunter (Einstellungen › Daten und Export), sonst gehen die letzten Änderungen verloren.", true); } catch (e) { }
  },
  _ok: true
};

/* ---------- Wiederholungen ---------- */
function letzterStart(start, wdh, grenze) {
  if (grenze < start) return null;
  if (wdh === "täglich" || wdh === "wöchentlich" || wdh === "alle 2 Wochen") {
    const schritt = { "täglich": 1, "wöchentlich": 7, "alle 2 Wochen": 14 }[wdh];
    const k = Math.floor(diffDays(grenze, start) / schritt);
    return addDays(start, k * schritt);
  }
  const schritt = wdh === "monatlich" ? 1 : 12;
  const monate = (grenze.getFullYear() - start.getFullYear()) * 12 + grenze.getMonth() - start.getMonth();
  let k = Math.floor(monate / schritt);
  let kand = addMonate(start, k * schritt);
  if (kand > grenze) { k -= 1; if (k < 0) return null; kand = addMonate(start, k * schritt); }
  return kand;
}
function istRegulaererStart(e, tag) {
  const start = parseISO(e.datum), wdh = e.wiederholung || "keine";
  if (wdh === "keine") return iso(tag) === e.datum;
  if (tag < start) return false;
  if (e.wiederholen_bis && tag > parseISO(e.wiederholen_bis)) return false;
  const l = letzterStart(start, wdh, tag);
  return !!l && iso(l) === iso(tag);
}
/* Alle Durchgänge eines Eintrags am Tag `tag` (Date). Ansichten tragen _quelle, _anfang, _start. */
function vorkommenAm(e, tag) {
  if (!e.datum) return [];
  if (!e.wiederholung || e.wiederholung === "keine") {   // schneller Weg für einmalige Einträge: nur Text vergleichen
    const it = iso(tag), endS = e.enddatum && e.enddatum > e.datum ? e.enddatum : e.datum;
    if (it < e.datum || it > endS) return [];
  } else if (!e.ausnahmen || !Object.keys(e.ausnahmen).length) {   // Serie ohne Ausnahmen: vor dem Start / nach dem Ende gibt es nichts
    const it = iso(tag);
    if (it < e.datum) return [];
    if (e.wiederholen_bis && it > e.wiederholen_bis && (!e.enddatum || e.enddatum <= e.datum)) return [];
  }
  const start = parseISO(e.datum);
  const ende = e.enddatum ? parseISO(e.enddatum) : start;
  const laenge = diffDays(ende, start);
  const wdh = e.wiederholung || "keine";
  const ausn = wdh !== "keine" ? (e.ausnahmen || {}) : {};
  const gang = [];
  if (wdh === "keine") {
    if (start <= tag && tag <= ende) gang.push([start, start]);
  } else {
    let grenze = tag;
    if (e.wiederholen_bis) { const b = parseISO(e.wiederholen_bis); if (b < grenze) grenze = b; }
    const anfang = letzterStart(start, wdh, grenze);
    if (anfang && tag <= addDays(anfang, laenge)) {
      const a = ausn[iso(anfang)] || {};
      if (!a.geloescht && !a.datum) gang.push([anfang, anfang]);
    }
    for (const [schl, a] of Object.entries(ausn)) {
      if (a.geloescht || !a.datum) continue;
      const alt = parseISO(schl), neu = parseISO(a.datum);
      if (neu <= tag && tag <= addDays(neu, laenge) && istRegulaererStart(e, alt)) gang.push([alt, neu]);
    }
  }
  return gang.map(([anfang, tats]) => {
    const v = Object.assign({}, e);
    const aend = ausn[iso(anfang)] || {};
    for (const [k, w] of Object.entries(aend)) if (k !== "geloescht" && k !== "datum") v[k] = w;
    v._quelle = e; v._anfang = iso(anfang); v._start = iso(tats);
    return v;
  });
}
function istErledigt(a, tag) {
  if ((a.wiederholung || "keine") === "keine") return !!a.erledigt;
  return (a.erledigt_tage || []).includes(iso(tag));
}
function erledigtUmschalten(a, tag) {
  if ((a.wiederholung || "keine") === "keine") { a.erledigt = !a.erledigt; return; }
  const t = a.erledigt_tage || (a.erledigt_tage = []);
  const i = t.indexOf(iso(tag));
  if (i >= 0) t.splice(i, 1); else t.push(iso(tag));
}
function letzterTag(e) {
  if (!e.datum) return null;
  const start = parseISO(e.datum), ende = e.enddatum ? parseISO(e.enddatum) : start;
  if ((e.wiederholung || "keine") === "keine") return ende;
  if (!e.wiederholen_bis) return null;
  return addDays(parseISO(e.wiederholen_bis), diffDays(ende, start));
}
const dauerInTagen = e => (e.enddatum && e.datum) ? diffDays(parseISO(e.enddatum), parseISO(e.datum)) : 0;
function zeitraumText(e) {
  if (!e.datum) return "-";
  if (e.enddatum && e.enddatum !== e.datum) return `${deDatum(e.datum)} - ${deDatum(e.enddatum)}`;
  return deDatum(e.datum);
}
function wiederholungText(e) {
  const w = e.wiederholung || "keine";
  if (w === "keine") return "-";
  return e.wiederholen_bis ? `${w} bis ${deDatum(e.wiederholen_bis)}` : w;
}
function ausnahmenText(e) {
  const n = Object.keys(e.ausnahmen || {}).length;
  return n ? ` (${n} Ausnahme${n > 1 ? "n" : ""})` : "";
}

/* ---------- Checklisten ---------- */
function checklisteParsen(text) {
  const liste = [];
  for (let z of (text || "").split(/\r?\n/)) {
    z = z.trim(); if (!z) continue;
    let erl = false;
    const m = z.match(/^\[\s*([xX]?)\s*\]\s*(.*)$/);
    if (m) { erl = !!m[1]; z = m[2].trim(); }
    else if (z.startsWith("- ") || z.startsWith("* ")) z = z.slice(2).trim();
    if (z) liste.push({ text: z, erledigt: erl });
  }
  return liste;
}
const checklisteText = l => (l || []).map(p => (p.erledigt ? "[x] " : "[ ] ") + p.text).join("\n");
const checklisteFortschritt = l => [(l || []).filter(p => p.erledigt).length, (l || []).length];

/* ---------- Suche, Erinnerungen, Fristen ---------- */
function suchen(daten, text, art = "Alle", vergangeneAus = false) {
  const woerter = text.toLowerCase().split(/\s+/).filter(Boolean);
  const quellen = daten.aufgaben.map(a => [a.typ || "aufgabe", a]).concat(daten.essen.map(e => ["essen", e]));
  const h = heute(), treffer = [];
  for (const [typ, e] of quellen) {
    if (art !== "Alle" && typ !== art) continue;
    if (vergangeneAus) { const l = letzterTag(e); if (l && l < h) continue; }
    const felder = typ === "essen" ? [e.gericht, e.mahlzeit] : [e.name, e.kategorie, e.fach || "", e.raum || "", e.dozent || "", checklisteText(e.checkliste)];
    felder.push(e.uhrzeit || "", zeitraumText(e), wiederholungText(e), e.notiz || "");
    const heu = felder.join(" ").toLowerCase();
    if (woerter.every(w => heu.includes(w))) treffer.push([typ, e]);
  }
  treffer.sort((a, b) => ((a[1].datum === "") - (b[1].datum === "")) || (a[1].datum < b[1].datum ? -1 : a[1].datum > b[1].datum ? 1 : 0) || ((a[1].uhrzeit || "") < (b[1].uhrzeit || "") ? -1 : 1));
  return treffer;
}
function faelligeErinnerungen(daten, einst, jetzt, gemeldet) {
  if (!einst.erinnerung_an) return [];
  const vorlauf = einst.erinnerung_minuten * 60000, kulanz = 5 * 60000;
  const quellen = daten.aufgaben.map(a => ["aufgabe", a]);
  if (einst.erinnerung_essen && einst.essen_an !== false) quellen.push(...daten.essen.map(e => ["essen", e]));
  const h = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate(), 12), res = [];
  for (const tag of [addDays(h, -1), h, addDays(h, 1)]) {
    for (const [art, e] of quellen) for (const v of vorkommenAm(e, tag)) {
      if (!v.uhrzeit || v._start !== iso(tag)) continue;
      if (art === "aufgabe" && istErledigt(v, tag)) continue;
      const [hh, mm] = v.uhrzeit.split(":").map(Number);
      const beginn = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), hh, mm);
      if (!(beginn - vorlauf <= jetzt && jetzt < +beginn + kulanz)) continue;
      let titel = art === "essen" ? v.gericht : v.name;
      const schl = `${art}|${titel}|${beginn.toISOString()}`;
      if (gemeldet.has(schl)) continue;
      const diff = Math.floor((beginn - jetzt) / 60000);
      const W = { de: ["in {n} Min.", "jetzt", "seit {n} Min."], en: ["in {n} min", "now", "{n} min ago"], es: ["en {n} min", "ahora", "hace {n} min"], fr: ["dans {n} min", "maintenant", "il y a {n} min"] }[sprache] || ["in {n} Min.", "jetzt", "seit {n} Min."];
      const wann = jetzt < beginn ? W[0].replace("{n}", diff) : (jetzt - beginn < 60000 ? W[1] : W[2].replace("{n}", Math.floor((jetzt - beginn) / 60000)));
      if (art === "essen") titel = `${t(v.mahlzeit)}: ${titel}`;
      res.push([beginn, schl, `${v.uhrzeit}  ${titel}  (${wann})`]);
    }
  }
  res.sort((a, b) => a[0] - b[0]);
  return res.map(r => [r[1], r[2]]);
}
function ueberfaelligeAufgaben(daten, h = heute(), fenster = 14) {
  const res = [];
  for (const a of daten.aufgaben) {
    if ((a.typ || "aufgabe") !== "aufgabe" || !a.datum) continue;
    if ((a.wiederholung || "keine") === "keine") {
      const f = letzterTag(a);
      if (f < h && !a.erledigt) res.push({ tag: f, quelle: a, anfang: null, name: a.name });
      continue;
    }
    const laenge = dauerInTagen(a);
    for (let k = 1; k <= fenster; k++) {
      const tag = addDays(h, -k);
      for (const v of vorkommenAm(a, tag)) {
        const start = parseISO(v._start);
        if (iso(addDays(start, laenge)) !== iso(tag)) continue;
        let erl = false;
        for (let d = 0; d <= laenge; d++) if ((a.erledigt_tage || []).includes(iso(addDays(start, d)))) erl = true;
        if (!erl) res.push({ tag, quelle: a, anfang: v._anfang, name: a.name });
      }
    }
  }
  res.sort((a, b) => (a.tag - b.tag) || a.name.localeCompare(b.name));
  return res;
}
function ueberfaelligVerschieben(info, ziel) {
  const q = info.quelle;
  if (info.anfang === null) {
    const laenge = dauerInTagen(q);
    q.datum = iso(ziel);
    if (q.enddatum) q.enddatum = iso(addDays(ziel, laenge));
  } else {
    q.ausnahmen = q.ausnahmen || {};
    const a = q.ausnahmen[info.anfang] || (q.ausnahmen[info.anfang] = {});
    delete a.geloescht; a.datum = iso(ziel);
  }
}
function tageT(n) {
  const v = (I18N.tage || {})[sprache];
  if (!v) return tageText(n);
  if (n < 0) return (-n === 1 ? v.ue1 : v.ue).replace("{n}", -n);
  return n === 0 ? v.h : n === 1 ? v.m : v.n.replace("{n}", n);
}
function tageText(t) {
  if (t < 0) return `${-t} Tag${t !== -1 ? "e" : ""} überfällig`;
  if (t === 0) return "heute fällig";
  if (t === 1) return "morgen fällig";
  return `noch ${t} Tage`;
}
function fristenListe(daten, h = heute()) {
  const liste = [];
  for (const a of daten.aufgaben) {
    if ((a.typ || "aufgabe") !== "aufgabe" || !a.datum || (a.wiederholung || "keine") !== "keine" || a.erledigt) continue;
    const frist = letzterTag(a), tage = diffDays(frist, h);
    if (tage < 0) continue;
    const vorlauf = parseInt(a.vorlauf || 0, 10) || 0;
    liste.push({ quelle: a, name: a.name, frist, tage, vorlauf, im_vorlauf: vorlauf > 0 && tage <= vorlauf });
  }
  liste.sort((a, b) => (a.frist - b.frist) || a.name.localeCompare(b.name));
  return liste;
}
function fristErinnerungen(daten, einst, h, gemeldet) {
  if (!einst.erinnerung_an) return [];
  const res = [];
  for (const f of fristenListe(daten, h)) {
    if (!f.im_vorlauf) continue;
    const schl = `frist|${f.name}|${iso(f.frist)}|${iso(h)}`;
    if (!gemeldet.has(schl)) res.push([schl, `${t("Frist:")} ${f.name} (${tageT(f.tage)}, ${deKurz(f.frist)})`]);
  }
  return res;
}

/* ---------- Konflikte und freie Zeit ---------- */
function intervall(v, std = 30) {
  if (!v.uhrzeit) return null;
  const b = minutenVon(v.uhrzeit), d = Math.max(parseInt(v.dauer ?? std, 10) || std, 1);
  return [b, Math.min(b + d, 1440)];
}
function konflikteFinden(daten, kand, ignorieren = null, tage = 370, maximum = 10) {
  if (kand.typ !== "termin" || !kand.uhrzeit || !kand.datum) return [];
  const eigen = Object.assign({}, kand, { ausnahmen: {} });
  const start = parseISO(eigen.datum);
  let ende = letzterTag(eigen); const grenze = addDays(start, tage);
  ende = (!ende || ende > grenze) ? grenze : ende;
  const andere = daten.aufgaben.filter(a => a !== ignorieren && a.typ === "termin" && a.uhrzeit);
  const treffer = [], gesehen = new Set();
  for (let tag = start; tag <= ende && treffer.length < maximum; tag = addDays(tag, 1)) {
    const mein = vorkommenAm(eigen, tag).map(v => intervall(v)).filter(Boolean);
    for (const iv of mein) for (const a of andere) for (const v of vorkommenAm(a, tag)) {
      const fremd = intervall(v), key = daten.aufgaben.indexOf(a) + "|" + iso(tag);
      if (fremd && iv[0] < fremd[1] && fremd[0] < iv[1] && !gesehen.has(key)) { gesehen.add(key); treffer.push([tag, v]); }
    }
  }
  return treffer.slice(0, maximum);
}
function konfliktText(treffer, zeilen = 6) {
  const teile = treffer.slice(0, zeilen).map(([tag, v]) => {
    const [b, e] = intervall(v);
    return `${KURZ_TAGE[wochentagNr(tag)]} ${deDatum(iso(tag))}, ${minutenText(b)}-${minutenText(e)}  ${v.name}`;
  });
  if (treffer.length > zeilen) teile.push(`... und ${treffer.length - zeilen} weitere`);
  return teile.join("\n");
}
function freieFenster(daten, einst, dauer, von, bis, tagVon = null, tagBis = null, jetzt = new Date()) {
  tagVon = tagVon ?? einst.woche_von * 60; tagBis = tagBis ?? einst.woche_bis * 60;
  const maxBis = addDays(von, 59); if (bis > maxBis) bis = maxBis;
  const quellen = daten.aufgaben.map(a => [a, null]).concat(daten.essen.map(e => [e, einst.mahlzeit_dauer]));
  const res = [];
  for (let tag = von; tag <= bis; tag = addDays(tag, 1)) {
    let anfang = tagVon;
    if (iso(tag) === iso(jetzt)) anfang = Math.max(anfang, Math.ceil((jetzt.getHours() * 60 + jetzt.getMinutes()) / 15) * 15);
    const belegt = [];
    for (const [e, fd] of quellen) for (let v of vorkommenAm(e, tag)) {
      if (fd !== null) v = Object.assign({}, v, { dauer: fd });
      const iv = intervall(v); if (iv) belegt.push(iv);
    }
    belegt.sort((a, b) => a[0] - b[0]);
    let freiAb = anfang;
    for (const [bv, bb] of belegt) {
      if (bv >= tagBis) break;
      if (bv - freiAb >= dauer) res.push({ tag, von: freiAb, bis: bv });
      freiAb = Math.max(freiAb, bb);
    }
    if (tagBis - freiAb >= dauer) res.push({ tag, von: freiAb, bis: tagBis });
  }
  return res;
}

/* ---------- Rezepte, Vorräte, Preise, Einkaufsliste ---------- */
const EINHEITEN = {
  g: ["g", 1], kg: ["g", 1000], ml: ["ml", 1], l: ["ml", 1000], el: ["EL", 1], tl: ["TL", 1], stk: ["Stk", 1], pck: ["Pck", 1],
  packung: ["Pck", 1], dose: ["Dose", 1], bund: ["Bund", 1], prise: ["Prise", 1], zehe: ["Zehe", 1], zehen: ["Zehe", 1],
  "stück": ["Stk", 1], stueck: ["Stk", 1]
};
function zutatenParsen(text) {
  const res = [];
  for (let z of (text || "").split(/\r?\n/)) {
    z = z.trim(); if (!z) continue;
    const m = z.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
    const rest = m ? m[2].trim() : "";
    if (!rest) { res.push([null, "", z]); continue; }
    let menge = parseFloat(m[1].replace(",", "."));
    const teile = rest.split(/\s+/);
    const einh = EINHEITEN[teile[0].toLowerCase().replace(/\.$/, "")];
    if (einh && teile.length >= 2) {
      menge *= einh[1];
      res.push([menge, einh[0], rest.slice(rest.indexOf(teile[1])).trim()]);
    } else res.push([menge, "", rest]);
  }
  return res;
}
function mengeText(menge, einheit) {
  if (einheit === "g" && menge >= 1000) { menge /= 1000; einheit = "kg"; }
  else if (einheit === "ml" && menge >= 1000) { menge /= 1000; einheit = "l"; }
  const zahl = String(+menge.toFixed(2)).replace(".", ",");
  return `${zahl} ${einheit}`.trim();
}
const PREIS_MUSTER = /^(.+?)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*(?:€|eur|euro)?\s*(?:(?:\/|pro)\s*(\d+(?:[.,]\d+)?)?\s*([A-Za-zÄÖÜäöüß]+\.?))?\s*$/i;
function preiseParsen(text) {
  const preise = new Map();
  for (const z of (text || "").split(/\r?\n/)) {
    const m = z.trim().match(PREIS_MUSTER); if (!m) continue;
    const name = m[1].trim().toLowerCase(), preis = parseFloat(m[2].replace(",", "."));
    if (!m[4]) { preise.set(name + "|", preis); continue; }
    const einh = EINHEITEN[m[4].toLowerCase().replace(/\.$/, "")]; if (!einh) continue;
    const menge = parseFloat((m[3] || "1").replace(",", ".")); if (menge <= 0) continue;
    preise.set(name + "|" + einh[0], preis / (menge * einh[1]));
  }
  return preise;
}
function zutatKosten(preise, zutat, einheit, menge) {
  const name = zutat.toLowerCase(), kand = [einheit];
  if (einheit === "") kand.push("Stk"); else if (einheit === "Stk") kand.push("");
  if (menge !== null) for (const k of kand) if (preise.has(name + "|" + k)) return menge * preise.get(name + "|" + k);
  return preise.has(name + "|") ? preise.get(name + "|") : null;
}
function rezeptKosten(daten, name) {
  const rez = {}; for (const [k, v] of Object.entries(daten.rezepte || {})) rez[k.toLowerCase()] = v;
  const preise = preiseParsen(daten.preise);
  let summe = 0, fehlt = 0;
  for (const [menge, einheit, zutat] of zutatenParsen(rez[name.trim().toLowerCase()] || "")) {
    const k = zutatKosten(preise, zutat, einheit, menge);
    if (k === null) fehlt++; else summe += k;
  }
  return [summe, fehlt];
}
/* ---------- Kalorien ----------
   Geschätzt aus einer eingebauten Tabelle (kcal pro 100 g, ohne Internet). Eigene Werte (daten.kalorien) haben Vorrang.
   Eintrag: [Suchwörter, kcal/100 g, { stk: g pro Stück, pck: g pro Packung/Dose, d: g pro ml, el: g pro EL }] */
const KCAL_TABELLE = [
  [["nudeln", "pasta", "spaghetti", "penne", "fusilli", "makkaroni", "farfalle", "tagliatelle", "bandnudeln", "lasagneplatten", "mienudeln", "asianudeln", "reisnudeln", "glasnudeln"], 350, { pck: 500 }],
  [["reis", "basmatireis", "jasminreis", "risottoreis", "milchreis"], 350, { pck: 500, el: 12 }], [["couscous", "quinoa", "polenta", "bulgur", "hirse"], 355, { pck: 500, el: 12 }],
  [["haferflocken"], 370, { el: 8, pck: 500 }], [["müsli", "muesli"], 370, { pck: 500, el: 10 }], [["cornflakes", "frühstücksflocken"], 375, { pck: 375, el: 5 }],
  [["mehl", "weizenmehl", "dinkelmehl", "vollkornmehl"], 340, { el: 10, pck: 1000 }], [["speisestärke", "maisstärke"], 340, { el: 10 }], [["zucker", "puderzucker", "rohrzucker", "brauner zucker"], 400, { el: 12, pck: 1000 }],
  [["brot", "vollkornbrot", "graubrot", "mischbrot"], 250, { stk: 45, pck: 500 }], [["toast", "toastbrot"], 260, { stk: 25, pck: 500 }], [["brötchen", "semmel", "semmeln"], 270, { stk: 60 }],
  [["tortilla", "wrap", "wraps", "tortillas"], 300, { stk: 60 }], [["pizzateig", "blätterteig", "hefeteig"], 320, { pck: 270 }], [["hefe"], 100, { pck: 42 }],
  [["kartoffel", "kartoffeln"], 75, { stk: 150 }], [["süßkartoffel", "süßkartoffeln"], 86, { stk: 300 }], [["pommes", "pommes frites"], 160, { pck: 750 }],
  [["zwiebel", "zwiebeln", "rote zwiebel", "rote zwiebeln"], 40, { stk: 100 }], [["schalotte", "schalotten"], 70, { stk: 30 }], [["knoblauch", "knoblauchzehe", "knoblauchzehen"], 140, { stk: 50 }],
  [["karotte", "karotten", "möhre", "möhren"], 40, { stk: 80 }], [["tomate", "tomaten", "kirschtomaten", "cherrytomaten", "rispentomaten"], 18, { stk: 100 }],
  [["gurke", "gurken", "salatgurke"], 12, { stk: 400 }], [["paprika", "paprikaschote", "paprikaschoten"], 30, { stk: 160 }], [["zucchini"], 17, { stk: 250 }], [["lauch", "porree"], 30, { stk: 250 }],
  [["champignons", "champignon", "pilze", "pilz"], 22, { stk: 20, pck: 250 }], [["avocado", "avocados"], 160, { stk: 150 }], [["brokkoli", "broccoli"], 34, { stk: 400 }], [["blumenkohl"], 25, { stk: 700 }],
  [["aubergine", "auberginen"], 24, { stk: 300 }], [["spinat", "blattspinat"], 23, { pck: 450 }], [["salat", "kopfsalat", "eisbergsalat", "blattsalat", "feldsalat", "rucola"], 15, { stk: 300 }],
  [["kohl", "weißkohl", "rotkohl", "spitzkohl"], 25, { stk: 1000 }], [["kürbis", "hokkaido"], 26, { stk: 1200 }], [["sellerie", "staudensellerie"], 20, { stk: 400 }], [["radieschen"], 15, { stk: 10 }],
  [["spargel"], 20, { pck: 500 }], [["ingwer"], 80, { stk: 30 }], [["chili", "chilischote", "chilischoten"], 40, { stk: 10 }], [["mais"], 90, { pck: 285, el: 12 }],
  [["erbsen"], 80, { pck: 300 }], [["bohnen", "kidneybohnen", "weiße bohnen"], 95, { pck: 240 }], [["kichererbsen"], 130, { pck: 240 }], [["linsen", "rote linsen"], 350, { pck: 500 }],
  [["tofu"], 120, { pck: 200 }], [["tomatenmark"], 90, { el: 20, pck: 70 }], [["passierte tomaten", "dosentomaten", "gehackte tomaten", "pizzatomaten", "tomatensauce", "tomatensoße", "nudelsauce", "nudelsoße"], 30, { pck: 400 }],
  [["banane", "bananen"], 90, { stk: 120 }], [["apfel", "äpfel"], 52, { stk: 150 }], [["birne", "birnen"], 57, { stk: 170 }], [["orange", "orangen", "apfelsine"], 47, { stk: 200 }],
  [["mandarine", "mandarinen", "clementine", "clementinen"], 46, { stk: 80 }], [["zitrone", "zitronen"], 30, { stk: 100 }], [["limette", "limetten"], 30, { stk: 70 }],
  [["erdbeeren", "erdbeere"], 32, { stk: 15 }], [["heidelbeeren", "blaubeeren", "himbeeren", "brombeeren"], 45, {}], [["weintrauben", "trauben"], 70, {}], [["kiwi", "kiwis"], 60, { stk: 80 }],
  [["mango", "mangos"], 60, { stk: 350 }], [["pfirsich", "pfirsiche", "nektarine", "nektarinen"], 40, { stk: 150 }], [["pflaume", "pflaumen", "zwetschge", "zwetschgen"], 45, { stk: 40 }],
  [["kirschen"], 60, { stk: 8 }], [["ananas"], 55, { stk: 900 }], [["melone", "wassermelone"], 35, { stk: 1500 }], [["datteln"], 280, { stk: 8 }], [["rosinen"], 300, { el: 12 }],
  [["milch", "vollmilch", "h-milch"], 64, { d: 1.03 }], [["hafermilch", "haferdrink"], 45, { d: 1.03 }], [["sojamilch", "sojadrink", "mandelmilch"], 35, { d: 1.03 }], [["kokosmilch"], 170, { pck: 400, d: 1 }],
  [["joghurt", "jogurt", "naturjoghurt"], 62, { pck: 150, el: 15 }], [["quark", "magerquark"], 70, { pck: 250, el: 20 }], [["skyr"], 63, { pck: 450 }],
  [["frischkäse"], 250, { pck: 200, el: 20 }], [["sahne", "schlagsahne"], 300, { pck: 200, d: 1, el: 15 }], [["kochsahne"], 150, { pck: 200, d: 1 }], [["schmand", "creme fraiche", "crème fraîche", "saure sahne"], 240, { pck: 200, el: 20 }],
  [["käse", "gouda", "emmentaler", "cheddar", "bergkäse"], 350, { pck: 200, stk: 20 }], [["parmesan"], 400, { el: 6, pck: 100 }], [["reibekäse", "geriebener käse", "streukäse"], 350, { pck: 200, el: 6 }],
  [["mozzarella"], 250, { stk: 125, pck: 125 }], [["feta", "schafskäse", "hirtenkäse"], 260, { pck: 200 }], [["butter"], 740, { pck: 250, el: 15 }], [["margarine"], 720, { pck: 250, el: 15 }],
  [["ei", "eier"], 143, { stk: 60 }], [["eigelb"], 350, { stk: 20 }], [["eiweiß"], 50, { stk: 30 }],
  [["hähnchenbrust", "hühnerbrust", "hähnchenbrustfilet", "hähnchen", "huhn", "hühnchen"], 115, { pck: 400 }], [["pute", "putenbrust", "putenfleisch"], 105, { pck: 400 }],
  [["rindfleisch", "rinderhack", "rindersteak"], 200, { pck: 400 }], [["hackfleisch", "hack", "gemischtes hack"], 250, { pck: 500 }], [["schweinefleisch", "schnitzel", "schweineschnitzel"], 200, { pck: 400 }],
  [["schinken", "kochschinken"], 120, { stk: 20, pck: 100 }], [["speck", "bacon", "schinkenwürfel"], 400, { stk: 15, pck: 150 }], [["wurst", "bratwurst"], 300, { stk: 100 }],
  [["würstchen", "wiener", "wienerle"], 280, { stk: 50 }], [["salami"], 450, { stk: 5, pck: 100 }], [["lachs", "lachsfilet"], 200, { stk: 125, pck: 250 }], [["thunfisch"], 130, { pck: 140 }],
  [["garnelen", "shrimps"], 90, { pck: 200 }], [["fisch", "fischfilet", "forelle"], 100, { stk: 125 }],
  [["öl", "olivenöl", "sonnenblumenöl", "rapsöl", "speiseöl", "kokosöl", "pflanzenöl"], 880, { d: 0.92, el: 14 }],
  [["erdnüsse", "mandeln", "walnüsse", "cashews", "nüsse", "haselnüsse", "pistazien"], 600, { el: 10, pck: 200 }], [["erdnussbutter"], 600, { el: 15 }], [["nutella", "nussnougatcreme"], 540, { el: 15 }],
  [["honig"], 305, { el: 20 }], [["marmelade", "konfitüre", "marmeladen"], 250, { el: 20 }], [["schokolade", "kuvertüre"], 540, { stk: 5, pck: 100 }], [["kakao", "kakaopulver"], 370, { el: 8 }],
  [["ketchup", "tomatenketchup"], 100, { el: 17 }], [["senf"], 80, { el: 15 }], [["mayonnaise", "mayo"], 700, { el: 12 }], [["sojasoße", "sojasauce"], 60, { el: 15, d: 1.1 }], [["essig", "balsamico", "weißweinessig"], 20, { d: 1 }],
  [["hummus"], 230, { el: 20 }], [["orangensaft", "o-saft", "apfelsaft", "saft", "multivitaminsaft"], 45, { d: 1.04 }], [["cola", "limonade"], 42, { d: 1.04 }], [["bier"], 43, { d: 1.01 }], [["wein", "rotwein", "weißwein"], 80, { d: 0.99 }],
  [["wasser", "mineralwasser", "salz", "meersalz", "pfeffer", "gewürz", "gewürze", "paprikapulver", "curry", "currypulver", "zimt", "oregano", "thymian", "rosmarin", "basilikum", "petersilie", "schnittlauch", "kräuter", "dill", "kreuzkümmel", "kümmel", "muskat", "kaffee", "tee", "brühe", "gemüsebrühe", "backpulver", "vanille", "vanillezucker"], 0, {}]
];
const KCAL_MUSTER = /^(.+?)\s*[:=]\s*(\d+(?:[.,]\d+)?)\s*(?:kcal|kal)?\s*(?:(?:\/|pro)\s*(\d+(?:[.,]\d+)?)?\s*([A-Za-zÄÖÜäöüß]+\.?))?\s*$/i;
function kalorienParsen(text) {   // „Name: 350 kcal/100 g“, „Ei: 75 kcal/Stk“ oder „Name: 120 kcal“ – wie bei den Preisen
  const k = new Map();
  for (const z of (text || "").split(/\r?\n/)) {
    const m = z.trim().match(KCAL_MUSTER); if (!m) continue;
    const name = m[1].trim().toLowerCase(), kcal = parseFloat(m[2].replace(",", "."));
    if (!m[4]) { k.set(name + "|", kcal); continue; }
    const einh = EINHEITEN[m[4].toLowerCase().replace(/\.$/, "")]; if (!einh) continue;
    const menge = parseFloat((m[3] || "1").replace(",", ".")); if (menge <= 0) continue;
    k.set(name + "|" + einh[0], kcal / (menge * einh[1]));
  }
  return k;
}
function kcalEintrag(name) {
  const n = String(name || "").toLowerCase().replace(/[^a-zäöüß\s-]/g, " ").replace(/\s+/g, " ").trim(); if (!n) return null;
  const woerter = n.split(/[\s-]+/).filter(Boolean); let best = null, score = 0;
  for (const e of KCAL_TABELLE) for (const s of e[0]) {
    let p = 0;
    if (s === n) p = 1000 + s.length;
    else if (s.includes(" ")) { if (n.includes(s)) p = s.length + 1; }
    else if (woerter.some(w => w === s || (s.length >= 4 && (w.startsWith(s) || w.endsWith(s))))) p = s.length;
    if (p > score) { score = p; best = e; }
  }
  return best;
}
function zutatKcal(eigene, zutat, einheit, menge) {   // → kcal (Zahl) oder null, wenn unbekannt
  const k = zutatKosten(eigene, zutat, einheit, menge); if (k !== null) return k;
  const e = kcalEintrag(zutat); if (!e) return null;
  const [, pro100, o] = e;
  if (pro100 === 0) return 0;
  if (menge === null) return null;
  const d = o.d || 1; let g = null;
  if (einheit === "g") g = menge; else if (einheit === "ml") g = menge * d;
  else if (einheit === "EL") g = menge * (o.el || 15 * d); else if (einheit === "TL") g = menge * (o.el || 15 * d) / 3;
  else if (einheit === "Prise") g = menge * 0.5; else if (einheit === "Zehe") g = menge * 4;
  else if (einheit === "Pck" || einheit === "Dose") g = o.pck ? menge * o.pck : null;
  else if (einheit === "Bund") g = o.stk ? menge * o.stk : menge * 30;
  else if (einheit === "Stk" || einheit === "") g = o.stk ? menge * o.stk : null;
  return g === null ? null : g * pro100 / 100;
}
/* Vorschlag aus Open Food Facts (freie Datenbank, ODbL): Für Zutaten, die nicht in der eingebauten Tabelle stehen, wird nach dem Namen gesucht
   (Search-a-licious), von den Treffern werden kcal je 100 g geholt und der Median genommen. Ergebnis 30 Tage im Browser gemerkt. */
const KCAL_SUCHE = "https://search.openfoodfacts.org/search", KCAL_PRODUKTE = "https://world.openfoodfacts.org/api/v2/search", KCAL_CACHE = "osa.kcalvorschlag.v1";
function kcalMedian(werte) {
  const w = werte.filter(x => typeof x === "number" && x >= 1 && x <= 900).sort((a, b) => a - b);
  if (w.length < 3) return null;
  const m = w.length >> 1; return { pro100: w.length % 2 ? w[m] : (w[m - 1] + w[m]) / 2, n: w.length };
}
async function kcalStatistik(name) {   // → { pro100, n } oder null
  const schl = String(name || "").trim().toLowerCase().replace(/\s+/g, " "); if (schl.length < 3) return null;
  let cache = {}; try { cache = JSON.parse(localStorage.getItem(KCAL_CACHE) || "{}"); } catch (e) { }
  const c = cache[schl]; if (c && Date.now() - c.zeit < (c.s ? 30 : 2) * 864e5) return c.s;
  let s = null;
  try {
    const treffer = (await preisAbruf(`${KCAL_SUCHE}?q=${encodeURIComponent(schl)}&page_size=20&fields=code`)).hits || [];
    const codes = treffer.map(x => x.code).filter(Boolean);
    if (codes.length) s = kcalMedian(((await preisAbruf(`${KCAL_PRODUKTE}?code=${codes.join(",")}&fields=code,nutriments&page_size=${codes.length}`)).products || []).map(p => p.nutriments && p.nutriments["energy-kcal_100g"]));
    try { const jetzt = JSON.parse(localStorage.getItem(KCAL_CACHE) || "{}"); jetzt[schl] = { zeit: Date.now(), s }; localStorage.setItem(KCAL_CACHE, JSON.stringify(jetzt)); } catch (e) { }
  } catch (e) { return null; }   // keine Verbindung: nichts merken, später erneut versuchen
  return s;
}
function kcalAusPro100(pro100, menge, einheit) {   // Menge in g/ml/EL/TL/Prise/Zehe/Bund → kcal (Stück und Packung lassen sich ohne Gewicht nicht umrechnen)
  if (!(menge > 0)) return null;
  const g = { g: 1, ml: 1, EL: 15, TL: 5, Prise: 0.5, Zehe: 4, Bund: 30 }[einheit]; if (!g) return null;
  return menge * g * pro100 / 100;
}
async function kcalVorschlagFuer(ti, ki) {   // trägt für eine unbekannte Zutat den Vorschlag ins Kalorienfeld ein
  if (einst.kcal_vorschlag === false || ki.dataset.eigen === "1" || ki.value.trim()) return;
  const text = ti.value, pz = zutatenParsen(text)[0]; if (!pz || zutatKcal(kalorienParsen(daten.kalorien), pz[2], pz[1], pz[0]) !== null) return;   // bekannt: kein Vorschlag nötig
  if (kcalAusPro100(1, pz[0], pz[1]) === null) return;
  const platz = ki.placeholder; ki.placeholder = "…";
  let s; try { s = await kcalStatistik(pz[2]); } catch (e) { s = null; }
  ki.placeholder = platz;
  if (!s || ti.value !== text || ki.dataset.eigen === "1" || ki.value.trim()) return;
  const k = kcalAusPro100(s.pro100, pz[0], pz[1]); if (!(k >= 0)) return;
  ki.value = String(Math.round(k)); ki.classList.add("preis-vorschlag");
  ki.title = `${t("Vorschlag aus Open Food Facts")}: ${t("Mittelwert aus")} ${s.n} ${t("Produkten")} (≈ ${Math.round(s.pro100)} kcal / 100 g)`;
  ki.dispatchEvent(new Event("vorschlag"));
}
function kcalZeile(menge, einheit, name, k) {   // Eigenen Wert als Zeile für daten.kalorien (pro 100 g/ml bzw. pro Einheit)
  const f = x => String(+x.toFixed(2)).replace(".", ",");
  if (menge === null || !(menge > 0)) return `${name}: ${f(k)} kcal`;
  if (einheit === "g") return `${name}: ${f(k / (menge / 100))} kcal/100 g`;
  if (einheit === "ml") return `${name}: ${f(k / (menge / 100))} kcal/100 ml`;
  return `${name}: ${f(k / menge)} kcal/${einheit || "Stk"}`;
}
function kalorienSetzen(text, name, zeile) {
  const k = name.trim().toLowerCase(), zeilen = String(text || "").split(/\r?\n/).filter(z => { const m = z.trim().match(KCAL_MUSTER); return z.trim() && !(m && m[1].trim().toLowerCase() === k); });
  zeilen.push(zeile); return zeilen.join("\n");
}
/* „Meine Lebensmittel“: die eigenen Werte (daten.kalorien) als Liste, Zeile bauen und entfernen */
function kalorienEintraege(text) {
  const res = [];
  for (const z of String(text || "").split(/\r?\n/)) {
    const m = z.trim().match(KCAL_MUSTER); if (!m) continue;
    const eintrag = [...kalorienParsen(z.trim()).entries()][0]; if (!eintrag) continue;
    const [schl, wert] = eintrag, einheit = schl.slice(schl.lastIndexOf("|") + 1);   // "" (pauschal), g, ml, EL, TL, Stk, Pck …
    const art = einheit === "g" ? "100g" : einheit === "ml" ? "100ml" : einheit === "" ? "pauschal" : einheit;
    res.push({ name: m[1].trim(), art, kcal: Math.round((einheit === "g" || einheit === "ml" ? wert * 100 : wert) * 100) / 100 });
  }
  return res.sort((a, b) => a.name.localeCompare(b.name));
}
function kalorienZeileAus(name, kcal, art) {
  const f = x => String(+x.toFixed(2)).replace(".", ",");
  const nach = { "100g": " kcal/100 g", "100ml": " kcal/100 ml", Stk: " kcal/Stk", EL: " kcal/EL", TL: " kcal/TL", Pck: " kcal/Pck", pauschal: " kcal" }[art] || ` kcal/${art}`;
  return `${name}: ${f(kcal)}${nach}`;
}
function kalorienEntfernen(text, name) {
  const k = String(name).trim().toLowerCase();
  return String(text || "").split(/\r?\n/).filter(z => { const m = z.trim().match(KCAL_MUSTER); return z.trim() && !(m && m[1].trim().toLowerCase() === k); }).join("\n");
}
function rezeptPortionen(daten, name) {
  const k = String(name || "").trim().toLowerCase();
  for (const [n, p] of Object.entries(daten.rezept_portionen || {})) if (n.trim().toLowerCase() === k) return Math.max(1, Math.round(+p) || 1);
  return 1;
}
function rezeptKalorien(daten, name) {   // → { summe, fehlt, zutaten, portionen, proPortion }
  const rez = {}; for (const [k, v] of Object.entries(daten.rezepte || {})) rez[k.trim().toLowerCase()] = v;
  const eigene = kalorienParsen(daten.kalorien), zl = zutatenParsen(rez[String(name || "").trim().toLowerCase()] || "");
  let summe = 0, fehlt = 0;
  for (const [menge, einheit, zutat] of zl) { const k = zutatKcal(eigene, zutat, einheit, menge); if (k === null) fehlt++; else summe += k; }
  const portionen = rezeptPortionen(daten, name);
  return { summe, fehlt, zutaten: zl.length, portionen, proPortion: summe / portionen };
}
function mahlzeitKcal(daten, v) {   // eigener Wert der Mahlzeit, sonst Rezept pro Portion; null = keine Angabe
  if (+v.kcal > 0) return Math.round(+v.kcal);
  const r = rezeptKalorien(daten, v.gericht || "");
  return r.zutaten && r.summe > 0 ? Math.round(r.proPortion) : null;
}
function kalorienTag(daten, tag) {
  const eintraege = []; let summe = 0, ohne = 0;
  for (const e of daten.essen || []) for (const v of vorkommenAm(e, tag)) {
    const k = mahlzeitKcal(daten, v); eintraege.push({ v, kcal: k });
    if (k === null) ohne++; else summe += k;
  }
  eintraege.sort((a, b) => String(a.v.uhrzeit || "99:99").localeCompare(String(b.v.uhrzeit || "99:99")));
  return { tag, summe, ohne, eintraege };
}
function kalorienZeitraum(daten, von, bis) {
  const tage = []; let summe = 0, mitDaten = 0;
  for (let tag = von; tag <= bis; tag = addDays(tag, 1)) { const d = kalorienTag(daten, tag); tage.push(d); summe += d.summe; if (d.summe > 0) mitDaten++; }
  return { tage, summe, mitDaten, schnitt: mitDaten ? summe / mitDaten : 0 };
}
function kalorienWoche(daten, montag) { return kalorienZeitraum(daten, montag, addDays(montag, 6)); }
function gerichtVorschlaege(daten) {
  const fav = Object.keys(daten.rezepte || {}).sort((a, b) => a.localeCompare(b));
  const klein = new Set(fav.map(f => f.toLowerCase()));
  const weitere = [...new Set(daten.essen.map(e => e.gericht.trim()).filter(g => g && !klein.has(g.toLowerCase())))].sort((a, b) => a.localeCompare(b));
  return fav.concat(weitere);
}
function einkaufslisteBauen(daten, von, bis, info = null) {
  const rez = {}; for (const [n, t] of Object.entries(daten.rezepte || {})) rez[n.trim().toLowerCase()] = t;
  const gerichte = new Map();
  for (let tag = von; tag <= bis; tag = addDays(tag, 1)) for (const e of daten.essen) for (const v of vorkommenAm(e, tag)) {
    const n = v.gericht.trim(); if (!n) continue;
    const k = n.toLowerCase(); if (!gerichte.has(k)) gerichte.set(k, [n, 0]); gerichte.get(k)[1]++;
  }
  const summen = new Map(), ohneRezept = [];
  for (const [schl, [name, anzahl]] of [...gerichte.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const zutaten = zutatenParsen(rez[schl] || "");
    if (!zutaten.length) { ohneRezept.push(name); continue; }
    for (const [menge, einheit, zutat] of zutaten) {
      const key = zutat.toLowerCase() + "|" + einheit;
      if (!summen.has(key)) summen.set(key, { zutat, einheit, menge: null, gerichte: [] });
      const s = summen.get(key);
      if (menge !== null) s.menge = (s.menge || 0) + menge * anzahl;
      if (!s.gerichte.includes(name)) s.gerichte.push(name);
    }
  }
  const vorMenge = new Map(), vorOhne = new Set();
  for (const [menge, einheit, zutat] of zutatenParsen(daten.vorraete || "")) {
    if (menge === null) vorOhne.add(zutat.toLowerCase());
    else { const k = zutat.toLowerCase() + "|" + einheit; vorMenge.set(k, (vorMenge.get(k) || 0) + menge); }
  }
  const preise = preiseParsen(daten.preise), liste = [], vorraetig = [];
  for (const s of [...summen.values()].sort((a, b) => a.zutat.toLowerCase().localeCompare(b.zutat.toLowerCase()))) {
    const kl = s.zutat.toLowerCase(); let vorratText = "";
    if (vorOhne.has(kl)) { vorraetig.push(s.zutat); continue; }
    if (s.menge !== null) {
      const vorh = vorMenge.get(kl + "|" + s.einheit) || 0;
      if (vorh >= s.menge) { vorraetig.push(s.zutat); continue; }
      if (vorh > 0) { vorratText = `${mengeText(vorh, s.einheit)} aus Vorrat abgezogen`; s.menge -= vorh; }
    }
    let text = s.zutat;
    if (s.menge !== null) text = mengeText(s.menge, s.einheit) + " " + text;
    liste.push({ text, gerichte: s.gerichte.join(", "), vorrat: vorratText, kosten: zutatKosten(preise, s.zutat, s.einheit, s.menge), schluessel: `${kl}|${s.einheit}` });
  }
  if (info) info.vorraetig = vorraetig;
  let n = 0; for (const [, c] of gerichte.values()) n += c;
  return [liste, ohneRezept, n];
}

/* ---------- Stundenplan, Fächer ---------- */
function lehrveranstaltungen(daten) {
  const l = daten.aufgaben.filter(a => a.typ === "termin" && a.fach && (a.wiederholung || "keine") !== "keine" && a.datum);
  l.sort((a, b) => (wochentagNr(parseISO(a.datum)) - wochentagNr(parseISO(b.datum))) || ((a.uhrzeit || "99:99") < (b.uhrzeit || "99:99") ? -1 : 1));
  return l;
}
function stundenplanWoche(daten, montag) {
  const woche = [];
  for (let i = 0; i < 7; i++) {
    const tag = addDays(montag, i), l = [];
    for (const a of daten.aufgaben) if (a.typ === "termin" && a.fach) l.push(...vorkommenAm(a, tag));
    l.sort((a, b) => ((a.uhrzeit || "99:99") < (b.uhrzeit || "99:99") ? -1 : 1));
    woche.push(l);
  }
  return woche;
}
function fachFortschritt(daten, montag) {
  return Object.entries(daten.faecher || {}).sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase())).map(([name, w]) => {
    let erl = 0, gepl = 0;
    for (const a of daten.aufgaben) {
      if (a.fach !== name || (a.typ || "aufgabe") !== "aufgabe") continue;
      for (let i = 0; i < 7; i++) {
        const tag = addDays(montag, i);
        for (const v of vorkommenAm(a, tag)) {
          if (v._start !== iso(tag)) continue;
          gepl += v.dauer; if (istErledigt(v, tag)) erl += v.dauer;
        }
      }
    }
    return { name, ziel: Math.round((w.ziel || 0) * 60), erledigt: erl, geplant: gepl };
  });
}

/* ---------- Budget ---------- */
function budgetImMonat(daten, j, m) {
  const res = [];
  for (let t = 1; t <= tageImMonat(j, m); t++) {
    const tag = new Date(j, m - 1, t, 12);
    for (const b of daten.budget || []) for (const v of vorkommenAm(b, tag)) res.push([tag, v]);
  }
  return res;
}
function budgetMitEssen(daten, j, m) {
  const buchungen = budgetImMonat(daten, j, m), kosten = {}; let ohnePreis = 0;
  for (let t = 1; t <= tageImMonat(j, m); t++) {
    const tag = new Date(j, m - 1, t, 12);
    for (const e of daten.essen) for (const v of vorkommenAm(e, tag)) {
      const name = v.gericht.trim(), k = name.toLowerCase();
      if (!(k in kosten)) kosten[k] = rezeptKosten(daten, name);
      const [summe, fehlt] = kosten[k];
      if (summe <= 0) { ohnePreis++; continue; }
      buchungen.push([tag, { art: "Ausgabe", betrag: Math.round(summe * 100) / 100, kategorie: "Lebensmittel",
        beschreibung: `Essen: ${name} (geschätzt${fehlt ? ", teils ohne Preis" : ""})`, datum: iso(tag), enddatum: "", wiederholung: "keine",
        wiederholen_bis: "", ausnahmen: {}, _auto: true }]);
    }
  }
  buchungen.sort((a, b) => a[0] - b[0]);
  return [buchungen, ohnePreis];
}
function budgetImZeitraum(daten, von, bis, mitEssen = false) {   // [[Tag, Buchung]] von … bis (einschließlich), optional mit geschätzten Essenskosten
  const res = [], kosten = {};
  for (let tag = von; tag <= bis; tag = addDays(tag, 1)) {
    const mittag = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), 12);
    for (const b of daten.budget || []) for (const v of vorkommenAm(b, mittag)) res.push([mittag, v]);
    if (!mitEssen) continue;
    for (const e of daten.essen || []) for (const v of vorkommenAm(e, mittag)) {
      const name = v.gericht.trim(), k = name.toLowerCase();
      if (!(k in kosten)) kosten[k] = rezeptKosten(daten, name);
      const [summe, fehlt] = kosten[k]; if (summe <= 0) continue;
      res.push([mittag, { art: "Ausgabe", betrag: Math.round(summe * 100) / 100, kategorie: "Lebensmittel", beschreibung: `Essen: ${name} (geschätzt${fehlt ? ", teils ohne Preis" : ""})`, datum: iso(mittag), _auto: true }]);
    }
  }
  return res;
}
function budgetSummen(buchungen) {
  let ein = 0, aus = 0; const kat = {};
  for (const [, b] of buchungen) {
    if (b.art === "Einnahme") ein += b.betrag; else { aus += b.betrag; kat[b.kategorie] = (kat[b.kategorie] || 0) + b.betrag; }
  }
  return [ein, aus, Object.entries(kat).sort((a, b) => b[1] - a[1])];
}

/* ---------- Statistik ---------- */
function aufgabenAm(daten, tag) {
  const res = [];
  for (const a of daten.aufgaben) {
    if ((a.typ || "aufgabe") !== "aufgabe") continue;
    for (const v of vorkommenAm(a, tag)) if (v._start === iso(tag)) res.push(v);
  }
  return res;
}
function statLernzeit(daten, von, bis) {
  const s = {};
  for (let tag = von; tag <= bis; tag = addDays(tag, 1)) for (const v of aufgabenAm(daten, tag)) {
    if (!v.fach) continue;
    const x = s[v.fach] || (s[v.fach] = [0, 0]);
    x[1] += v.dauer; if (istErledigt(v, tag)) x[0] += v.dauer;
  }
  return Object.entries(s).map(([f, [e, g]]) => [f, e, g]).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
}
function statProWoche(daten, wochen = 8, h = heute()) {
  const mo = montagVon(h), res = [];
  for (let n = wochen - 1; n >= 0; n--) {
    const start = addDays(mo, -7 * n); let erl = 0, off = 0;
    for (let i = 0; i < 7; i++) {
      const tag = addDays(start, i);
      for (const v of aufgabenAm(daten, tag)) { if (istErledigt(v, tag)) erl++; else if (tag <= h) off++; }
    }
    res.push([start, erl, off]);
  }
  return res;
}
function statKategorien(daten, von, bis) {
  const s = {};
  for (let tag = von; tag <= bis; tag = addDays(tag, 1)) for (const v of aufgabenAm(daten, tag)) {
    if (!istErledigt(v, tag)) continue;
    const x = s[v.kategorie] || (s[v.kategorie] = [0, 0]); x[0]++; x[1] += v.dauer;
  }
  return Object.entries(s).map(([k, [n, m]]) => [k, n, m]).sort((a, b) => b[1] - a[1]);
}
function statMonate(daten, monate = 6, h = heute(), mitEssen = true) {
  const res = [];
  for (let n = monate - 1; n >= 0; n--) {
    let m = h.getMonth() + 1 - n, j = h.getFullYear();
    while (m < 1) { m += 12; j--; }
    const b = mitEssen ? budgetMitEssen(daten, j, m)[0] : budgetImMonat(daten, j, m);
    const [ein, aus] = budgetSummen(b);
    res.push([j, m, aus, ein]);
  }
  return res;
}
function statSerie(daten, h = heute(), maximum = 120) {
  let serie = 0, tag = h;
  for (let n = 0; n < maximum; n++) {
    const geschafft = aufgabenAm(daten, tag).some(v => istErledigt(v, tag));
    if (geschafft) serie++; else if (!(n === 0)) break;
    tag = addDays(tag, -1);
  }
  return serie;
}

/* ---------- Ferien (Internet, optional) ---------- */
const FERIEN_API = "https://openholidaysapi.org";
const FERIEN_ARTEN = { aus: "Keine Ferien anzeigen", schule: "Schulferien", akademisch: "Akademische Ferien (vorlesungsfreie Zeit)" };
const FERIEN_LAENDER = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", LI: "Liechtenstein", LU: "Luxemburg", BE: "Belgien", NL: "Niederlande",
  FR: "Frankreich", IT: "Italien", ES: "Spanien", PT: "Portugal", PL: "Polen", CZ: "Tschechien", SK: "Slowakei", HU: "Ungarn", SI: "Slowenien",
  HR: "Kroatien", EE: "Estland", LV: "Lettland", LT: "Litauen", BG: "Bulgarien", RO: "Rumänien", IE: "Irland", SE: "Schweden" };
const FERIEN_REGIONEN_DE = { "DE-BW": "Baden-Württemberg", "DE-BY": "Bayern", "DE-BE": "Berlin", "DE-BB": "Brandenburg", "DE-HB": "Bremen", "DE-HH": "Hamburg",
  "DE-HE": "Hessen", "DE-MV": "Mecklenburg-Vorpommern", "DE-NI": "Niedersachsen", "DE-NW": "Nordrhein-Westfalen", "DE-RP": "Rheinland-Pfalz",
  "DE-SL": "Saarland", "DE-SN": "Sachsen", "DE-ST": "Sachsen-Anhalt", "DE-SH": "Schleswig-Holstein", "DE-TH": "Thüringen" };
function ferienName(namen) {
  if (typeof namen === "string") return namen;
  for (const w of ["DE", "EN"]) for (const n of namen || []) if (String(n.language).toUpperCase() === w) return n.text;
  return namen && namen[0] ? namen[0].text : "";
}
function icsParsen(text) {
  const zeilen = [];
  for (const roh of text.replace(/\r\n?/g, "\n").split("\n")) {
    if ((roh[0] === " " || roh[0] === "\t") && zeilen.length) zeilen[zeilen.length - 1] += roh.slice(1); else zeilen.push(roh);
  }
  const res = []; let ev = null;
  for (const z of zeilen) {
    if (z.trim() === "BEGIN:VEVENT") ev = {};
    else if (z.trim() === "END:VEVENT" && ev) {
      if (ev.start) {
        let ende = ev.ende ? addDays(ev.ende, -1) : ev.start; if (ende < ev.start) ende = ev.start;
        res.push({ start: iso(ev.start), ende: iso(ende), name: (ev.name || "").trim() });
      }
      ev = null;
    } else if (ev && z.includes(":")) {
      const i = z.indexOf(":"), schl = z.slice(0, i), wert = z.slice(i + 1), basis = schl.split(";")[0].toUpperCase();
      if (basis === "DTSTART" || basis === "DTEND") {
        const m = wert.trim().match(/^(\d{4})(\d{2})(\d{2})/);
        if (m) {
          const d = new Date(+m[1], +m[2] - 1, +m[3], 12);
          if (basis === "DTSTART") ev.start = d; else ev.ende = /VALUE=DATE/i.test(schl) ? d : addDays(d, 1);
        }
      } else if (basis === "SUMMARY") ev.name = wert.replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/g, " ");
    }
  }
  return res;
}
function semesterferienRichtwert(jahre) {
  const l = [];
  for (const j of jahre) {
    l.push({ start: `${j}-02-15`, ende: `${j}-04-14`, name: "Semesterferien (Richtwert)" });
    l.push({ start: `${j}-07-15`, ende: `${j}-10-14`, name: "Semesterferien (Richtwert)" });
  }
  return l;
}
async function ferienAbrufen(einst, jahre) {
  if (einst.ferien_art === "schule") {
    let url = `${FERIEN_API}/SchoolHolidays?countryIsoCode=${einst.ferien_land}&languageIsoCode=DE&validFrom=${Math.min(...jahre)}-01-01&validTo=${Math.max(...jahre)}-12-31`;
    if (einst.ferien_region) url += `&subdivisionCode=${einst.ferien_region}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return (await r.json()).map(d => ({ start: d.startDate, ende: d.endDate, name: ferienName(d.name) }));
  }
  if (einst.ferien_art === "akademisch") {
    if ((einst.ferien_ics || "").trim()) {
      let url = einst.ferien_ics.trim().replace(/^webcal:\/\//, "https://");
      const r = await fetch(url); if (!r.ok) throw new Error("HTTP " + r.status);
      return icsParsen(await r.text());
    }
    return semesterferienRichtwert(jahre);
  }
  return [];
}
function ferienIndex(liste) {
  const idx = {};
  for (const e of liste) {
    let tag = parseISO(e.start); const ende = parseISO(e.ende);
    for (let n = 0; tag <= ende && n < 400; n++, tag = addDays(tag, 1)) if (!idx[iso(tag)]) idx[iso(tag)] = e.name || "Ferien";
  }
  return idx;
}

/* ---------- Export (.ics) ---------- */
const icsText = t => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function icsFalten(z) {
  const enc = new TextEncoder(), teile = []; let akt = "";
  for (const ch of z) {
    if (enc.encode(akt + ch).length > (teile.length ? 74 : 75)) { teile.push(akt); akt = ch; } else akt += ch;
  }
  teile.push(akt); return teile.join("\r\n ");
}
function icsExportieren(daten, von, bis, mitEssen = true, mitAufgaben = true, mahlzeitDauer = 45) {
  /* Einzeltermine mit fester UID (zweimal importieren ergibt keine Doppelten), Serien als eine Serie mit RRULE,
     Zeiten als UTC (Einzeltermine) bzw. mit Zeitzone (Serien, damit sie die Sommerzeit überstehen). */
  let tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { }
  const z = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OSA Open Student Agenda//DE", "CALSCALE:GREGORIAN"];
  if (tz) z.push("X-WR-TIMEZONE:" + tz);
  const jetzt = new Date(), stamp = `${jetzt.getUTCFullYear()}${pad(jetzt.getUTCMonth() + 1)}${pad(jetzt.getUTCDate())}T${pad(jetzt.getUTCHours())}${pad(jetzt.getUTCMinutes())}${pad(jetzt.getUTCSeconds())}Z`;
  const d8 = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const lokal = (d, min) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, min); return `${d8(x)}T${pad(x.getHours())}${pad(x.getMinutes())}00`; };
  const utc = (d, min) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, min); return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}Z`; };
  const mitZone = (name, d, min) => tz ? `${name};TZID=${tz}:${lokal(d, min)}` : `${name}:${lokal(d, min)}`;
  const hash = s => { let h = 5381; for (const c of s) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
  const uidVon = (art, e) => `osa-${hash([art, e.name || e.gericht || "", e.mahlzeit || "", e.datum || "", e.uhrzeit || ""].join("|"))}`;
  const felder = (art, v, tag) => {
    if (art === "essen") return { titel: `${v.mahlzeit}: ${v.gericht}`, dauer: mahlzeitDauer, beschr: v.notiz || "", ort: "", kat: "Essen" };
    const tx = [v.notiz || ""].concat((v.checkliste || []).map(p => (p.erledigt ? "[x] " : "[ ] ") + p.text));
    if (v.dozent) tx.push("Dozent: " + v.dozent);
    return { titel: (tag && istErledigt(v, tag) ? "✓ " : "") + v.name, dauer: v.dauer || 60, beschr: tx.filter(Boolean).join("\n"), ort: v.raum || "", kat: v.kategorie || "" };
  };
  const zusatz = f => { z.push("SUMMARY:" + icsText(f.titel)); if (f.beschr) z.push("DESCRIPTION:" + icsText(f.beschr)); if (f.ort) z.push("LOCATION:" + icsText(f.ort)); if (f.kat) z.push("CATEGORIES:" + icsText(f.kat)); };
  /* ein Vorkommen schreiben; serie = true: mit Zeitzone, wiederkehrend; rid = Originaldatum bei geänderten Vorkommen */
  const ereignis = (uid, f, tag, uhr, letzter, opt = {}) => {
    z.push("BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp}`);
    if (opt.rid) z.push(opt.rid);
    if (uhr) {
      const b = minutenVon(uhr), e = b + Math.max(f.dauer, 1);
      if (opt.serie) z.push(mitZone("DTSTART", tag, b), mitZone("DTEND", tag, e));
      else z.push(`DTSTART:${utc(tag, b)}`, `DTEND:${utc(tag, e)}`);
    } else z.push(`DTSTART;VALUE=DATE:${d8(tag)}`, `DTEND;VALUE=DATE:${d8(addDays(letzter, 1))}`);
    if (opt.rrule) z.push(opt.rrule);
    for (const x of opt.exdate || []) z.push(x);
    zusatz(f);
    z.push("END:VEVENT");
  };
  const quellen = daten.aufgaben.map(a => ["aufgabe", a]);
  if (mitEssen) quellen.push(...daten.essen.map(e => ["essen", e]));
  const laenge = e => (e.enddatum && e.datum ? Math.max(diffDays(parseISO(e.enddatum), parseISO(e.datum)), 0) : 0);

  /* Serien: eine Serie mit Wiederholungsregel */
  const FREQ = { "täglich": "FREQ=DAILY", "wöchentlich": "FREQ=WEEKLY", "alle 2 Wochen": "FREQ=WEEKLY;INTERVAL=2", "monatlich": "FREQ=MONTHLY", "jährlich": "FREQ=YEARLY" };
  for (const [art, e] of quellen) {
    const wdh = e.wiederholung || "keine"; if (wdh === "keine" || !FREQ[wdh] || !e.datum) continue;
    if (art === "aufgabe" && !mitAufgaben && (e.typ || "aufgabe") === "aufgabe") continue;
    const start = parseISO(e.datum), ende = e.wiederholen_bis ? parseISO(e.wiederholen_bis) : null;
    if (start > bis || (ende && ende < von)) continue;
    const f = felder(art, e, null), len = laenge(e), uid = uidVon(art, e), uhr = e.uhrzeit || (art === "essen" ? (einst.mahlzeit_zeiten[e.mahlzeit] || "") : "");
    let rrule = "RRULE:" + FREQ[wdh];
    if (ende) rrule += ";UNTIL=" + (uhr ? utc(ende, 1439) : d8(ende));
    const exd = [], ueber = [];
    for (const [schl, aus] of Object.entries(e.ausnahmen || {})) {
      const orig = parseISO(schl); if (!istRegulaererStart(e, orig)) continue;
      const m0 = uhr ? minutenVon(uhr) : 0;
      exd.push(uhr ? (tz ? `EXDATE;TZID=${tz}:${lokal(orig, m0)}` : `EXDATE:${lokal(orig, m0)}`) : `EXDATE;VALUE=DATE:${d8(orig)}`);
      if (aus.geloescht) continue;
      ueber.push([orig, aus]);
    }
    ereignis(uid, f, start, uhr, addDays(start, len), { serie: true, rrule, exdate: exd });
    for (const [orig, aus] of ueber) {            // geänderte oder verschobene Vorkommen als eigene Einträge derselben Serie
      const v = Object.assign({}, e, aus); delete v.geloescht;
      const neuTag = aus.datum ? parseISO(aus.datum) : orig, u2 = v.uhrzeit || uhr, m0 = uhr ? minutenVon(uhr) : 0;
      const rid = uhr ? (tz ? `RECURRENCE-ID;TZID=${tz}:${lokal(orig, m0)}` : `RECURRENCE-ID:${lokal(orig, m0)}`) : `RECURRENCE-ID;VALUE=DATE:${d8(orig)}`;
      ereignis(uid, felder(art, v, null), neuTag, u2, addDays(neuTag, len), { serie: true, rid });
    }
  }

  /* Einzeltermine im gewählten Zeitraum */
  for (let tag = von, n = 0; tag <= bis && n < 1100; tag = addDays(tag, 1), n++) {
    for (const [art, e] of quellen) {
      if ((e.wiederholung || "keine") !== "keine" && FREQ[e.wiederholung]) continue;
      for (const v of vorkommenAm(e, tag)) {
        if (v._start !== iso(tag)) continue;
        if (art !== "essen" && !mitAufgaben && (v.typ || "aufgabe") === "aufgabe") continue;
        const f = felder(art, v, tag);
        ereignis(uidVon(art, e) + "-" + d8(tag), f, tag, v.uhrzeit, addDays(tag, laenge(v)));
      }
    }
  }
  z.push("END:VCALENDAR");
  return z.map(icsFalten).join("\r\n") + "\r\n";
}

