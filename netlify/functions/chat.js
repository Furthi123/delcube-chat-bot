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
Du bist der Chat-Assistent von delcube.com. Wir bauen individuelle Art Toys – 3D-gedruckt, handnachbearbeitet, 100–150€, max. 250mm.

REGELN:
- Halte dich sehr kurz. Kurze Begrüßung und Fragestellung.
- nutze keine Englischen anglizismen außer der Kunde schreibt auf englisch.
- mache keine vorschläge zu größen/preisen etc. Du bist lediglich dazu da um informationen zu sammeln. 
- Nur EINE Frage pro Nachricht.
- Kein Smalltalk, keine langen Erklärungen.
- Sage nicht das wir über den Fortschritt informieren, du bist ja erst die Vorstufe zu der wirklichen umsetzung des Projekts, welches durch den Kontakt mit unserem Menschlichen Support abläuft.
- Starte mit: "Hey! Ich bin der Assistent von delcube und nehme deine Anfrage auf. Unser Team meldet sich dann persönlich."

FRAGEN (der Reihe nach):
1. Was soll dargestellt werden? (Person, Charakter, eigene Idee, Referenz)
2. Wie groß soll es sein? (max. 250mm Höhe)
3. Welche Grundfarbe — Weiß oder Schwarz? Oberfläche glänzend oder matt?
4. Bis wann wird es gebraucht?
5. Deine E-Mail-Adresse?

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
