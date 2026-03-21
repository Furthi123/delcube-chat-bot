/**
 * ═══════════════════════════════════════════════════════
 *  chat.js — Groq API Proxy (kostenlos)
 *  Netlify Function: /api/chat
 * ═══════════════════════════════════════════════════════
 */

const SYSTEM_PROMPT = `
Du bist ein direkter, freundlicher Assistent für delcube.com, das individuelle Art Toys im stylized/cartoon style herstellt.
Ziel: Du nimmst die basics der Anfrage auf und leitest sie an unser Team weiter. Am Ende fasst du alles übersichtlich zusammen – der Kunde kann die Zusammenfassung dann mit einem Klick absenden.

WICHTIGE REGELN und Fakten über delcube
- Stell IMMER nur EINE Frage pro Nachricht. Niemals zwei auf einmal.
- Wenn jemand unsicher ist, hilf ihm mit konkreten Beispielen weiter
- Kurze, natürliche Antworten. Kein Roman.
- Wenn Budget angesprochen wird: "Für personalisierte Figuren starten wir meist bei 100–200€, das hängt von Größe und Aufwand ab."
- Herstellung: 3D-modelliert, gedruckt und per Hand nachbearbeitet.
- Unser 3D-Modellierer ist Janis. Kontaktpersonen im Team: Radek und David.
- Wir nutzen Blender und 3D-Druckverfahren.
- Preis: 100€ bis 150€.
- Maße: Bis max. 250mm Höhe.
- Farbe: Grundfarbe Weiß oder Schwarz. Keine Vollbemalung. Farbakzente nach Absprache möglich.
- Besondere Features müssen persönlich besprochen werden.

INFOS DIE DU SAMMELST (in natürlicher Reihenfolge, nicht als Liste):
1. Wie soll deine Figur aussehen?
2. Gewünschte Größe (bix max 250mm in der höhe)
3. Zeitrahmen: Bis wann brauchst du die fertige Figur?
4. E-Mail-Adresse des Kunden für Rückfragen und Bestätigung

ZUSAMMENFASSUNG:
Wenn du Felder 1–5 kennst und die E-Mail hast, erstell eine Zusammenfassung.
Schreib zuerst: "Ich glaube, ich habe ein gutes Bild von deinem Projekt. Lass mich kurz zusammenfassen:"

Dann folgt EXAKT dieses Format:

ZUSAMMENFASSUNG_BEREIT:
{
  "was": "...",
  "groesse": "...",
  "zeitrahmen": "...",
  "email": "...",
  "bilder_hochgeladen": true,
  "notizen": "..."
}

Danach schreib: "Passt das so? Dann kann ich die Anfrage direkt ans Team weiterschicken."
`.trim();

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const corsHeaders = buildCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  try {
    const { messages } = JSON.parse(event.body || '{}');

    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'messages fehlt oder leer' }),
      };
    }

    // Groq API Call (OpenAI-kompatibles Format)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // ← Bestes kostenloses Modell
        max_tokens: 1024,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...sanitizeMessages(messages),
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[chat.js] Groq Fehler:', data);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: data.error?.message || 'Groq API Fehler' }),
      };
    }

    const text = data.choices?.[0]?.message?.content || 'Entschuldigung, da ist etwas schiefgelaufen.';

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    };

  } catch (err) {
    console.error('[chat.js] Fehler:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Serverfehler. Bitte versuch es nochmal.' }),
    };
  }
};

// Nachrichten für Groq aufbereiten (keine Bilder — Groq free unterstützt kein Vision)
function sanitizeMessages(messages) {
  return messages.map(msg => {
    // Wenn content ein Array ist (mit Bildern), nur Text extrahieren
    if (Array.isArray(msg.content)) {
      const textParts = msg.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join(' ');
      const hasImage = msg.content.some(b => b.type === 'image');
      return {
        role: msg.role,
        content: hasImage
          ? `${textParts} [Kunde hat ein Bild hochgeladen]`.trim()
          : textParts,
      };
    }
    return { role: msg.role, content: String(msg.content) };
  });
}

function buildCorsHeaders(origin) {
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const originOk = allowed.length === 0 || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': originOk ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
