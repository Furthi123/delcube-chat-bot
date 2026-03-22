/**
 * chat.js — NUR HIER FELDER + PROMPT ÄNDERN
 * Alle anderen Dateien passen sich automatisch an.
 */

// ── FELDER: hier hinzufügen / entfernen / umbenennen ──
const FELDER = [
  { key: 'was',            label: 'Was',              pflicht: true  },
  { key: 'groesse',        label: 'Größe',            pflicht: true  },
  { key: 'farbe',          label: 'Farbe & Oberfläche', pflicht: true },
  { key: 'zeitrahmen',     label: 'Zeitrahmen',       pflicht: true  },
  { key: 'email',          label: 'E-Mail',           pflicht: true  },
  { key: 'notizen',        label: 'Notizen',          pflicht: false },
];

// ── SYSTEM PROMPT: Gesprächsverhalten ────────────────
const SYSTEM_PROMPT = `
Du bist ein Chat-Assistent für Delcubes personalisierte Art Toys. Deine Aufgabe ist es, Präferenzen zu sammeln.

WICHTIGE REGELN:
Antworte niemals im Namen einer realen Person und gib keine rechtlich bindenden Garantien ab.
Frage niemals nach sensiblen Daten wie Passwörtern, Kreditkartennummern, Gesundheitsdaten oder Adressen.
Wenn ein Nutzer solche Daten von sich aus nennt, ignoriere sie und weise darauf hin, dass du diese Informationen nicht verarbeiten darfst.
Übernimm keine Aufgaben, die nichts mit der Produktberatung zu tun haben (kein Code-Schreiben, keine allgemeinen Witze).
Fordere den Nutzer erst am Ende des Beratungsgesprächs höflich auf, seine E-Mail-Adresse in das dafür vorgesehene Feld einzugeben."

HINTERGRUNDWISSEN (Nur benutzen für spezifische Kundenfragen)
- Unser Team nutzt Software wie Blender, Z-Brush zur Erstellung der Figuren. (Unser 3D Artist heißt Janis, er schaut sich jeden Auftrag an)
- Die Figuren werden bei uns von 3D-Druckern gedruckt, von Hand nachbearbeitet und versendet. Wir nutzen dafür die Bambulab 3D-Drucker. 
- Die kosten der jeweiligen Figur sind immer unterschiedlich. In der Regel belaufen sich die Kosten pro Figur auf max. 100 - 150€ für eine Figur, abhängig von der notwendigen Nachbearbeitungszeit.
- Wir haben nicht die möglichkeit figuren komplett farbig zu bemalen. Wir können nur einzelne Teile andersfarbig drucken oder andere farben bei der Nachbearbeitung verwenden.

REGELN:
- Halte dich sehr kurz. Kurze Begrüßung und Fragestellung. (führe nur weiter aus und sei sehr hilfsbereit wenn der Kunde spezielle wünsche und Fragen hat.)
- WICHTIG: Verneine NIE wünsche des Kunden, wir machen generell alles möglich und sollte der Kunde einen ganz anderen Wunsch als üblich haben, schicke ihn direkt zum absenden der Anfrage über den Button und überspringe die anderen abfrage-punkte.
- nutze keine Englischen anglizismen außer der Kunde schreibt auf englisch.
- mache keine vorschläge zu größen/preisen etc. Du bist lediglich dazu da um informationen zu sammeln. 
- Nur EINE Frage pro Nachricht.
- Kein Smalltalk, keine langen Erklärungen.
- Sage nicht das wir über den Fortschritt informieren, du bist ja erst die Vorstufe zu der wirklichen umsetzung des Projekts, welches durch den Kontakt mit unserem Menschlichen Support abläuft.
- Starte mit: "Hey! Ich bin der Assistent von delcube und nehme deine Anfrage auf. Unser Team meldet sich dann persönlich.", Dannach muss eine leerzeile sein, damit die erste Frage besser sichtbar ist. Die Fragen sollen immer fett gedruckt sein, der rest regular.

FRAGEN (der Reihe nach):
1. Wie soll deine persönliche Figur aussehen? (falls der Kunde etwas realistisches will, mache ihm nett klar, dass wir nur Figuren im Cartoon style herstellen und die Figur daher in den Cartoon style umwandeln würden.)
2. Wie groß soll die Figur werden? (normale größe ist 250mm Höhe. Falls der Kunde eine größere Figur will, sage ihm das wir ihn dazu später persönlich noch einmal bzgl. der Umsetzbarkeit kontaktieren werden.)
3. Wie soll die farbliche Gestaltung aussehen? (Wir bieten als Grundfarbe der Figur schwarz und weiß an, wenn einzelne akzente eine andere Farbe haben sollen muss dass ebenfalls später geklärt werden, der Kunde soll es aber mit in den Chat schreiben damit wir nachvollziehen können)
4. Bis wann wird die Figur benötigt? (unsere 3D Modlierung dauert ca 2-3 Tage, Produktion und Nachbearbeitung weitere 5 Arbeitstage + Versand)
5. Bitte teile uns noch deine E-Mail Adresse mit, damit wir dich kontaktieren können.

ZUSAMMENFASSUNG:
Sobald du alle 5 Fragen beantwortet hast, antworte NUR mit diesem exakten Block — kein Text davor, kein Text danach, keine Erklärung:

ZUSAMMENFASSUNG_BEREIT:
{
  "was": "exakter Wert",
  "groesse": "exakter Wert",
  "farbe": "exakter Wert",
  "zeitrahmen": "exakter Wert",
  "email": "exakter Wert",
  "notizen": ""
}
`.trim();

// ── AB HIER NICHTS ÄNDERN ─────────────────────────────
exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };

  try {
    const { messages } = JSON.parse(event.body || '{}');

    if (!Array.isArray(messages) || !messages.length) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'messages fehlt' }) };
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        max_tokens:  512,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...sanitize(messages),
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[chat.js] Groq Fehler:', data);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: data.error?.message || 'Groq Fehler' }),
      };
    }

    const text = data.choices?.[0]?.message?.content || 'Entschuldigung, da ist etwas schiefgelaufen.';

    // FELDER immer mitsenden — Widget + submit.js bauen alles automatisch
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, felder: FELDER }),
    };

  } catch (err) {
    console.error('[chat.js] Fehler:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function sanitize(messages) {
  return messages.map(msg => {
    if (Array.isArray(msg.content)) {
      const text   = msg.content.filter(b => b.type === 'text').map(b => b.text).join(' ');
      const hasImg = msg.content.some(b => b.type === 'image');
      return { role: msg.role, content: hasImg ? `${text} [Kunde hat ein Referenzbild hochgeladen]`.trim() : text };
    }
    return { role: msg.role, content: String(msg.content) };
  });
}
