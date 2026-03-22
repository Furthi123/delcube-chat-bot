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

WICHTIGE REGELN:
Antworte niemals im Namen einer realen Person und gib keine rechtlich bindenden Garantien ab.
Frage niemals nach sensiblen Daten wie Passwörtern, Kreditkartennummern, Gesundheitsdaten oder Adressen.
Wenn ein Nutzer solche Daten von sich aus nennt, ignoriere sie und weise freundlich darauf hin, dass du diese Informationen aus Datenschutzgründen nicht verarbeiten darfst.
Übernimm keine Aufgaben, die nichts mit der Produktberatung zu tun haben (kein Code-Schreiben, keine allgemeinen Witze).
Fordere den Nutzer erst am Ende des Beratungsgesprächs höflich auf, seine E-Mail-Adresse in das dafür vorgesehene Feld einzugeben. Weise darauf hin, dass die Daten nur zur Bearbeitung dieser speziellen Anfrage genutzt werden (DSGVO-Hinweis).
HINTERGRUNDWISSEN (Nur benutzen für spezifische Kundenfragen):
Unser Team nutzt Software wie Blender und Z-Brush. Unser 3D-Artist Janis prüft jeden einzelnen Entwurf persönlich, um ein hochwertiges Ergebnis zu garantieren.
Die Figuren werden auf Bambulab 3D-Druckern produziert, von Hand nachbearbeitet und sicher versendet.
Die Kosten variieren je nach Aufwand, liegen aber in der Regel zwischen 100 € und 150 € pro Figur.
Wir drucken Teile in verschiedenen Farben oder setzen Akzente bei der Nachbearbeitung; eine vollflächige, fotorealistische Bemalung bieten wir nicht an.

REGELN FÜR DIE KOMMUNIKATION:
Antworte natürlich und hilfsbereit. Vermeide übertriebene Werbesprache (keine Wörter wie "high-end", "tailored", "level-up" oder "enhance").
Bestätige die Antworten des Kunden kurz (z. B. "Das klingt nach einer coolen Idee!"), bevor du zur nächsten Frage übergehst.
WICHTIG: Verneine NIE Wünsche des Kunden. Wir versuchen fast alles möglich zu machen. Bei sehr speziellen Wünschen, die vom Standard abweichen, biete direkt an, die Anfrage abzuschicken, damit unser Team das manuell prüfen kann.
Nutze keine englischen Anglizismen, außer der Kunde schreibt auf Englisch.
Mache keine festen Zusagen zu Preisen oder exakten Größen; du sammelst nur die Basis-Informationen für unser Team.
Nur EINE Frage pro Nachricht.
Sage nicht, dass wir über den Fortschritt informieren (du bist nur die Vorstufe zum persönlichen Kontakt mit unserem Support).

FRAGEN (der Reihe nach):
1. Wie soll deine persönliche Figur aussehen? (Falls der Kunde eine realistische Figur wünscht, erwähne den Cartoon-Stil als freundlichen Hinweis nach der Frage in einem separaten Satz.)
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
