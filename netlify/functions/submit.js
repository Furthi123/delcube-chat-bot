/**
 * submit.js — liest Felder dynamisch aus summary
 * Keine manuelle Feld-Liste nötig — passt sich automatisch an.
 */
const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };

  try {
    const data = JSON.parse(event.body);
    const s    = data.summary || {};
    const felder = data.felder || null; // Feld-Config vom Widget mitgesendet

    const customerEmail = (typeof s === 'object' ? s.email : data.email) || '';

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, type: 'login' },
      debug:  true,
      logger: true,
    });

    // Bilder
    const rawImages  = data.images || s._images || [];
    const attachments = rawImages.slice(0, 5).map((img, i) => ({
      filename:    `referenz-${i + 1}.jpg`,
      content:     img.data,
      encoding:    'base64',
      contentType: img.media_type || 'image/jpeg',
      cid:         `bild${i}@delcube`,
    }));

    // Zusammenfassung dynamisch aus allen Feldern bauen
    const summaryHTML = buildSummaryHTML(s, felder, attachments);
    const summaryTextKunde = buildSummaryTextKunde(s, felder);

    // Studio-Mail
    await transporter.sendMail({
      from:    `"${process.env.FROM_NAME}" <${process.env.SMTP_USER}>`,
      replyTo: customerEmail,
      to:      process.env.STUDIO_EMAIL,
      subject: `🎨 Neue Art Toy Anfrage${customerEmail ? ' von ' + customerEmail : ''}`,
      html:    studioHTML(summaryHTML, customerEmail, data.chatHistory || []),
      attachments,
    });

    // Kunden-Bestätigung
    if (customerEmail) {
      await transporter.sendMail({
        from:    `"${process.env.FROM_NAME || 'delcube'}" <${process.env.SMTP_USER}>`,
        to:      customerEmail,
        subject: 'Deine Anfrage ist bei uns angekommen ✓',
        html:    customerHTML(summaryTextKunde, process.env.STUDIO_EMAIL, process.env.FROM_NAME),
      });
    }

    // Shopify Inbox (optional)
    const shopUrl = (process.env.SHOPIFY_STORE_URL || '').replace(/\/$/, '');
    if (shopUrl && typeof s === 'object') {
      const msg = buildInboxText(s, felder);
      await fetch(`${shopUrl}/contact`, {
        method:   'POST',
        headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:     new URLSearchParams({
          'form_type': 'contact', 'utf8': '✓',
          'contact[name]': 'Art Toy Anfrage',
          'contact[email]': customerEmail,
          'contact[body]':  msg,
        }).toString(),
        redirect: 'manual',
      }).catch(e => console.warn('[submit] Shopify Inbox:', e.message));
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (error) {
    console.error('SMTP Fehler:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

// Baut Tabellen-Rows aus allen Feldern — vollautomatisch
function buildSummaryHTML(s, felder, attachments) {
  let rows = '';

  if (felder && Array.isArray(felder)) {
    // Felder-Config vorhanden → in definierter Reihenfolge mit Labels
    rows = felder
      .map(f => {
        const val = s[f.key];
        if (!val || val === '...' || val === '') return '';
        return `<tr>
          <td style="padding:8px 14px;font-size:13px;color:#888;white-space:nowrap;border-bottom:1px solid #f0f0f0">${esc(f.label)}</td>
          <td style="padding:8px 14px;font-size:13px;color:#111;font-weight:500;border-bottom:1px solid #f0f0f0">${esc(String(val))}</td>
        </tr>`;
      }).join('');
  } else {
    // Kein felder-Array → alle Keys aus summary anzeigen
    rows = Object.entries(s)
      .filter(([k, v]) => k !== '_images' && v && v !== '...' && v !== '')
      .map(([k, v]) => `<tr>
        <td style="padding:8px 14px;font-size:13px;color:#888;white-space:nowrap;border-bottom:1px solid #f0f0f0">${esc(k)}</td>
        <td style="padding:8px 14px;font-size:13px;color:#111;font-weight:500;border-bottom:1px solid #f0f0f0">${esc(String(v))}</td>
      </tr>`).join('');
  }

  const bilderHTML = attachments.length
    ? `<div style="margin-top:20px">
        <p style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px">
          Referenzbilder (${attachments.length})
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          ${attachments.map((a, i) =>
            `<img src="cid:bild${i}@delcube"
                  style="max-width:180px;max-height:180px;border-radius:8px;border:1px solid #ddd"
                  alt="Referenzbild ${i + 1}">`
          ).join('')}
        </div>
      </div>` : '';

  return `<table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden">${rows}</table>${bilderHTML}`;
}

// Für Kunden-Mail: nur Pflicht-Felder außer E-Mail
function buildSummaryTextKunde(s, felder) {
  if (felder && Array.isArray(felder)) {
    return felder
      .filter(f => f.key !== 'email' && f.key !== 'notizen')
      .map(f => {
        const val = s[f.key];
        if (!val || val === '...' || val === '') return '';
        return `<p style="margin:4px 0;font-size:13px;color:#555">
          <span style="color:#999">${esc(f.label)}:</span>
          <strong style="color:#222">${esc(String(val))}</strong>
        </p>`;
      }).join('');
  }
  return Object.entries(s)
    .filter(([k, v]) => k !== 'email' && k !== '_images' && v && v !== '...')
    .map(([k, v]) => `<p style="margin:4px 0;font-size:13px;color:#555">
      <span style="color:#999">${esc(k)}:</span>
      <strong style="color:#222">${esc(String(v))}</strong>
    </p>`).join('');
}

function buildInboxText(s, felder) {
  const lines = ['— Neue Art Toy Anfrage —', ''];
  if (felder) {
    felder.forEach(f => { if (s[f.key]) lines.push(`${f.label}: ${s[f.key]}`); });
  } else {
    Object.entries(s).filter(([k]) => k !== '_images').forEach(([k, v]) => lines.push(`${k}: ${v}`));
  }
  return lines.join('\n');
}

function studioHTML(summaryHTML, customerEmail, history) {
  const historyHTML = (history || [])
    .filter(m => typeof m.content === 'string').slice(-8)
    .map(m => `<div style="margin:4px 0;padding:8px 12px;border-radius:6px;font-size:13px;
        background:${m.role === 'user' ? '#f0f4ff' : '#f9f9f9'};color:#333;line-height:1.6">
      <strong style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;
        color:${m.role === 'user' ? '#3b5bdb' : '#888'}">${m.role === 'user' ? 'Kunde' : 'Bot'}</strong>
      <br>${esc(m.content)}
    </div>`).join('');

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5">
    <div style="background:#111;padding:22px 28px">
      <p style="margin:0;font-size:11px;color:#666;letter-spacing:.1em;text-transform:uppercase">Neue Anfrage</p>
      <h1 style="margin:4px 0 0;font-size:20px;color:#fff;font-weight:500">Art Toy — delcube</h1>
    </div>
    <div style="padding:24px 28px">${summaryHTML}
      <div style="margin-top:22px">
        <a href="mailto:${esc(customerEmail)}?subject=Re: Deine Art Toy Anfrage"
           style="display:inline-block;padding:11px 22px;background:#111;color:#fff;
                  border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
          Direkt antworten →
        </a>
      </div>
    </div>
    ${historyHTML ? `<div style="padding:0 28px 28px;border-top:1px solid #f0f0f0">
      <p style="margin:16px 0 10px;font-size:12px;color:#999;letter-spacing:.06em;text-transform:uppercase">Chat-Verlauf</p>
      ${historyHTML}
    </div>` : ''}
  </div>
</body></html>`;
}

function customerHTML(summaryRows, studioEmail, studioName) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5">
    <div style="background:#111;padding:28px">
      <h1 style="margin:0;font-size:20px;color:#fff;font-weight:400;line-height:1.3">
        Deine Anfrage ist<br><strong style="font-weight:600">bei uns angekommen.</strong>
      </h1>
    </div>
    <div style="padding:28px">
      <p style="margin:0 0 18px;font-size:15px;color:#333;line-height:1.75">
        Einer von uns meldet sich persönlich bei dir – meist innerhalb von 24 Stunden.
      </p>
      <div style="background:#f9f8f6;border-radius:8px;padding:16px 20px">
        <p style="margin:0 0 10px;font-size:11px;color:#aaa;letter-spacing:.08em;text-transform:uppercase">Deine Angaben</p>
        ${summaryRows}
      </div>
      <p style="margin:18px 0 0;font-size:13px;color:#888;line-height:1.7">
        Noch etwas ergänzen? Antworte einfach auf diese Mail.
      </p>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #f0f0f0">
      <p style="margin:0;font-size:12px;color:#bbb">
        ${esc(studioName || 'delcube GbR')} &nbsp;·&nbsp;
        <a href="mailto:${esc(studioEmail)}" style="color:#bbb">${esc(studioEmail)}</a>
      </p>
    </div>
  </div>
</body></html>`;
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
