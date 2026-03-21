/**
 * ═══════════════════════════════════════════════════════
 *  chat.js — Einzige Stelle für Feld-Konfiguration
 *
 *  NUR HIER ÄNDERN:
 *  1. FELDER → welche Infos gesammelt werden
 *  2. SYSTEM_PROMPT → wie der Bot fragt
 *
 *  Alles andere (Summary-Card, E-Mail) passt sich
 *  automatisch an — kein weiterer Code nötig.
 * ═══════════════════════════════════════════════════════
 */

// ════════════════════════════════════════════════════
//  FELDER — nur hier ändern
//  key:    JSON-Schlüssel (kein Leerzeichen, keine Umlaute)
//  label:  Anzeige-Name in Summary-Card und E-Mail
//  pflicht: true = Bot fragt solange bis Antwort kommt
// ════════════════════════════════════════════════════
const FELDER = [
  { key: 'vorstellungen', label: 'Vorstellungen',    pflicht: true  },
  { key: 'groesse',       label: 'Größe',            pflicht: true  },
  { key: 'farbe',         label: 'Farbe & Oberfläche', pflicht: true },
  { key: 'email',         label: 'E-Mail',           pflicht: true  },
  { key: 'notizen',       label: 'Notizen',          pflicht: false },
];

// ════════════════════════════════════════════════════
//  SYSTEM PROMPT — Gesprächsverhalten anpassen
// ════════════════════════════════════════════════════
const SYSTEM_PROMPT = `
Du bist der Chat-Assistent von delcube.com. Wir bauen individuelle Art Toys – 3D-gedruckt, handnachbearbeitet, 100–150€, max. 250mm.

REGELN:
- Maximal 2 kurze Sätze pro Antwort.
- Nur EINE Frage pro Nachricht.
- Kein Smalltalk, keine langen Erklärungen.
- Starte mit: "Hey! Ich bin der Assistent von delcube und nehme deine Anfrage auf. Unser Team meldet sich dann persönlich."

FRAGEN (der Reihe nach):
1. Wie soll das Art Toy aussehen? (Referenz, Charakter, eigene Idee)
2. Wie groß soll es sein? (max. 250mm Höhe)
3. Welche Grundfarbe — Weiß oder Schwarz? Oberfläche glänzend oder matt?
4. Deine E-Mail-Adresse?

ZUSAMMENFASSUNG:
Sobald du alle Pflichtfelder hast, antworte NUR mit diesem Block:

ZUSAMMENFASSUNG_BEREIT:
{
  "vorstellungen": "exakter Wert",
  "groesse": "exakter Wert",
  "farbe": "exakter Wert",
  "email": "exakter Wert",
  "notizen": ""
}
`.trim();

// ════════════════════════════════════════════════════
//  AB HIER NICHTS ÄNDERN
// ════════════════════════════════════════════════════
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
        model:       'llama-3.3-70b-versatile',
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
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: data.error?.message || 'Groq Fehler' }) };
    }

    const text = data.choices?.[0]?.message?.content || 'Entschuldigung, da ist etwas schiefgelaufen.';

    // Felder-Konfiguration mitsenden → Widget + submit.js bauen alles automatisch
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, felder: FELDER }),
    };

  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
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
