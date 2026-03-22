/**
 * submit.js — liest Felder dynamisch, vollständiger Chat-Verlauf
 *
 * v2.1 — Kunden-Bilder Fix:
 * Erwartet data.userImages als Array von { data: base64, media_type }
 * — das sind ALLE Bilder die der Kunde im Gespräch gesendet hat.
 * Diese werden als Anhänge an die Studio-Mail gehängt.
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
    const data          = JSON.parse(event.body);
    const s             = data.summary     || {};
    const felder        = data.felder      || null;
    const chatHistory   = data.chatHistory || [];
    const customerEmail = (typeof s === 'object' ? s.email : data.email) || '';

    // FIX v2.1: Kunden-Bilder kommen jetzt als data.userImages
    // Format: [{ data: base64string, media_type: 'image/jpeg' }]
    const userImages  = data.userImages || s._images || []; // s._images als Fallback
    const attachments = buildAttachments(userImages);

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, type: 'login' },
      debug:  true,
      logger: true,
    });

    const mailAttachments = attachments.map(a => ({
      filename:    a.filename,
      content:     a.content,
      encoding:    'base64',
      contentType: a.contentType,
      cid:         a.cid,
    }));

    // Studio-Mail (mit Bildern als Anhang + eingebettet)
    await transporter.sendMail({
      from:        `"${process.env.FROM_NAME}" <${process.env.SMTP_USER}>`,
      replyTo:     customerEmail,
      to:          process.env.STUDIO_EMAIL,
      subject:     `🎨 Neue Art Toy Anfrage von ${customerEmail}`,
      html:        studioHTML(s, felder, chatHistory, attachments, customerEmail),
      attachments: mailAttachments,
    });

    // Kunden-Bestätigung (ohne Bilder — Kunde hat sie selbst geschickt)
    if (customerEmail) {
      await transporter.sendMail({
        from:    `"${process.env.FROM_NAME || 'delcube'}" <${process.env.SMTP_USER}>`,
        to:      customerEmail,
        subject: 'Deine Anfrage ist bei uns angekommen ✓',
        html:    customerHTML(s, felder, process.env.STUDIO_EMAIL, process.env.FROM_NAME),
      });
    }

    // Shopify Inbox (optional)
    const shopUrl = (process.env.SHOPIFY_STORE_URL || '').replace(/\/$/, '');
    if (shopUrl) {
      const lines = ['— Neue Art Toy Anfrage —', ''];
      if (felder) {
        felder.forEach(f => { if (s[f.key]) lines.push(`${f.label}: ${s[f.key]}`); });
      } else {
        Object.entries(s).filter(([k]) => k !== '_images').forEach(([k, v]) => lines.push(`${k}: ${v}`));
      }
      if (attachments.length) {
        lines.push('');
        lines.push(`Referenzbilder vom Kunden: ${attachments.length} Bild(er) angehängt`);
      }
      await fetch(`${shopUrl}/contact`, {
        method:   'POST',
        headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:     new URLSearchParams({
          'form_type':       'contact',
          'utf8':            '✓',
          'contact[name]':   'Art Toy Anfrage',
          'contact[email]':  customerEmail,
          'contact[body]':   lines.join('\n'),
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

// ── Kunden-Bilder aufbereiten (base64 → Anhang-Objekte) ─────────────
// Keine async nötig — base64 ist bereits vorhanden, kein Download nötig.
function buildAttachments (userImages) {
  return userImages.slice(0, 5).map(function (img, i) {
    const contentType = img.media_type || 'image/jpeg';
    const ext         = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    return {
      filename:    `referenz-${i + 1}.${ext}`,
      content:     img.data,
      encoding:    'base64',
      contentType: contentType,
      cid:         `bild${i}@delcube`,
    };
  });
}

// ── Studio E-Mail ─────────────────────────────────────────────────────
function studioHTML (s, felder, chatHistory, attachments, customerEmail) {

  // Zusammenfassung-Tabelle
  let tableRows = '';
  if (felder && Array.isArray(felder)) {
    tableRows = felder.map(f => {
      const val = s[f.key];
      if (!val || val === '...' || val === '') return '';
      return `<tr>
        <td style="padding:9px 14px;font-size:13px;color:#888;white-space:nowrap;border-bottom:1px solid #f0f0f0;min-width:120px">${esc(f.label)}</td>
        <td style="padding:9px 14px;font-size:13px;color:#111;font-weight:500;border-bottom:1px solid #f0f0f0">${esc(String(val))}</td>
      </tr>`;
    }).join('');
  } else {
    tableRows = Object.entries(s)
      .filter(([k, v]) => k !== '_images' && v && v !== '...' && v !== '')
      .map(([k, v]) => `<tr>
        <td style="padding:9px 14px;font-size:13px;color:#888;white-space:nowrap;border-bottom:1px solid #f0f0f0">${esc(k)}</td>
        <td style="padding:9px 14px;font-size:13px;color:#111;font-weight:500;border-bottom:1px solid #f0f0f0">${esc(String(v))}</td>
      </tr>`).join('');
  }

  // Kunden-Bilder eingebettet via CID
  const bilderHTML = attachments.length
    ? `<div style="margin-top:24px">
        <p style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px">
          Referenzbilder vom Kunden (${attachments.length})
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          ${attachments.map((a, i) => `
            <img src="cid:${a.cid}"
                 style="max-width:200px;max-height:200px;border-radius:8px;border:1px solid #ddd;display:block"
                 alt="Referenzbild ${i + 1}">`).join('')}
        </div>
      </div>`
    : '';

  // Chat-Verlauf
  const verlaufHTML = chatHistory.length
    ? `<div style="padding:0 28px 28px;border-top:1px solid #f0f0f0">
        <p style="margin:20px 0 12px;font-size:12px;color:#999;letter-spacing:.08em;text-transform:uppercase">
          Chat-Verlauf (${chatHistory.length} Nachrichten)
        </p>
        ${chatHistory
          .filter(m => typeof m.content === 'string' && m.content.trim())
          .map(m => `
            <div style="margin:5px 0;padding:9px 13px;border-radius:8px;font-size:13px;line-height:1.6;
              background:${m.role === 'user' ? '#f0f4ff' : '#f9f9f9'};color:#333">
              <strong style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;
                color:${m.role === 'user' ? '#3b5bdb' : '#888'}">
                ${m.role === 'user' ? 'Kunde' : 'Bot'}
              </strong><br>${esc(m.content)}
            </div>`).join('')}
      </div>`
    : '';

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5">

    <div style="background:#111;padding:22px 28px">
      <p style="margin:0;font-size:11px;color:#666;letter-spacing:.1em;text-transform:uppercase">Neue Anfrage</p>
      <h1 style="margin:4px 0 0;font-size:20px;color:#fff;font-weight:500">Art Toy — delcube</h1>
    </div>

    <div style="padding:24px 28px">
      <p style="margin:0 0 14px;font-size:12px;color:#999;letter-spacing:.08em;text-transform:uppercase">Zusammenfassung</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden">
        ${tableRows}
      </table>
      ${bilderHTML}
      <div style="margin-top:22px">
        <a href="mailto:${esc(customerEmail)}?subject=Re: Deine Art Toy Anfrage"
           style="display:inline-block;padding:11px 22px;background:#111;color:#fff;
                  border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
          Direkt antworten →
        </a>
      </div>
    </div>

    ${verlaufHTML}

  </div>
</body></html>`;
}

// ── Kunden-Bestätigung (ohne Bilder) ─────────────────────────────────
function customerHTML (s, felder, studioEmail, studioName) {
  let rows = '';
  if (felder && Array.isArray(felder)) {
    rows = felder
      .filter(f => f.key !== 'email')
      .map(f => {
        const val = s[f.key];
        if (!val || val === '...' || val === '') return '';
        return `<p style="margin:5px 0;font-size:13px;color:#555">
          <span style="color:#999;display:inline-block;min-width:110px">${esc(f.label)}:</span>
          <strong style="color:#222">${esc(String(val))}</strong>
        </p>`;
      }).join('');
  } else {
    rows = Object.entries(s)
      .filter(([k, v]) => k !== 'email' && k !== '_images' && v && v !== '...')
      .map(([k, v]) => `<p style="margin:5px 0;font-size:13px;color:#555">
        <span style="color:#999">${esc(k)}:</span>
        <strong style="color:#222">${esc(String(v))}</strong>
      </p>`).join('');
  }

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
        <p style="margin:0 0 12px;font-size:11px;color:#aaa;letter-spacing:.08em;text-transform:uppercase">Deine Angaben</p>
        ${rows}
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

function esc (str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
