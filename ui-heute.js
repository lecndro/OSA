/* OSA – Schnelleingabe, Heute, Noten, Geld, Kopf und Rahmen, Handy-Leiste, Datenschutz */
"use strict";
/* ============================================================
   Oberfläche wie im Python-Programm: Heute, Noten, Essen/Einkauf, Geld
   ============================================================ */
function subNav(liste, aktiv, wahl) {
  const n = h("div", { class: "sub" });
  for (const [k, l] of liste) n.append(h("button", { class: aktiv === k ? "on" : "", onclick: () => wahl(k) }, l));
  return n;
}

/* ---------- Schnell-Eingabe: "Mathe-Klausur Freitag 14 Uhr" ---------- */
const TAG_NAMEN = { montag: 0, dienstag: 1, mittwoch: 2, donnerstag: 3, freitag: 4, samstag: 5, sonntag: 6, monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
/* Monatsnamen für die Schnell-Eingabe ("im Dezember", "3. Dez", "end of May") */
const MONATE_VOLL = { januar: 0, "jänner": 0, februar: 1, "märz": 2, maerz: 2, april: 3, mai: 4, juni: 5, juli: 6, august: 7, september: 8, oktober: 9, november: 10, dezember: 11,
  january: 0, february: 1, march: 2, may: 4, june: 5, july: 6, october: 9, december: 11 };
const MONATE_KURZ = { jan: 0, feb: 1, "mär": 2, mrz: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, okt: 9, oct: 9, nov: 10, dez: 11, dec: 11 };
const MONAT_ALLE = Object.assign({}, MONATE_VOLL, MONATE_KURZ);
const monatMuster = o => Object.keys(o).sort((a, b) => b.length - a.length).join("|");
const FUELLWOERTER = new Set(["am", "um", "bis", "von", "für", "fuer", "ab", "den", "dem", "in", "nächsten", "naechsten", "kommenden", "dann", "und", "at", "on", "for", "to", "from", "next", "the", "and", "until"]);
function schnellParsen(text, jetzt = new Date(), kategorien = ["Uni"]) {
  const tag0 = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate(), 12);
  let rest = " " + String(text).trim() + " ";
  const e = { name: "", datum: "", uhrzeit: "", dauer: null, typ: null, kategorie: null, prio: 2, wiederholung: "keine" };
  const nimm = re => { const m = rest.match(re); if (m) rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length); return m; };
  let m = nimm(/^\s*(aufgabe|termin|todo|to-do|task|appointment|event)\s*:\s*/i);
  if (m) e.typ = /^(termin|appointment|event)$/i.test(m[1]) ? "termin" : "aufgabe";
  for (const kat of (rest.match(/#\S+/g) || [])) {
    const name = kategorien.find(k => k.toLowerCase() === kat.slice(1).toLowerCase());
    if (name) { e.kategorie = name; rest = rest.replace(kat, " "); }
  }
  if (nimm(/(?<=\s)!{1,3}(?=\s)/)) e.prio = 1;
  /* Priorität in Worten: „wichtig“, „dringend“, „unwichtig“, „Prio 1/2/3“, „Priorität hoch/mittel/niedrig“ */
  if (nimm(/(?<=\s)(?:wichtig|dringend|urgent|important|asap)(?=[\s.,;!]|$)/i)) e.prio = 1;
  else if (nimm(/(?<=\s)(?:unwichtig|niedrige?\s+priorität|low\s+priority)(?=[\s.,;!]|$)/i)) e.prio = 3;
  else if ((m = nimm(/(?<=\s)(?:prio(?:rität|rity)?)\s*[:=]?\s*([123]|hoch|mittel|niedrig|high|medium|low)(?=[\s.,;!]|$)/i))) e.prio = ({ 1: 1, 2: 2, 3: 3, hoch: 1, high: 1, mittel: 2, medium: 2, niedrig: 3, low: 3 })[m[1].toLowerCase()];
  /* Wiederholung: „täglich“, „jede Woche“, „alle 2 Wochen“, „jeden Monat“, „jährlich“ – und „jeden Montag“ (wöchentlich, erster Termin am nächsten Montag) */
  const WDH = [[/(?<=\s)(?:täglich|taeglich|jeden\s+tag|every\s+day|daily)(?=[\s.,;!]|$)/i, "täglich"], [/(?<=\s)(?:alle\s+(?:2|zwei)\s+wochen|jede\s+zweite\s+woche|zweiwöchentlich|every\s+(?:2|two|other)\s+weeks?|biweekly)(?=[\s.,;!]|$)/i, "alle 2 Wochen"],
    [/(?<=\s)(?:wöchentlich|woechentlich|jede\s+woche|every\s+week|weekly)(?=[\s.,;!]|$)/i, "wöchentlich"], [/(?<=\s)(?:monatlich|jeden\s+monat|every\s+month|monthly)(?=[\s.,;!]|$)/i, "monatlich"],
    [/(?<=\s)(?:jährlich|jaehrlich|jedes\s+jahr|every\s+year|yearly|annually)(?=[\s.,;!]|$)/i, "jährlich"]];
  for (const [re, wdh] of WDH) if (e.wiederholung === "keine" && nimm(re)) e.wiederholung = wdh;
  if (e.wiederholung === "keine" && nimm(new RegExp(`(?<=\\s)(?:jeden|jede|every|each)\\s+(?=(?:${Object.keys(TAG_NAMEN).join("|")})(?=[\\s.,;!]|$))`, "i"))) e.wiederholung = "wöchentlich";   // der Wochentag bleibt stehen und legt den ersten Termin fest
  const sm = (s, mi) => { s = +s; mi = +(mi || 0); return s >= 0 && s <= 23 && mi >= 0 && mi <= 59 ? [s, mi] : null; };
  const zeitSuchen = (re, bereich) => {
    const g = new RegExp(re.source, "gi"); let x;
    while ((x = g.exec(rest))) {
      const w = sm(x[1], x[2]), en = bereich ? sm(x[3], x[4]) : null;
      if (w && (en || !bereich)) { rest = rest.slice(0, x.index) + " " + rest.slice(x.index + x[0].length); return [w, en]; }
    }
    return null;
  };
  let zs = null, ze = null;
  const ampm = (s, ap) => { s = +s; ap = (ap || "").toLowerCase(); if (ap === "pm" && s < 12) s += 12; if (ap === "am" && s === 12) s = 0; return s; };
  m = nimm(/(?<![\d.:])(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (m) { zs = sm(ampm(m[1], m[3] || m[6]), m[2]); ze = sm(ampm(m[4], m[6]), m[5]); }
  else if ((m = nimm(/\bfrom\s+(\d{1,2})(?::(\d{2}))?\s*(?:to|until|-|–)\s*(\d{1,2})(?::(\d{2}))?(?![\d:.])/i))) { zs = sm(m[1], m[2]); ze = sm(m[3], m[4]); }
  else if ((m = nimm(/(?<![\d.:])(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i))) zs = sm(ampm(m[1], m[3]), m[2]);
  if (!zs) for (const [re, ber] of [
    [/(?<![\d.:])(?:von\s+)?(\d{1,2}):(\d{2})\s*(?:uhr)?\s*(?:-|–|bis)\s*(\d{1,2}):(\d{2})\s*(?:uhr)?(?![\d:])/, true],
    [/(?<![\d.:])(?:von\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?\s*(?:-|–|bis)\s*(\d{1,2})(?::(\d{2}))?\s*uhr\b/, true],
    [/(?<![\d.:])(\d{1,2}):(\d{2})(?![\d:])\s*(?:uhr)?/, false],
    [/(?<![\d.:])(\d{1,2})\.(\d{2})\s*uhr\b/, false],
    [/(?<![\d.:])(\d{1,2})()\s*uhr\b/, false],
    [/\b(?:um|at)\s+(\d{1,2})(?:[.:](\d{2}))?(?![\d.,:])/, false]]) {
    const g = zeitSuchen(re, ber); if (g) { [zs, ze] = g; break; }
  }
  if (zs && !ze) {   // „ab 14 Uhr muss ich X machen bis 17 Uhr“: das Ende steht getrennt im Satz
    let mEnde = nimm(/\b(?:bis|until)\s+(?:um\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(uhr|am|pm)\b/i);
    if (mEnde) ze = sm(ampm(mEnde[1], /^[ap]m$/i.test(mEnde[3]) ? mEnde[3] : ""), mEnde[2]);
    else if ((mEnde = nimm(/\b(?:bis|until)\s+(?:um\s+)?(\d{1,2}):(\d{2})(?![\d:.])/i))) ze = sm(mEnde[1], mEnde[2]);
  }
  if (zs) {
    e.uhrzeit = `${pad(zs[0])}:${pad(zs[1])}`;
    if (ze) { const min = (ze[0] * 60 + ze[1]) - (zs[0] * 60 + zs[1]); if (min > 0) e.dauer = min; }
  }
  if (e.dauer === null) {
    m = nimm(/\b(?:(?:f(?:ü|ue)r|for)\s+)?(\d+(?:[.,]\d+)?)\s*(stunden?|std\.?|hours?|hrs?|h|minuten?|minutes?|mins?|min\.?)(?=\s|$)/i);
    if (m) e.dauer = Math.round(parseFloat(m[1].replace(",", ".")) * (/^[sh]/i.test(m[2]) ? 60 : 1));
    else if (nimm(/\b(?:(?:f(?:ü|ue)r|for)\s+)?(?:(?:eine|an)\s+)?(?:halbe\s+stunde|half\s+(?:an\s+)?hour)\b/i)) e.dauer = 30;
    else if (nimm(/\b(?:(?:f(?:ü|ue)r|for)\s+)?(?:eine\s+stunde|an\s+hour|one\s+hour)\b/i)) e.dauer = 60;
    if (e.dauer !== null && !(e.dauer >= 5 && e.dauer <= 600)) e.dauer = null;
  }
  let tag = null, datumFehler = "";
  m = nimm(/(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?(?![\d])/);
  if (m) {
    let j = m[3] ? +m[3] : tag0.getFullYear(); if (j < 100) j += 2000;
    const d = new Date(j, +m[2] - 1, +m[1], 12);
    if (d.getMonth() === +m[2] - 1 && d.getDate() === +m[1]) { tag = d; if (!m[3] && tag < tag0) tag = new Date(j + 1, +m[2] - 1, +m[1], 12); }
    else datumFehler = `${m[1]}.${m[2]}.${m[3] || ""}`;
  }
  if (!tag) {
    m = nimm(new RegExp(`(?<![\\d.])(\\d{1,2})\\.?\\s*(${monatMuster(MONAT_ALLE)})\\.?(?:\\s+(\\d{4}))?(?![\\wäöüÄÖÜß])`, "i"));
    if (m) {
      const mi = MONAT_ALLE[m[2].toLowerCase()], j = m[3] ? +m[3] : tag0.getFullYear(), dm = new Date(j, mi, +m[1], 12);
      if (dm.getMonth() === mi && dm.getDate() === +m[1]) { tag = dm; if (!m[3] && tag < tag0) tag = new Date(j + 1, mi, +m[1], 12); }
      else datumFehler = `${m[1]}. ${m[2]}`;
    }
  }
  if (!tag) { m = nimm(/\bin\s+(\d{1,3})\s*(tagen|tage|tag|wochen|woche|days?|weeks?)\b/i); if (m) tag = addDays(tag0, +m[1] * (/^w/i.test(m[2]) ? 7 : 1)); }
  if (!tag) {   // grobe Zeitangaben: die Frist ist das Ende des Zeitraums (Wochen: Freitag), „Anfang“ der 5., „Mitte“ der 15.
    const freitag = n => addDays(tag0, 4 - wochentagNr(tag0) + 7 * n);   // Freitag der Woche (0 = diese, 1 = nächste, 2 = übernächste)
    const wochentagIn = n => { const x = nimm(new RegExp(`\\b(${Object.keys(TAG_NAMEN).join("|")})\\b`, "i")); return x ? addDays(tag0, 7 * n - wochentagNr(tag0) + TAG_NAMEN[x[1].toLowerCase()]) : freitag(n); };
    const grenze = "(?<![\\wäöüß])", ende = "(?![\\wäöüß])";
    if (nimm(new RegExp(`${grenze}(?:bis\\s+)?(?:übern(?:ä|ae)chste[nrms]?\\s+woche|week\\s+after\\s+next)${ende}`, "i"))) tag = wochentagIn(2);
    else if (nimm(new RegExp(`${grenze}(?:bis\\s+)?(?:(?:n(?:ä|ae)chste[nrms]?|kommende[nrms]?)\\s+woche|next\\s+week)${ende}`, "i"))) tag = wochentagIn(1);
    else if (nimm(new RegExp(`${grenze}(?:bis\\s+)?(?:diese[nrms]?\\s+woche|this\\s+week|ende\\s+(?:der|dieser)\\s+woche|end\\s+of\\s+(?:the|this)\\s+week)${ende}`, "i"))) { tag = wochentagIn(0); if (tag < tag0) tag = tag0; }
    else if (nimm(new RegExp(`${grenze}(?:bis\\s+)?(?:(?:n(?:ä|ae)chste[nrms]?|kommende[nrms]?)\\s+monat|next\\s+month)${ende}`, "i"))) tag = new Date(tag0.getFullYear(), tag0.getMonth() + 2, 0, 12);
    else if (nimm(new RegExp(`${grenze}(?:bis\\s+)?(?:diese[nrms]?\\s+monat|this\\s+month|ende\\s+(?:des\\s+)?monats|end\\s+of\\s+(?:the\\s+|this\\s+)?month)${ende}`, "i"))) tag = new Date(tag0.getFullYear(), tag0.getMonth() + 1, 0, 12);
    else if (nimm(new RegExp(`${grenze}(?:am\\s+|dieses\\s+|diesem\\s+|this\\s+)?(?:wochenende|weekend)${ende}`, "i"))) tag = addDays(tag0, Math.max(5 - wochentagNr(tag0), 0));
    else {
      const mm = rest.match(new RegExp(`${grenze}(?:(bis\\s+(?:zum\\s+|spätestens\\s+)?|im\\s+|zum\\s+|in\\s+|by\\s+|until\\s+)?(?:(anfang|mitte|ende|early|mid|late|beginning\\s+of|end\\s+of)\\s+(?:des\\s+|im\\s+|the\\s+)?)?)(${monatMuster(MONATE_VOLL)})${ende}`, "i"));
      if (mm && (mm[1] || mm[2])) {   // „im Dezember“, „Ende Dezember“ – ein einzelnes Wort „Dezember“ bleibt im Namen
        const mi = MONATE_VOLL[mm[3].toLowerCase()], mod = (mm[2] || "").toLowerCase(), j = mi < tag0.getMonth() ? tag0.getFullYear() + 1 : tag0.getFullYear();
        const letzter = new Date(j, mi + 1, 0, 12).getDate(), wunsch = /anfang|early|beginning/.test(mod) ? 5 : /mitte|mid/.test(mod) ? 15 : letzter;
        tag = new Date(j, mi, Math.min(wunsch, letzter), 12); if (tag < tag0) tag = tag0;   // laufender Monat: nicht in die Vergangenheit
        rest = rest.slice(0, mm.index) + " " + rest.slice(mm.index + mm[0].length);
      }
    }
  }
  if (!tag) for (const [wort, v] of [["übermorgen", 2], ["uebermorgen", 2], ["day after tomorrow", 2], ["morgen", 1], ["tomorrow", 1], ["heute", 0], ["today", 0]]) if (nimm(new RegExp(`(?<![\\wäöüÄÖÜß])${wort}(?![\\wäöüÄÖÜß])`, "i"))) { tag = addDays(tag0, v); break; }
  if (!tag) { m = nimm(new RegExp(`\\b(${Object.keys(TAG_NAMEN).join("|")})\\b`, "i")); if (m) tag = addDays(tag0, ((TAG_NAMEN[m[1].toLowerCase()] - wochentagNr(tag0)) % 7 + 7) % 7 || 7); }
  if (!tag && e.uhrzeit) { const [hh, mm] = e.uhrzeit.split(":").map(Number); tag = new Date(tag0.getFullYear(), tag0.getMonth(), tag0.getDate(), hh, mm) >= jetzt ? tag0 : addDays(tag0, 1); }
  e.datum = tag ? iso(tag) : "";
  const woerter = rest.trim().split(/\s+/).filter(Boolean), weg = w => FUELLWOERTER.has(w.toLowerCase().replace(/^[,;.\-–]+|[,;.\-–]+$/g, ""));
  while (woerter.length && weg(woerter[0])) woerter.shift();
  while (woerter.length && weg(woerter[woerter.length - 1])) woerter.pop();
  e.name = woerter.join(" ").replace(/^[\s,;\-–:]+|[\s,;\-–:]+$/g, "");
  if (!e.name) return null;
  if (!e.typ) e.typ = e.uhrzeit ? "termin" : "aufgabe";
  if (datumFehler) e.fehler = t("Dieses Datum gibt es nicht") + ": " + datumFehler;
  return e;
}
/* Mahlzeiten und Buchungen aus einem Satz: „Mittag Nudeln 650 kcal“, „Mensa 4,50 €“, „+ 300 € Gehalt“ */
const SCHNELL_MAHLZEITEN = [[/^\s*fr(?:ü|ue)hst(?:ü|ue)ck\b[:\s]*/i, "Frühstück"], [/^\s*breakfast\b[:\s]*/i, "Frühstück"], [/^\s*mittagessen\b[:\s]*/i, "Mittagessen"], [/^\s*mittag\b[:\s]*/i, "Mittagessen"], [/^\s*lunch\b[:\s]*/i, "Mittagessen"],
  [/^\s*abendessen\b[:\s]*/i, "Abendessen"], [/^\s*dinner\b[:\s]*/i, "Abendessen"], [/^\s*(?:snack|zwischenmahlzeit)\b[:\s]*/i, "Snack"]];
function schnellMahlzeitParsen(text, jetzt = new Date(), kategorien = ["Uni"]) {
  let rest = String(text).trim(), mz = null, kcal = 0;
  for (const [re, name] of SCHNELL_MAHLZEITEN) { const m = rest.match(re); if (m) { mz = name; rest = rest.slice(m[0].length); break; } }
  const k = rest.match(/(?:^|\s)(\d{2,4})\s*(?:kcal|kalorien|cal)\b\.?/i);
  if (k) { kcal = +k[1]; rest = rest.replace(k[0], " "); }
  if (!mz && !k) return null;
  const e = schnellParsen(rest, jetzt, kategorien); if (!e) return null;
  if (!mz) { const h0 = e.uhrzeit ? +e.uhrzeit.slice(0, 2) : jetzt.getHours(); mz = h0 < 10 ? "Frühstück" : h0 < 15 ? "Mittagessen" : h0 < 21 ? "Abendessen" : "Snack"; }
  const res = { art: "essen", gericht: e.name, mahlzeit: mz, kcal, datum: e.datum, uhrzeit: e.uhrzeit };
  if (e.fehler) res.fehler = e.fehler;
  return res;
}
const SCHNELL_BUCHUNG_KATEGORIEN = [[/mensa|essen|einkauf|rewe|edeka|lidl|aldi|kaufland|penny|netto|bäcker|baecker|supermarkt|lebensmittel|kaffee|pizza|döner|doener/i, "Lebensmittel"],
  [/miete|strom|nebenkosten|wg\b|internet/i, "Wohnen"], [/semesterbeitrag|buch|bücher|skript|kopier|studiengeb|uni\b/i, "Uni"], [/bahn|bus\b|ticket|tank|benzin|zug|fahrrad|deutschlandticket/i, "Mobilität"],
  [/kino|bar\b|party|konzert|spiel|restaurant|freizeit|ausgehen/i, "Freizeit"], [/netflix|spotify|abo\b|amazon prime|handyvertrag|vertrag/i, "Abos"], [/apotheke|arzt|zahnarzt|medikament|krankenkasse/i, "Gesundheit"],
  [/gehalt|lohn|nebenjob|job\b|werkstudent|trinkgeld/i, "Job"], [/bafög|bafoeg|kindergeld|unterstützung|taschengeld|eltern/i, "Unterstützung"]];
function schnellBuchungErkennen(text, jetzt = new Date(), kategorien = ["Uni"]) {
  let rest = " " + String(text).trim() + " ";
  const zahl = "(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";
  const m = rest.match(new RegExp(`(?<=\\s)([+\\-−])?\\s*${zahl}\\s*(?:€|eur\\b|euro\\b)`, "i")) || rest.match(new RegExp(`(?<=\\s)([+\\-−])?\\s*(?:€)\\s*${zahl}(?![\\d])`, "i"));
  if (!m) return null;
  const betragText = m[2], b = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(betragText) ? parseFloat(betragText.replace(/\./g, "").replace(",", ".")) : parseFloat(betragText.replace(",", "."));
  if (!(b > 0)) return null;
  rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length);
  let kategorie = null;
  for (const tok of (rest.match(/#\S+/g) || [])) { const n = BUDGET_KATEGORIEN.find(k => k.toLowerCase() === tok.slice(1).toLowerCase()); if (n) { kategorie = n; rest = rest.replace(tok, " "); } }
  const einnahme = m[1] === "+" || /\b(einnahme|gehalt|lohn|bafög|bafoeg|einzahlung|taschengeld|kindergeld|erhalten|bekommen|geschenkt|trinkgeld)\b/i.test(rest);
  const e = schnellParsen(rest.trim() ? rest : "x", jetzt, kategorien);
  let beschreibung = e && rest.trim() ? e.name : rest.trim();
  beschreibung = beschreibung.replace(/^[\s,;\-–:+]+|[\s,;\-–:+]+$/g, "");
  if (!kategorie) { const z = SCHNELL_BUCHUNG_KATEGORIEN.find(([re]) => re.test(beschreibung)); kategorie = z ? z[1] : (einnahme ? "Job" : "Sonstiges"); }
  const res = { art: "buchung", buchart: einnahme ? "Einnahme" : "Ausgabe", betrag: Math.round(b * 100) / 100, beschreibung: beschreibung || (einnahme ? "Einnahme" : "Ausgabe"), kategorie, datum: e && rest.trim() ? e.datum : "", wiederholung: e && rest.trim() ? e.wiederholung : "keine" };
  if (e && e.fehler) res.fehler = e.fehler;
  return res;
}
function schnellErkennen(text, jetzt = new Date(), kategorien = ["Uni"]) {   // Buchung, Mahlzeit oder Aufgabe/Termin
  const b = schnellBuchungErkennen(text, jetzt, kategorien); if (b) return b;
  if (einst.essen_an !== false) { const m = schnellMahlzeitParsen(text, jetzt, kategorien); if (m) return m; }
  return schnellParsen(text, jetzt, kategorien);
}
function schnellEintragen(e) {   // legt das Erkannte an und gibt den Vorschautext zurück
  const datum = e.datum || iso(heute());
  if (e.art === "buchung") aendern(() => { daten.budget.push({ art: e.buchart, betrag: e.betrag, kategorie: e.kategorie, beschreibung: e.beschreibung, datum, enddatum: "", wiederholung: e.wiederholung || "keine", wiederholen_bis: "", ausnahmen: {} }); });
  else if (e.art === "essen") aendern(() => { daten.essen.push({ gericht: e.gericht, mahlzeit: e.mahlzeit, datum, uhrzeit: e.uhrzeit || (einst.mahlzeit_zeiten || {})[e.mahlzeit] || "", enddatum: "", wiederholung: "keine", wiederholen_bis: "", ausnahmen: {}, notiz: "", farbe: "", kcal: e.kcal || 0 }); });
  else {
    const fach = Object.keys(daten.faecher).sort((a, b) => b.length - a.length).find(f => e.name.toLowerCase().includes(f.toLowerCase())) || "";
    aendern(() => { daten.aufgaben.push({ name: e.name, typ: e.typ, dauer: e.dauer || (e.typ === "termin" ? einst.termin_dauer : 30), prio: e.prio, kategorie: e.kategorie || einst.kategorien[0], fach, raum: "", dozent: "", vorlauf: 0, notiz: "", checkliste: [], datum, uhrzeit: e.uhrzeit, enddatum: "", wiederholung: e.wiederholung || "keine", wiederholen_bis: "", erledigt: false, erledigt_tage: [], farbe: "", ausnahmen: {} }); });
  }
  return schnellVorschau({ ...e, datum });
}
function schnellVorschau(e) {
  if (e.art === "buchung") {
    const d = e.datum ? parseISO(e.datum) : null, diff = d ? diffDays(d, heute()) : 0;
    return [t(e.buchart) + ": " + euroText(e.betrag), e.beschreibung, T(e.kategorie), d ? (diff === 0 ? t("heute") : diff === 1 ? t("morgen") : diff === -1 ? t("gestern") : `${kurzTag(wochentagNr(d))} ${deKurz(d)}`) : t("heute"), e.wiederholung && e.wiederholung !== "keine" ? "↻ " + t(e.wiederholung) : ""].filter(Boolean).join("  ·  ");
  }
  if (e.art === "essen") {
    const d = e.datum ? parseISO(e.datum) : null, diff = d ? diffDays(d, heute()) : 0;
    return [t("Essen") + ": " + t(e.mahlzeit), e.gericht, e.kcal ? `${e.kcal} kcal` : "", d ? (diff === 0 ? t("heute") : diff === 1 ? t("morgen") : `${kurzTag(wochentagNr(d))} ${deKurz(d)}`) : t("heute"), e.uhrzeit ? e.uhrzeit + t(" Uhr") : ""].filter(Boolean).join("  ·  ");
  }
  const teile = [t(e.typ === "termin" ? "Termin" : "Aufgabe") + ": " + e.name];
  if (e.datum) { const d = parseISO(e.datum), diff = diffDays(d, heute()); teile.push(diff === 0 ? t("heute") : diff === 1 ? t("morgen") : `${kurzTag(wochentagNr(d))} ${deKurz(d)}`); }
  if (e.uhrzeit) teile.push(e.uhrzeit + t(" Uhr"));
  if (e.dauer) teile.push(e.dauer >= 60 && e.dauer % 60 === 0 ? `${e.dauer / 60} h` : `${e.dauer} ${t("Min")}`);
  if (e.kategorie) teile.push("#" + e.kategorie);
  if (e.prio === 1) teile.push(t("wichtig")); else if (e.prio === 3) teile.push(t("niedrige Priorität"));
  if (e.wiederholung && e.wiederholung !== "keine") teile.push("↻ " + t(e.wiederholung));
  return teile.join("  ·  ");
}
function schnellBuchungParsen(text) {
  text = String(text).trim(); const zahl = "(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";
  let m = text.match(new RegExp(`^${zahl}\\s*(?:€|eur|euro)?\\s*(.*)$`, "i")), betrag, rest;
  if (m) { betrag = m[1]; rest = m[2]; }
  else { m = text.match(new RegExp(`^(.*?)\\s+${zahl}\\s*(?:€|eur|euro)?$`, "i")); if (!m) return null; rest = m[1]; betrag = m[2]; }
  const b = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(betrag) ? parseFloat(betrag.replace(/\./g, "").replace(",", ".")) : parseFloat(betrag.replace(",", ".")); if (!(b > 0)) return null;   // "1.200" und "1.200,50" sind Tausender
  return [Math.round(b * 100) / 100, rest.trim()];
}

/* ---------- Startseite "Heute" ---------- */
function kalorienKarte(tag) {
  const k = kalorienTag(daten, tag), ziel = einst.kalorien_ziel || 0, mit = k.eintraege.filter(e => e.kcal !== null);
  const stat = !(einst.reiter_aus || []).includes("statistik");
  return h("div", { class: "card", "data-karte": "kalorien" }, h("h3", null, "Kalorien heute"),
    h("div", { class: "gross" }, R(`${k.summe} kcal`)),
    ziel ? h("div", { style: "margin:6px 0" }, fortschritt(k.summe / ziel, false), h("div", { class: "mut small" }, R(k.summe <= ziel ? `${t("Noch übrig: ")}${ziel - k.summe} kcal` : `${t("Über dem Ziel: ")}${k.summe - ziel} kcal`))) : null,
    mit.length ? h("div", { class: "list", style: "margin-top:6px" }, mit.map(e => h("div", { class: "row sb small", style: "padding:2px 0" }, h("span", null, R(`${t(e.v.mahlzeit)}: ${e.v.gericht}`)), h("span", { class: "mut" }, R(`${e.kcal} kcal`))))) : null,
    k.ohne ? h("div", { class: "mut small", style: "margin-top:4px" }, R(`${k.ohne} `), "Mahlzeit(en) ohne Kalorienangabe") : null,
    !k.eintraege.length ? h("div", { class: "mut" }, "Noch keine Mahlzeit für heute eingetragen.") : null,
    h("div", { class: "row", style: "margin-top:8px" },
      !(einst.reiter_aus || []).includes("essen") ? h("button", { class: "btn sm", onclick: () => { ui.tab = "essen"; ui.essen = "kalorien"; ui.kalTag = null; uiSpeichern(); render(); window.scrollTo(0, 0); } }, "Kalorienzähler öffnen") : null,
      stat ? h("button", { class: "btn sm", onclick: () => { ui.tab = "statistik"; ui.statMo = null; uiSpeichern(); render(); window.scrollTo(0, 0); } }, "Statistik öffnen") : null));
}
function heuteTab() {
  const tag = heute(), hh = new Date().getHours();
  const gruss = hh < 11 ? "Guten Morgen" : hh < 18 ? "Guten Tag" : "Guten Abend";
  const eing = h("input", { type: "text", placeholder: "Mathe-Klausur Freitag 14 Uhr", style: "flex:1;min-width:200px;font-size:16px" });
  const tipp = "Tippe einen Satz, zum Beispiel „Lernen morgen 9-11 Uhr #Uni“, „Mittag Nudeln 650 kcal“ oder „Mensa 4,50 €“.";
  const vorschau = h("p", { class: "mut small", style: "margin:8px 0 0" }, tipp);
  eing.oninput = () => {
    const tx = eing.value.trim();
    if (!tx) { vorschau.textContent = t(tipp); vorschau.style.color = ""; return; }
    const e = schnellErkennen(tx, new Date(), einst.kategorien);
    vorschau.style.color = e ? (e.fehler ? "var(--bad)" : "var(--acc)") : "";
    vorschau.textContent = e ? (e.fehler ? e.fehler : "→ " + schnellVorschau(e) + (e.datum ? "" : "  ·  heute")) : t("Noch kein Name erkannt …");
  };
  const anlegen = () => {
    const e = schnellErkennen(eing.value, new Date(), einst.kategorien);
    if (!e) { vorschau.style.color = "var(--bad)"; vorschau.textContent = t("Ich brauche mindestens einen Namen, zum Beispiel „Mathe lernen morgen 10 Uhr“."); return; }
    if (e.fehler) { vorschau.style.color = "var(--bad)"; vorschau.textContent = e.fehler; return; }
    toast("Angelegt: " + schnellEintragen(e), true);
  };
  eing.onkeydown = ev => { if (ev.key === "Enter") anlegen(); };
  const schnell = h("div", { class: "card", style: "margin-top:14px" }, h("h3", null, "Schnell hinzufügen"), h("div", { class: "row" }, eing, h("button", { class: "btn pri", onclick: anlegen }, "Hinzufügen")), vorschau);

  const eintr = eintraegeAm(tag).sort((a, b) => {
    const ea = a.art !== "essen" && istErledigt(a.v, tag), eb = b.art !== "essen" && istErledigt(b.v, tag);
    return (ea - eb) || String(zeitVon(a) || "99:99").localeCompare(String(zeitVon(b) || "99:99"));
  });
  const liste = eintr.map(it => {
    const erl = it.art !== "essen" && istErledigt(it.v, tag);
    return h("div", { class: "li" },
      it.art !== "essen" ? h("input", { type: "checkbox", checked: erl, onchange: () => aendern(() => erledigtUmschalten(it.v._quelle, parseISO(it.v._start || iso(tag)))) }) : h("span", { style: "width:20px;flex:none" }),
      h("span", { class: "mut", style: "width:48px;flex:none;font-variant-numeric:tabular-nums" }, R(zeitVon(it) || "–")),
      h("div", { class: "tx", style: (erl ? "text-decoration:line-through;opacity:.55;" : "") + "cursor:pointer", onclick: () => eintragOeffnen(it) }, h("b", null, R(titelVon(it)))),
      h("span", { class: "dot", style: `background:${farbeVon(it.v, it.art)}` }));
  });
  const heuteKarte = h("div", { class: "card" }, h("h3", null, "Heute"), eintr.length ? h("div", { class: "list" }, liste) : leer("Heute ist nichts geplant. Schreib oben etwas hin oder genieß den freien Tag."),
    h("div", { class: "row", style: "margin-top:10px" }, h("button", { class: "btn sm", onclick: () => { ui.tab = "kalender"; ui.ansicht = "woche"; ui.tag = tag; render(); } }, "Woche ansehen")));

  const geh = (tab, extra) => () => { ui.tab = tab; if (extra) Object.assign(ui, extra); uiSpeichern(); render(); window.scrollTo(0, 0); };
  const karte = (titel, inhalt, knopf, ziel) => h("div", { class: "card" }, h("h3", null, titel), inhalt, h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn sm", onclick: ziel }, knopf)));
  const ue = ueberfaelligeAufgaben(daten).length, fr = fristenListe(daten, tag).slice(0, 4);
  const fristZeilen = (ue ? [`⚠ ${ue} ${t("überfällige Aufgabe(n)")}`] : []).concat(fr.map(f => `${f.name} – ${t(tageText(f.tage))}`));
  const offenEk = daten.einkauf.filter(e => !e.gekauft).map(e => e.text);
  const fp = fachFortschritt(daten, montagVon(tag)).filter(f => f.ziel).slice(0, 4);
  const [ein, aus] = budgetSummen(budgetImMonat(daten, tag.getFullYear(), tag.getMonth() + 1)), limit = einst.budget_limit || 0;
  const morgen = eintraegeAm(addDays(tag, 1));
  const rechts = h("div", null,
    karte("Fristen", h("div", { class: "zeile" }, R(fristZeilen.length ? fristZeilen.join("\n") : t("Keine offenen Fristen. Gut so!"))), "Alle Aufgaben", geh("fristen")),
    karte("Einkaufsliste", h("div", { class: "zeile" }, R(offenEk.length ? `${offenEk.length} Artikel offen: ${offenEk.slice(0, 3).join(", ")}${offenEk.length > 3 ? " …" : ""}` : t("Die Liste ist leer."))), "Liste öffnen", geh("essen", { essen: "einkauf" })),
    karte("Lernziele diese Woche", fp.length ? h("div", null, fp.map(f => h("div", { style: "margin:4px 0" }, h("div", { class: "row sb small" }, h("span", null, R(f.name)), h("span", { class: "mut" }, R(`${stundenText(f.erledigt)} / ${stundenText(f.ziel)}`))), fortschritt(f.erledigt / f.ziel, f.erledigt >= f.ziel)))) : h("div", { class: "mut" }, "Lege unter „Lernziele“ ein Wochenziel für dein erstes Fach fest."), "Lernziele öffnen", geh("faecher")),
    einst.kalorien_an !== false && einst.essen_an !== false ? kalorienKarte(tag) : null,
    karte("Budget", h("div", null, h("div", { class: "gross" + ((limit ? limit - aus : ein - aus) < 0 ? " neg" : "") }, R(limit ? (limit - aus >= 0 ? `${t("Noch übrig: ")}${euroText(limit - aus)}` : `${t("Überzogen: ")}${euroText(aus - limit)}`) : `${t("Saldo: ")}${euroText(ein - aus)}`)), h("div", { class: "mut small" }, R(`${t("Ausgaben")} ${euroText(aus)}`))), "Übersicht öffnen", geh("geld", { geld: "uebersicht" })),
    karte("Morgen", h("div", { class: "zeile" }, R(morgen.length ? morgen.slice(0, 4).map(it => (zeitVon(it) ? zeitVon(it) + "  " : "") + titelVon(it)).join("\n") + (morgen.length > 4 ? `\n… +${morgen.length - 4}` : "") : t("Morgen ist noch frei."))), "Woche ansehen", geh("kalender", { ansicht: "woche", tag: addDays(tag, 1) })));
  return h("div", null, h("div", { class: "row sb" }, h("h1", { class: "hgruss" }, gruss), (() => { const w = ui.wetter.tage[iso(tag)]; return w ? h("span", { class: "mut", style: "font-size:16px" }, R(`${wetterSymbol(w.code)}  ${w.max}° / ${w.min}°${ui.wetter.name ? "   " + ui.wetter.name.split(",")[0] : ""}`)) : wetterKnopf(); })()),
    h("div", { class: "mut" }, R(`${wochentagName(wochentagNr(tag))}, ${tag.getDate()}${sprache === "de" ? "." : ""} ${monatName(tag.getMonth())} ${tag.getFullYear()}`)),
    schnell, h("div", { style: "margin-top:14px" }, sicherungsKarte()), h("div", { class: "hgrid" }, heuteKarte, rechts));
}

/* ---------- Noten und ECTS ---------- */
const noteParsen = tx => { const n = parseFloat(String(tx).trim().replace(",", ".")); return n >= 1 && n <= 6 ? Math.round(n * 100) / 100 : null; };
const noteText = n => { let s = n.toFixed(2); if (s.endsWith("0")) s = s.slice(0, -1); return s.replace(".", ","); };
function notenZusammenfassung(noten) {
  /* Mehrere Versuche derselben Prüfung (gleiches Fach und gleicher Titel): ein bestandener Versuch ersetzt durchgefallene,
     bei mehreren bestandenen zählt der neueste. Ohne ECTS-Punkte zählt eine Note nicht in den gewichteten Schnitt,
     solange andere Noten ECTS haben (sonst würde sie den Schnitt verzerren). */
  const schl = n => String(n.fach || "").trim().toLowerCase() + "|" + String(n.titel || "").trim().toLowerCase();
  const gruppen = new Map(), ersetzt = new Set();
  for (const n of noten) { const k = schl(n); if (!gruppen.has(k)) gruppen.set(k, []); gruppen.get(k).push(n); }
  const neuste = l => l.slice().sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")))[0];
  const zaehlt = []; let durch = 0;
  for (const g of gruppen.values()) {
    const ok = g.filter(n => n.note <= 4), gilt = ok.length ? neuste(ok) : neuste(g);
    for (const n of g) if (n !== gilt) ersetzt.add(n);
    if (gilt.note > 4) durch++; else zaehlt.push(gilt);
  }
  const mitEcts = zaehlt.some(n => n.ects > 0);
  let gs = 0, pr = 0, ects = 0, ohneEcts = 0;
  for (const n of zaehlt) { ects += n.ects || 0; const g = mitEcts ? (n.ects || 0) : 1; if (!g) { ohneEcts++; continue; } gs += g; pr += g * n.note; }
  return { schnitt: gs ? pr / gs : null, ects, durch, anzahl: gruppen.size, ohneEcts, ersetzt };
}
function notenTab() {
  const ziel = einst.ects_ziel === undefined ? 180 : einst.ects_ziel, z = notenZusammenfassung(daten.noten);
  const liste = daten.noten.slice().sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")));
  const kopf = h("div", { class: "card", style: "display:flex;gap:28px;align-items:center;flex-wrap:wrap" },
    h("div", { style: "text-align:center;min-width:120px" }, h("div", { class: "gross" }, R(z.schnitt === null ? "–" : z.schnitt.toFixed(2).replace(".", ","))), h("div", { class: "mut small" }, "Notenschnitt")),
    h("div", { style: "flex:1;min-width:220px" }, h("b", null, R(`${+z.ects.toFixed(1)}${ziel ? " / " + ziel : ""} ECTS`)), h("div", { style: "margin:8px 0" }, fortschritt(ziel ? z.ects / ziel : 0, ziel && z.ects >= ziel)),
      h("div", { class: "mut small" }, R(z.anzahl ? `${z.anzahl} ${t(z.anzahl === 1 ? "Prüfung" : "Prüfungen")}${z.durch ? `, ${t("davon")} ${z.durch} ${t("nicht bestanden")}` : ""}${z.ohneEcts ? ` · ${z.ohneEcts} ${t("ohne ECTS, nicht im Schnitt")}` : ""}` : ""))));
  const zeilen = liste.map(n => h("tr", { style: z.ersetzt.has(n) ? "opacity:.55" : n.note > 4 ? "background:color-mix(in srgb,var(--bad) 14%,transparent)" : "" }, h("td", null, R(n.fach)), h("td", null, R(n.titel || "")), h("td", { class: "r" }, R(noteText(n.note))), h("td", { class: "r" }, R(n.ects ? String(n.ects).replace(".", ",") : "–")), h("td", null, R(n.datum ? deDatum(n.datum) : "")),
    h("td", { class: "r" }, h("button", { class: "btn sm", onclick: () => noteDialog(n) }, "Bearbeiten"))));
  return h("div", null, h("p", { class: "mut", style: "margin:0 0 12px" }, "Trage deine Prüfungsnoten und ECTS-Punkte ein. Der Schnitt ist nach ECTS gewichtet; nur bestandene Prüfungen (bis 4,0) zählen."), kopf,
    h("div", { class: "row", style: "margin:14px 0" }, h("button", { class: "btn", onclick: zielDialog }, "ECTS-Ziel …")),
    h("div", { class: "card tbl" }, liste.length ? h("table", null, h("thead", null, h("tr", null, h("th", null, "Fach"), h("th", null, "Prüfung"), h("th", { class: "r" }, "Note"), h("th", { class: "r" }, "ECTS"), h("th", null, "Datum"), h("th"))), h("tbody", null, zeilen)) : leer("Noch keine Noten. Trage mit „+ Neu“ eine Note ein, sobald du eine Prüfung zurückbekommen hast (am Handy: „+“ in der unteren Leiste).")));
}
function zielDialog() {
  const z = h("input", { type: "number", min: 0, max: 1000, step: 1, value: einst.ects_ziel === undefined ? 180 : einst.ects_ziel });
  dialog("ECTS-Ziel", [feld("ECTS insgesamt (0 = kein Ziel)", z)], [{ text: "Abbrechen" }, { text: "Speichern", art: "pri", fn: () => { setzen("ects_ziel", Math.max(0, Math.min(1000, Math.round(+z.value || 0))), true); } }]);
}
function noteDialog(n) {
  const alt = !!n, o = n || {};
  const fach = h("input", { type: "text", value: o.fach || "" }), titel = h("input", { type: "text", value: o.titel || "", placeholder: "z. B. Klausur" });
  const note = h("input", { type: "text", value: o.note ? noteText(o.note) : "", inputmode: "decimal", placeholder: "1,7" }), ects = h("input", { type: "number", min: 0, max: 60, step: 0.5, value: o.ects || "" });
  const datum = h("input", { type: "date", value: o.datum || iso(heute()) });
  dialog(alt ? "Note bearbeiten" : "Neue Note", [feld("Fach", fach), feld("Prüfung", titel), h("div", { class: "grid2" }, feld("Note (1,0 bis 6,0)", note), feld("ECTS-Punkte", ects), feld("Datum", datum))], [
    ...(alt ? [{ text: "Löschen", art: "bad", fn: () => aendern(() => { const i = daten.noten.indexOf(n); if (i >= 0) daten.noten.splice(i, 1); }) }] : []), { text: "Abbrechen" },
    { text: "Speichern", art: "pri", fn: () => {
      const nt = noteParsen(note.value), e = parseFloat(String(ects.value).replace(",", ".")) || 0;
      if (!fach.value.trim()) { toast("Bitte ein Fach eintragen."); return false; }
      if (nt === null) { toast("Note: bitte eine Zahl von 1,0 bis 6,0 eingeben (z. B. 1,7)."); return false; }
      if (e < 0 || e > 60) { toast("ECTS: bitte eine Zahl von 0 bis 60 eingeben."); return false; }
      aendern(() => { const z = alt ? n : {}; Object.assign(z, { fach: fach.value.trim(), titel: titel.value.trim(), note: nt, ects: e, datum: datum.value || iso(heute()) }); if (!alt) daten.noten.push(z); });
    } }]);
}

/* ---------- Einkauf & Geld ---------- */
function geldTab() { return h("div", null, budgetTab()); }
function essenTab() {
  const subs = [["einkauf", "Einkaufsliste"]]; if (einst.rezepte_an) subs.push(["rezepte", "Rezepte & Preise"]); if (einst.kalorien_an !== false) subs.push(["kalorien", "Kalorien"]);
  if (!subs.some(s => s[0] === ui.essen)) ui.essen = "einkauf";
  const inh = ui.essen === "einkauf" ? einkaufListeNeu() : ui.essen === "kalorien" ? kalorienSeite() : einkaufTab();
  return h("div", null, subNav(subs, ui.essen, k => { ui.essen = k; uiSpeichern(); render(); }), inh);
}
/* Meine Lebensmittel: eigene Nährwerte (z. B. von der Packung); sie haben Vorrang vor der eingebauten Tabelle und den Internet-Vorschlägen */
function lebensmittelKarte() {
  const eintraege = kalorienEintraege(daten.kalorien), bearb = ui.lmEdit ? eintraege.find(e => e.name.toLowerCase() === String(ui.lmEdit).toLowerCase()) || null : null;
  const ARTEN = [["100g", "pro 100 g"], ["100ml", "pro 100 ml"], ["Stk", "pro Stück"], ["EL", "pro EL"], ["TL", "pro TL"], ["Pck", "pro Packung"], ["pauschal", "pauschal (je Zutat)"]];
  const arten = bearb && !ARTEN.some(a => a[0] === bearb.art) ? ARTEN.concat([[bearb.art, `pro ${bearb.art}`]]) : ARTEN;
  const name = h("input", { type: "text", id: "lm-name", maxlength: 60, placeholder: "Name des Lebensmittels", value: bearb ? bearb.name : "", style: "flex:1;min-width:160px" });
  const kcal = h("input", { type: "number", id: "lm-kcal", min: 0, step: 1, placeholder: "kcal", value: bearb ? bearb.kcal : "", style: "width:90px" });
  const art = auswahl(arten, bearb ? bearb.art : "100g");
  const hinweis = h("div", { class: "mut small", "data-lm-hinweis": "1", style: "min-height:18px;margin-top:6px" });
  const hinweisZeigen = () => { const e = kcalEintrag(name.value); hinweis.textContent = !name.value.trim() ? "" : e ? `${t("Tabelle")}: ≈ ${e[1]} kcal / 100 g` : t("keine Angabe in der Tabelle"); };
  name.addEventListener("input", hinweisZeigen); hinweisZeigen();
  const speichern = () => {
    const n = name.value.trim().replace(/\s+/g, " "); if (!n) return toast("Bitte einen Namen eintragen.");
    if (/[:=]/.test(n)) return toast("Der Name darf keinen Doppelpunkt und kein Gleichheitszeichen enthalten.");
    const k = parseFloat(String(kcal.value).replace(",", ".")); if (!(k >= 0)) return toast("Bitte die Kalorien eintragen (0 oder mehr).");
    const alt = bearb ? bearb.name : null; ui.lmEdit = null;
    aendern(() => { let text = daten.kalorien || ""; if (alt && alt.toLowerCase() !== n.toLowerCase()) text = kalorienEntfernen(text, alt); daten.kalorien = kalorienSetzen(text, n, kalorienZeileAus(n, k, art.value)); });
    setTimeout(() => { const e = document.getElementById("lm-name"); if (e) e.focus(); }, 0);
  };
  name.onkeydown = kcal.onkeydown = ev => { if (ev.key === "Enter") speichern(); };
  const nach = { "100g": "/ 100 g", "100ml": "/ 100 ml", Stk: `/ ${t("Stück")}`, EL: "/ EL", TL: "/ TL", Pck: `/ ${t("Packung")}`, pauschal: "" };
  const zeile = e => { const tab = e.art === "100g" ? kcalEintrag(e.name) : null; return h("div", { class: "li", "data-lebensmittel": e.name },
    h("div", { class: "tx" }, h("b", null, R(e.name)), h("div", { class: "mut small" }, R(`${e.kcal} kcal ${e.art in nach ? nach[e.art] : "/ " + e.art}${tab ? ` · ${t("Tabelle")}: ${tab[1]}` : ""}`))),
    h("button", { class: "btn sm", "data-aktion": "lm-bearbeiten", onclick: () => { ui.lmEdit = e.name; render(); setTimeout(() => { const f = document.getElementById("lm-kcal"); if (f) f.focus(); }, 0); } }, "Bearbeiten"),
    h("button", { class: "btn sm bad", "data-aktion": "lm-loeschen", title: "Löschen", "aria-label": "Löschen", onclick: () => bestaetigen("Diesen Eintrag löschen?", () => aendern(() => { daten.kalorien = kalorienEntfernen(daten.kalorien, e.name); })) }, "✕")); };
  return h("div", { class: "card", "data-karte": "lebensmittel", style: "margin-top:14px" }, h("h3", null, "Meine Lebensmittel"),
    h("p", { class: "mut small", style: "margin:0 0 8px" }, "Eigene Nährwerte (z. B. von der Packung) haben Vorrang vor der eingebauten Tabelle und den Vorschlägen aus dem Internet. Pro Name gilt ein Wert; der Name muss genau so in der Zutat stehen (z. B. „Haferdrink“)."),
    h("div", { class: "row", style: "margin-bottom:8px" }, h("button", { class: "btn", "data-aktion": "barcode-scannen", onclick: () => barcodeDialog(barcodeVerarbeiten) }, "📷 Strichcode scannen"), h("span", { class: "mut small" }, "Holt Name und Kalorien des Produkts von Open Food Facts.")),
    h("div", { class: "row", style: "gap:8px;flex-wrap:wrap" }, name, kcal, art, h("button", { class: "btn pri", "data-aktion": "lm-speichern", onclick: speichern }, bearb ? "Speichern" : "Hinzufügen"), bearb ? h("button", { class: "btn", "data-aktion": "lm-abbrechen", onclick: () => { ui.lmEdit = null; render(); } }, "Abbrechen") : null),
    hinweis, eintraege.length ? h("div", { class: "list", style: "margin-top:6px" }, eintraege.map(zeile)) : h("div", { class: "mut small", style: "margin-top:6px" }, "Noch keine eigenen Werte."));
}
function kalorienSeite() {   // Kalorienzähler: ein Tag mit Mahlzeiten, Tagesziel und der Woche darum
  const h0 = heute(), tag = ui.kalTag ? ui.kalTag : h0, istHeute = iso(tag) === iso(h0), mo = montagVon(tag);
  const k = kalorienTag(daten, tag), ziel = einst.kalorien_ziel || 0, kw = kalorienWoche(daten, mo), kMax = Math.max(1, ziel, ...kw.tage.map(x => x.summe));
  const geh = d => () => { ui.kalTag = d; render(); };
  const nav = h("div", { class: "row sb", style: "margin-bottom:12px" },
    h("div", { class: "row" }, h("button", { class: "btn", title: "Vorheriger Tag", onclick: geh(addDays(tag, -1)) }, "‹"),
      h("b", { style: "min-width:200px;text-align:center" }, R(`${wochentagName(wochentagNr(tag))}, ${deKurz(tag)}${tag.getFullYear()}`)),
      h("button", { class: "btn", title: "Nächster Tag", onclick: geh(addDays(tag, 1)) }, "›")),
    istHeute ? null : h("button", { class: "btn sm", onclick: geh(null) }, "Heute"));
  const summeKarte = h("div", { class: "card", "data-karte": "kalorienzaehler" },
    h("div", { class: "row sb" }, h("div", null, h("div", { class: "gross" }, R(`${k.summe} kcal`)),
      ziel ? h("div", { class: "mut small" }, R(k.summe <= ziel ? `${t("Noch übrig: ")}${ziel - k.summe} kcal` : `${t("Über dem Ziel: ")}${k.summe - ziel} kcal`)) : null)),
    ziel ? h("div", { style: "margin:8px 0" }, fortschritt(k.summe / ziel, false)) : null,
    h("div", { class: "row", style: "margin-top:8px;align-items:flex-end;gap:14px;flex-wrap:wrap" }, h("div", { style: "max-width:260px" }, zahlFeld("Tagesziel (kcal, 0 = keins)", "kalorien_ziel", 0, 10000, 50)),
      h("button", { class: "btn", "data-aktion": "barcode-scannen-oben", onclick: () => barcodeDialog(barcodeVerarbeiten) }, "📷 Produkt scannen")));
  const liste = h("div", { class: "card" }, h("h3", null, "Mahlzeiten"),
    k.eintraege.length ? h("div", { class: "list" }, k.eintraege.map(e => h("div", { class: "li", style: "cursor:pointer", onclick: () => eintragDialog({ v: e.v, quelle: e.v._quelle, art: "essen", tag }) },
      h("span", { class: "mut", style: "width:48px;flex:none;font-variant-numeric:tabular-nums" }, R(e.v.uhrzeit || "–")),
      h("div", { class: "tx" }, h("b", null, R(e.v.gericht)), h("div", { class: "mut small" }, R(t(e.v.mahlzeit)))),
      e.kcal === null ? h("span", { class: "pill warn" }, "ohne Angabe") : h("b", null, R(`${e.kcal} kcal`))))) : leer("Keine Mahlzeiten an diesem Tag. Lege eine mit „+ Neu“ an."),
    k.ohne ? h("p", { class: "mut small", style: "margin:8px 0 0" }, R(`${k.ohne} `), "Mahlzeit(en) ohne Kalorienangabe") : null);
  const stat = !(einst.reiter_aus || []).includes("statistik");
  const woche = h("div", { class: "card" }, h("h3", null, "Kalorien pro Tag"),
    h("div", { class: "bars" }, kw.tage.map((x, i) => h("div", { class: "c", style: "cursor:pointer" + (iso(x.tag) === iso(tag) ? "" : ";opacity:.6"), onclick: geh(x.tag) },
      h("div", { class: "s", title: `${x.summe} kcal` }, h("i", { style: `height:${x.summe / kMax * 100}%;background:${ziel && x.summe > ziel ? "var(--bad)" : "var(--acc)"}` })),
      h("em", { style: "text-align:center;line-height:1.25" }, R(kurzTag(i)), h("br"), h("b", null, R(x.summe ? String(x.summe) : "–")))))),
    h("p", { class: "mut small", style: "margin:8px 0 0" }, R(kw.mitDaten ? `Ø ${Math.round(kw.schnitt)} kcal ${t("pro Tag")} · ${t("Summe")} ${kw.summe} kcal` : "")),
    stat ? h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn sm", onclick: () => { ui.tab = "statistik"; ui.statMo = mo; uiSpeichern(); render(); window.scrollTo(0, 0); } }, "Statistik öffnen")) : null);
  return h("div", null, nav, summeKarte, h("div", { style: "height:14px" }), liste, woche, lebensmittelKarte());
}
function budgetGross(ein, aus, limit) {
  const rest = limit - aus, saldo = ein - aus, schlecht = limit ? rest < 0 : saldo < 0;
  const text = limit ? (rest >= 0 ? `${t("Noch übrig: ")}${euroText(rest)}` : `${t("Überzogen: ")}${euroText(-rest)}`) : `${t("Saldo: ")}${euroText(saldo)}`;
  return h("div", { style: "margin:4px 0 14px" }, h("div", { class: "gross" + (schlecht ? " neg" : "") }, R(text)),
    h("div", { class: "mut small" }, limit ? R(`${t("Monatsbudget")} ${euroText(limit)}, ${t("davon")} ${euroText(aus)} ${t("ausgegeben")}.`) : "Tipp: Trage oben bei „Monatsbudget“ ein Limit ein, dann siehst du hier, wie viel noch übrig ist."));
}
function budgetSchnell() {
  const eing = h("input", { type: "text", placeholder: "8,50 Mensa", style: "flex:1;min-width:160px" });
  const kat = auswahl(BUDGET_KATEGORIEN.map(k => [k, k]), "Lebensmittel");
  const buchen = art => {
    const e = schnellBuchungParsen(eing.value); if (!e) return toast("Bitte einen Betrag eingeben, zum Beispiel „8,50 Mensa“.");
    aendern(() => { daten.budget.push({ art, betrag: e[0], kategorie: kat.value, beschreibung: e[1], datum: iso(heute()), enddatum: "", wiederholung: "keine", wiederholen_bis: "", ausnahmen: {} }); ui.budgetMonat = heute(); });
  };
  eing.onkeydown = ev => { if (ev.key === "Enter") buchen("Ausgabe"); };
  return h("div", { class: "card", style: "margin-bottom:14px" }, h("h3", null, "Schnell eintragen"), h("div", { class: "row" }, eing, kat, h("button", { class: "btn pri", onclick: () => buchen("Ausgabe") }, "Ausgabe"), h("button", { class: "btn", onclick: () => buchen("Einnahme") }, "Einnahme")),
    h("p", { class: "mut small", style: "margin:8px 0 0" }, "Betrag und Beschreibung, zum Beispiel „8,50 Mensa“ oder „Mensa 8,50“. Gebucht wird für heute."));
}
function einkaufListeNeu() {
  const eing = h("input", { type: "text", placeholder: "Was brauchst du? (mehrere mit Komma)", style: "flex:1;min-width:180px" });
  const neu = () => {
    const bestand = new Set(daten.einkauf.filter(e => !e.gekauft).map(e => e.text.toLowerCase())), texte = [];
    for (const teil of eing.value.split(/[,;\n]/)) { const tx = teil.trim().replace(/\s+/g, " "); if (tx && !bestand.has(tx.toLowerCase())) { texte.push(tx); bestand.add(tx.toLowerCase()); } }
    eing.value = "";
    if (texte.length) aendern(() => { for (const tx of texte) daten.einkauf.push({ text: tx, gekauft: false, fuer: "", preis: null }); });
  };
  eing.onkeydown = ev => { if (ev.key === "Enter") neu(); };
  const liste = daten.einkauf.slice().sort((a, b) => (a.gekauft ? 1 : 0) - (b.gekauft ? 1 : 0)), offen = liste.filter(e => !e.gekauft).length;
  const aus = () => {
    const [l, ohne, n] = einkaufslisteBauen(daten, montagVon(heute()), addDays(montagVon(heute()), 6), {});
    const bestand = new Set(daten.einkauf.filter(e => !e.gekauft).map(e => e.text.toLowerCase())), neue = l.filter(x => !bestand.has(x.text.toLowerCase()));
    if (neue.length) aendern(() => { for (const x of neue) daten.einkauf.push({ text: x.text, gekauft: false, fuer: x.gerichte || "", preis: x.kosten }); });
    toast(n ? `${neue.length} Zutaten aus ${n} Mahlzeit(en) hinzugefügt.` : "Im Zeitraum sind keine Mahlzeiten im Essensplan.", true);
  };
  const kopf = !liste.length ? "Die Liste ist leer. Tippe oben ein, was du brauchst." : offen ? `${offen} Artikel noch zu kaufen` : "Alles gekauft! Schließe den Einkauf ab, um ihn zu buchen.";
  return h("div", null, h("p", { class: "mut", style: "margin:0 0 12px" }, "Schreib auf, was du brauchst, und hake es beim Einkaufen ab. Mit „Einkauf abschließen“ landet der Betrag direkt im Budget."),
    ekErinnerungZeile(),
    h("div", { class: "row" }, eing, h("button", { class: "btn pri", onclick: neu }, "Hinzufügen"), einst.rezepte_an ? h("button", { class: "btn", onclick: aus }, "Aus Essensplan übernehmen …") : null),
    h("p", { style: "font-weight:600;margin:14px 0 8px" }, kopf),
    h("div", { class: "card" }, liste.length ? h("div", { class: "list" }, liste.map(e => h("div", { class: "li" },
      h("input", { type: "checkbox", checked: e.gekauft, onchange: () => aendern(() => { e.gekauft = !e.gekauft; }) }),
      h("div", { class: "tx", style: e.gekauft ? "text-decoration:line-through;opacity:.55" : "" }, h("b", null, R(e.text)), e.fuer || e.preis != null ? h("div", { class: "mut small" }, R([e.fuer, e.preis != null ? `ca. ${euroText(e.preis)}` : ""].filter(Boolean).join(" · "))) : null),
      h("button", { class: "btn sm ghost", title: "Entfernen", onclick: () => aendern(() => { const i = daten.einkauf.indexOf(e); if (i >= 0) daten.einkauf.splice(i, 1); }) }, "✕")))) : leer("Noch nichts auf der Liste.")),
    h("div", { class: "row", style: "margin-top:14px" }, h("button", { class: "btn pri", onclick: einkaufAbschluss }, "Einkauf abschließen …"),
      h("button", { class: "btn", disabled: !offen, onclick: async () => { const text = liste.filter(e => !e.gekauft).map(e => "- " + e.text).join("\n"); if (!(await kopieren(text))) dateiAngebot("einkaufsliste.txt", text, "text/plain", "Einkaufsliste"); } }, "Liste kopieren")));
}
function einkaufAbschluss() {
  const gekauft = daten.einkauf.filter(e => e.gekauft), schaetz = gekauft.reduce((s, e) => s + (e.preis || 0), 0);
  const betrag = h("input", { type: "number", min: 0, step: 0.01, value: schaetz ? schaetz.toFixed(2) : "" }), wo = h("input", { type: "text", placeholder: "z. B. Rewe" }), datum = h("input", { type: "date", value: iso(heute()) });
  dialog("Einkauf abschließen", [h("div", { class: "grid2" }, feld("Gesamtbetrag (€)", betrag), feld("Datum", datum)), feld("Wo? (optional)", wo)], [{ text: "Abbrechen" }, { text: "Buchen", art: "pri", fn: () => {
    const b = parseFloat(String(betrag.value).replace(",", ".")); if (!(b > 0)) { toast("Bitte einen Betrag über 0 eintragen."); return false; }
    aendern(() => { daten.budget.push({ art: "Ausgabe", betrag: Math.round(b * 100) / 100, kategorie: "Lebensmittel", beschreibung: ("Einkauf " + wo.value.trim()).trim(), datum: datum.value || iso(heute()), enddatum: "", wiederholung: "keine", wiederholen_bis: "", ausnahmen: {} }); daten.einkauf = daten.einkauf.filter(e => !e.gekauft); });
    toast(`${euroText(b)} als Lebensmittel gebucht.`, true);
  } }]);
}

/* ---------- Kopf, Rahmen, Start ---------- */
/* „+ Neu“: was angelegt wird, richtet sich nach dem geöffneten Reiter (Kalender → Termin, Aufgaben → Aufgabe, Essen/Einkauf → Mahlzeit bzw. unter „Rezepte & Preise“ Rezept, Stundenplan → Lehrveranstaltung, Lernziele → Fach, Noten → Note, Geld → Buchung); sonst Aufgabe. Die Art lässt sich im Eintrags-Dialog weiterhin ändern. */
function neuerEintragOeffnen() {
  const reiter = ui.tab;
  if (reiter === "stundenplan") {
    const montag = montagVon(ui.spPlan || heute()), h0 = heute(), tag = diffDays(h0, montag) >= 0 && diffDays(h0, montag) < 7 ? h0 : montag;
    return lvNeu(tag, "08:30");
  }
  if (reiter === "geld") return buchungDialog();
  if (reiter === "noten") return noteDialog();
  if (reiter === "faecher") return fachDialog();
  if (reiter === "essen" && ui.essen === "rezepte" && einst.rezepte_an) return rezeptDialog();
  if (reiter === "kalender") return eintragDialog({ art: "termin", tag: ui.tag });
  if (reiter === "fristen") return eintragDialog({ art: "aufgabe", tag: heute() });
  if (reiter === "essen" && einst.essen_an !== false) return eintragDialog({ art: "essen", tag: ui.essen === "kalorien" && ui.kalTag ? ui.kalTag : heute() });
  return eintragDialog({ tag: heute() });
}
function navKnoepfe(nav) {
  for (const [k, l] of REITER) if (k !== "plus" && k !== "einstellungen" && k !== "suche" && (FIX.has(k) || !einst.reiter_aus.includes(k) || (k === "suche" && ui._sucheTemp))) nav.append(h("button", { class: ui.tab === k ? "on" : "", "data-reiter": k, onclick: () => {
    if (unterdrueckeKlick) return;
    if (k === "plus") return neuerEintragOeffnen();
    if (k !== "suche") ui._sucheTemp = false;
    ui.tab = k; uiSpeichern(); render(); window.scrollTo(0, 0);
  } }, l));
  reiterZiehbar(nav, nav.classList.contains("sidenav") ? ".sidenav" : "header .nav");
  return nav;
}
function kopf() {
  const nav = einst.reiter_seite ? null : navKnoepfe(h("nav", { class: "nav wrap", style: "padding-block:0 8px" }));
  const logo = h("span", { class: "osa-logo", title: "OSA – Open Student Agenda", "aria-label": "OSA", onclick: () => { ui.tab = "heute"; uiSpeichern(); render(); window.scrollTo(0, 0); } });
  logo.innerHTML = '<svg viewBox="0 0 512 512" width="36" height="36" aria-hidden="true"><rect width="512" height="512" rx="114" fill="var(--acc)"/><circle cx="256" cy="256" r="150" fill="none" stroke="var(--acc-fg)" stroke-width="54"/><g stroke="var(--acc-fg)" stroke-width="40" stroke-linecap="round"><path d="M194 222h124"/><path d="M194 300h124"/></g></svg><span class="osa-name"><b><i>O</i>pen</b><b><i>S</i>tudent</b><b><i>A</i>genda</b></span>';
  return h("header", { class: "top" }, h("div", { class: "wrap bar" }, logo,
    h("button", { class: "btn pri kopf-plus", title: "Neuer Eintrag", "aria-label": "Neuer Eintrag", onclick: () => neuerEintragOeffnen() }, "+ Neu"),
    (!einst.reiter_aus.includes("suche") || ui._sucheTemp) ? (() => {
      const b = h("button", { class: "btn ghost kopf-suche" + (ui.tab === "suche" ? " on" : ""), title: "Suche (Strg + K)", "aria-label": "Suche", onclick: () => suchFokus() });
      b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';
      return b;
    })() : null,
    (() => {
      const b = h("button", { class: "btn ghost kopf-einst" + (ui.tab === "einstellungen" ? " on" : ""), title: "Einstellungen", "aria-label": "Einstellungen", onclick: () => reiterOeffnen("einstellungen") });
      b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
      return b;
    })(),
    h("button", { class: "btn ghost", title: "Tastenkürzel und Tipps (F1)", onclick: hilfeDialog }, "?"),
    h("button", { class: "btn ghost", title: "Letzte Änderung rückgängig", disabled: !verlauf.length, onclick: rueckgaengig }, R("↶ " + t("Rückgängig") + (verlauf.length ? ` (${verlauf.length})` : "")))), nav);
}
/* ---------- Handy: untere Menüleiste mit „Mehr“ (nur auf schmalen Bildschirmen sichtbar, siehe CSS) ---------- */
const LEISTE_SYMBOL = {
  heute: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  kalender: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  fristen: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  stundenplan: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M9 9v12"/>',
  faecher: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M9 7h6"/>',
  noten: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  essen: '<path d="M3 4h2l2.4 11h11l2-8H6.2"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>',
  geld: '<circle cx="12" cy="12" r="9"/><path d="M14.6 9.3c-.6-.8-1.5-1.3-2.6-1.3-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2-.5-2.6-1.3M12 6.5V8m0 8v1.5"/>',
  statistik: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  suche: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  einstellungen: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  mehr: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>'
};
function sichtbareReiter() { return REITER.filter(([k]) => FIX.has(k) || !einst.reiter_aus.includes(k) || (k === "suche" && ui._sucheTemp)); }
function reiterOeffnen(k) {
  if (k === "plus") return neuerEintragOeffnen();
  if (k !== "suche") ui._sucheTemp = false;
  ui.tab = k; uiSpeichern(); render(); window.scrollTo(0, 0);
}
const LEISTE_MAX = 4;   // frei wählbare Knöpfe neben „+“ und „Mehr“
function leistenAuswahl() {
  /* gewählte Reiter in der Reihenfolge der Reiterliste; ausgeblendete und ungültige fallen weg */
  const gewaehlt = Array.isArray(einst.leiste) ? einst.leiste : [];
  return sichtbareReiter().filter(([k]) => k !== "plus" && gewaehlt.includes(k)).slice(0, LEISTE_MAX).map(([k]) => k);
}
function handyLeiste() {
  const alle = sichtbareReiter(), feste = leistenAuswahl();
  const imMehr = alle.filter(([k]) => k !== "plus" && !feste.includes(k));
  const knopf = (k, label, onclick, an) => {
    const b = h("button", { class: (an ? "on" : "") + (k === "plus" ? " plus" : ""), "aria-label": label, onclick });
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LEISTE_SYMBOL[k] || LEISTE_SYMBOL.mehr}</svg>`;
    if (k !== "plus") b.append(h("span", null, label));
    return b;
  };
  const name = k => (alle.find(r => r[0] === k) || [k, k])[1];
  const knoepfe = feste.map(k => knopf(k, name(k), () => reiterOeffnen(k), ui.tab === k));
  knoepfe.splice(Math.ceil(knoepfe.length / 2), 0, knopf("plus", t("Neuer Eintrag"), () => reiterOeffnen("plus"), false));   // „+“ in die Mitte
  return h("nav", { class: "handyleiste", "aria-label": "Hauptmenü" }, knoepfe,
    knopf("mehr", t("Mehr"), () => mehrMenue(imMehr), imMehr.some(([k]) => k === ui.tab)));
}
function leistenSektion() {
  const feste = leistenAuswahl();
  const knoepfe = sichtbareReiter().filter(([k]) => k !== "plus").map(([k, l]) => h("button", {
    class: feste.includes(k) ? "on" : "", onclick: () => {
      const neu = feste.includes(k) ? feste.filter(x => x !== k) : feste.concat(k);
      if (neu.length > LEISTE_MAX) { toast(`${t("Höchstens")} ${LEISTE_MAX} ${t("Knöpfe – nimm erst einen anderen heraus.")}`); return; }
      aendern(() => { einst.leiste = neu; });   // speichern und Leiste sofort neu zeichnen
    }
  }, l));
  return sektion("Untere Leiste (Handy)", h("p", { class: "mut small", style: "margin:0" }, R(`${t("Wähle bis zu")} ${LEISTE_MAX} ${t("Bereiche für die Leiste unten am Handy. „+“ und „Mehr“ sind immer dabei, alles andere findest du unter „Mehr“.")}`)),
    h("div", { class: "tog" }, knoepfe),
    h("p", { class: "mut small", style: "margin:0" }, R(`${feste.length} / ${LEISTE_MAX} ${t("gewählt")}`)));
}
function mehrMenue(liste) {
  let zu = () => { };
  const gitter = h("div", { class: "mehr-gitter" },
    liste.map(([k, l]) => h("button", { class: "btn" + (ui.tab === k ? " pri" : ""), onclick: () => { zu(); reiterOeffnen(k); } }, l)),
    h("button", { class: "btn", onclick: () => { zu(); datenschutzDialog(); } }, "Datenschutz"));
  zu = dialog("Mehr", gitter, [{ text: "Schließen" }]);
}

/* ---------- Datenschutz ---------- */
/* Bitte ausfüllen, bevor die App veröffentlicht wird: wer die App anbietet und wie man dich erreicht. */
const BETREIBER = { name: "Leandro Starzetz", kontakt: "leandro.starzetz@gmail.com" };
function datenschutzInhalt() {
  /* Jeder Satzteil wird einzeln übersetzt (t), damit zusammengesetzte Texte nicht deutsch bleiben */
  const absatz = (titel, ...teile) => h("div", null, h("b", null, titel), h("p", { style: "margin:4px 0 0" }, R(teile.filter(Boolean).map(x => t(x)).join(" "))));
  const wer = BETREIBER.name ? `${BETREIBER.name}${BETREIBER.kontakt ? " – " + BETREIBER.kontakt : ""}` : t("(Angaben zum Anbieter folgen)");
  const speicherText = ui.speicherSchutz === "ja" ? "Der Browser hat zugesagt, die Daten dauerhaft zu behalten."
    : ui.speicherSchutz === "nein" ? "Der Browser hat keinen dauerhaften Speicher zugesagt. Installiere die App auf dem Startbildschirm und lege regelmäßig eine Sicherung an."
    : "";
  return h("div", { style: "display:flex;flex-direction:column;gap:12px" },
    h("div", null, h("b", null, "Wer bietet die App an?"), h("p", { style: "margin:4px 0 0" }, R(t("OSA wird privat und nicht-kommerziell bereitgestellt von:") + " " + wer + "."))),
    absatz("Deine Einträge bleiben bei dir", "Alles, was du einträgst, wird nur auf deinem Gerät im Speicher des Browsers abgelegt. Es gibt kein Konto, keinen eigenen Server, keine Werbung, kein Tracking und keine Analyse. Niemand außer dir kann deine Daten sehen.", speicherText),
    absatz("Aufruf der Seite", "Die App liegt bei GitHub Pages (GitHub Inc., USA). Beim Laden verarbeitet GitHub technisch nötige Daten wie IP-Adresse, Zeitpunkt und Browser, um die Seite auszuliefern und vor Angriffen zu schützen. Näheres in der Datenschutzerklärung von GitHub: docs.github.com/site-policy/privacy-policies."),
    absatz("Nur wenn du sie einschaltest", "Wetter: Der eingegebene Ort wird an Open-Meteo (open-meteo.com) geschickt. Ferien: Land und Region werden an OpenHolidays (openholidaysapi.org) geschickt bzw. die von dir eingetragene Kalenderadresse wird abgerufen. Kalender aus dem Internet: Die eingegebene Adresse wird abgerufen. Dabei sehen diese Dienste deine IP-Adresse. Ohne Einschalten werden keine Daten an sie gesendet."),
    absatz("Preisvorschläge", "Wenn du in einem Rezept eine Zutat einträgst, fragt OSA bei Open Prices (prices.openfoodfacts.org, Open Food Facts) nach Preisen für die passende Lebensmittel-Kategorie, zum Beispiel „Zwiebeln“. Dein Rezept und deine Mengen werden nicht übertragen; der Dienst sieht deine IP-Adresse. Abschaltbar unter Einstellungen › Angezeigte Reiter."),
    absatz("Benachrichtigungen", "Erinnerungen werden direkt auf deinem Gerät erzeugt, nicht über einen Server."),
    absatz("Löschen", "Einstellungen › Daten und Export › Alle Daten löschen, oder die App bzw. die Websitedaten im Browser entfernen. Danach ist alles weg – vorher eine Sicherung anlegen, wenn du die Daten behalten willst."));
}
function datenschutzDialog() { dialog("Datenschutz", datenschutzInhalt(), [{ text: "Schließen", art: "pri" }], { breit: true }); }

function willkommen() {
  if (daten.aufgaben.length || daten.essen.length || Object.keys(daten.rezepte).length || daten.budget.length) return null;
  return h("div", { class: "card", style: "margin-bottom:14px" }, h("h3", null, "Willkommen!"), h("p", { style: "margin:0 0 10px" }, "Schreib oben bei „Schnell hinzufügen“ einen Satz wie „Mathe-Klausur Freitag 14 Uhr“ oder nutze den Knopf „+“, um deinen ersten Eintrag anzulegen – oder hole deine Daten aus der Desktop-Version: Einstellungen › Daten und Export › Sicherung laden (osa.json)."),
    h("button", { class: "btn", onclick: () => { ui.tab = "einstellungen"; ui.einstKat = "daten"; render(); } }, "Zu den Einstellungen"));
}
function tabInhalt() {
  if (ui.tab === "budget") ui.tab = "geld";
  if (ui.tab === "einkauf") { ui.tab = "essen"; ui.essen = "einkauf"; }
  if (ui.tab === "geld" && (ui.geld === "einkauf" || ui.geld === "rezepte")) { ui.essen = ui.geld; ui.tab = "essen"; ui.geld = "uebersicht"; }   // gespeicherter Stand aus der Zeit mit gemeinsamem Reiter
  const inh = { heute: heuteTab, kalender: kalenderTab, stundenplan: stundenplanTab, faecher: faecherTab, noten: notenTab, fristen: fristenTab, geld: geldTab, essen: essenTab, statistik: statistikTab, suche: sucheTab, einstellungen: einstellungenTab };
  if (!(ui.tab in inh) || (!FIX.has(ui.tab) && einst.reiter_aus.includes(ui.tab) && !(ui.tab === "suche" && ui._sucheTemp))) ui.tab = "heute";
  return h("div", null, null, inh[ui.tab]());
}

