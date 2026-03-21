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

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        type: 'login',
      },
      debug:  true,
      logger: true,
    });

    // ── Zusammenfassung ─────────────────────────────────
    // Unterstützt beide Formate: altes (string) und neues (object)
    const s = data.summary;
    const customerEmail = (typeof s === 'object' ? s.email : data.email) || '';

    let summaryHTML = '';
    if (s && typeof s === 'object') {
      const row = (label, val) =>
        val && val !== '...' && val !== 'nicht angegeben'
          ? `<tr>
               <td style="padding:8px 14px;font-size:13px;color:#888;white-space:nowrap;
                          border-bottom:1px solid #f0f0f0">${label}</td>
               <td style="padding:8px 14px;font-size:13px;color:#111;font-weight:500;
                          border-bottom:1px solid #f0f0f0">${String(val).replace(/</g,'&lt;')}</td>
             </tr>`
          : '';
      summaryHTML = `
        <table style="width:100%;border-collapse:collapse;border:1px solid #eee;
                      border-radius:8px;overflow:hidden;margin-top:8px">
          ${row('Vorstellungen', s.vorstellungen)}
          ${row('Größe',         s.groesse)}
          ${row('Farbe',         s.farbe)}
          ${row('E-Mail',        s.email)}
          ${row('Notizen',       s.notizen)}
        </table>`;
    } else if (typeof s === 'string') {
      summaryHTML = `<div style="background:#f4f4f4;padding:15px;border-radius:8px">
        ${s.replace(/\n/g,'<br>')}
      </div>`;
    }

    // ── Bilder aufbereiten ──────────────────────────────
    const rawImages = data.images || s?._images || [];
    const attachments = rawImages.slice(0, 5).map((img, i) => ({
      filename:    `referenz-${i + 1}.jpg`,
      content:     img.data,
      encoding:    'base64',
      contentType: img.media_type || 'image/jpeg',
      cid:         `bild${i}@delcube`,
    }));

    const bilderHTML = attachments.length
      ? `<div style="margin-top:20px">
           <p style="font-size:12px;color:#999;text-transform:uppercase;
                     letter-spacing:.06em;margin:0 0 12px">
             Referenzbilder (${attachments.length})
           </p>
           <div style="display:flex;gap:12px;flex-wrap:wrap">
             ${attachments.map((a, i) =>
               `<div style="text-align:center">
                  <img src="cid:bild${i}@delcube"
                       style="max-width:180px;max-height:180px;border-radius:8px;
                              border:1px solid #ddd;display:block"
                       alt="Referenzbild ${i + 1}">
                  <p style="margin:4px 0 0;font-size:11px;color:#aaa">Bild ${i + 1}</p>
                </div>`
             ).join('')}
           </div>
         </div>`
      : '';

    // ── Studio-Mail ─────────────────────────────────────
    await transporter.sendMail({
      from:    `"${process.env.FROM_NAME}" <${process.env.SMTP_USER}>`,
      replyTo: customerEmail,
      to:      process.env.STUDIO_EMAIL,
      subject: `🎨 Neue Art Toy Anfrage${customerEmail ? ' von ' + customerEmail : ''}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                    max-width:600px;margin:0 auto">
          <div style="background:#111;padding:22px 28px;border-radius:10px 10px 0 0">
            <p style="margin:0;font-size:11px;color:#666;letter-spacing:.1em;
                      text-transform:uppercase">Neue Anfrage</p>
            <h1 style="margin:4px 0 0;font-size:20px;color:#fff;font-weight:500">
              Art Toy — delcube
            </h1>
          </div>
          <div style="padding:24px 28px;border:1px solid #eee;border-top:none;
                      border-radius:0 0 10px 10px">
            ${summaryHTML}
            ${bilderHTML}
            <div style="margin-top:22px">
              <a href="mailto:${customerEmail}?subject=Re: Deine Art Toy Anfrage"
                 style="display:inline-block;padding:11px 22px;background:#111;
                        color:#fff;border-radius:6px;text-decoration:none;
                        font-size:14px;font-weight:500">
                Direkt antworten →
              </a>
            </div>
          </div>
        </div>
      `,
      attachments,
    });

    // ── Kunden-Bestätigung ──────────────────────────────
    if (customerEmail) {
      await transporter.sendMail({
        from:    `"${process.env.FROM_NAME || 'delcube'}" <${process.env.SMTP_USER}>`,
        to:      customerEmail,
        subject: 'Deine Anfrage ist bei uns angekommen ✓',
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                      max-width:560px;margin:0 auto">
            <div style="background:#111;padding:28px;border-radius:10px 10px 0 0">
              <h1 style="margin:0;font-size:20px;color:#fff;font-weight:400;line-height:1.3">
                Deine Anfrage ist<br>
                <strong style="font-weight:600">bei uns angekommen.</strong>
              </h1>
            </div>
            <div style="padding:28px;border:1px solid #eee;border-top:none;
                        border-radius:0 0 10px 10px">
              <p style="margin:0 0 18px;font-size:15px;color:#333;line-height:1.75">
                Vielen Dank für deine Anfrage! Einer von uns meldet sich persönlich
                bei dir — das dauert meist nicht länger als 24 Stunden.
              </p>
              <div style="background:#f9f8f6;border-radius:8px;padding:16px 20px">
                <p style="margin:0 0 10px;font-size:11px;color:#aaa;
                          letter-spacing:.08em;text-transform:uppercase">
                  Deine Angaben
                </p>
                ${typeof s === 'object' ? `
                  ${s.vorstellungen ? `<p style="margin:4px 0;font-size:13px;color:#555"><span style="color:#999">Vorstellungen:</span> <strong style="color:#222">${String(s.vorstellungen).replace(/</g,'&lt;')}</strong></p>` : ''}
                  ${s.groesse       ? `<p style="margin:4px 0;font-size:13px;color:#555"><span style="color:#999">Größe:</span> <strong style="color:#222">${String(s.groesse).replace(/</g,'&lt;')}</strong></p>` : ''}
                  ${s.farbe         ? `<p style="margin:4px 0;font-size:13px;color:#555"><span style="color:#999">Farbe:</span> <strong style="color:#222">${String(s.farbe).replace(/</g,'&lt;')}</strong></p>` : ''}
                ` : `<p style="font-size:13px;color:#555">${String(s || '').replace(/\n/g,'<br>')}</p>`}
              </div>
              <p style="margin:18px 0 0;font-size:13px;color:#888;line-height:1.7">
                Falls du noch etwas ergänzen möchtest, antworte einfach auf diese Mail.
              </p>
            </div>
            <div style="padding:16px 28px;border-top:1px solid #f0f0f0">
              <p style="margin:0;font-size:12px;color:#bbb">
                delcube GbR &nbsp;·&nbsp;
                <a href="mailto:${process.env.STUDIO_EMAIL}"
                   style="color:#bbb">${process.env.STUDIO_EMAIL}</a>
              </p>
            </div>
          </div>
        `,
      });
    }

    // ── Shopify Inbox (optional) ────────────────────────
    const shopUrl = (process.env.SHOPIFY_STORE_URL || '').replace(/\/$/, '');
    if (shopUrl && typeof s === 'object') {
      const msg = [
        '— Neue Art Toy Anfrage —', '',
        `Vorstellungen: ${s.vorstellungen || ''}`,
        `Größe: ${s.groesse || ''}`,
        `Farbe: ${s.farbe || ''}`,
        `E-Mail: ${s.email || ''}`,
        s.notizen ? `Notizen: ${s.notizen}` : '',
      ].filter(Boolean).join('\n');

      await fetch(`${shopUrl}/contact`, {
        method:   'POST',
        headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:     new URLSearchParams({
          'form_type':      'contact',
          'utf8':           '✓',
          'contact[name]':  'Art Toy Anfrage',
          'contact[email]': customerEmail,
          'contact[body]':  msg,
        }).toString(),
        redirect: 'manual',
      }).catch(e => console.warn('[submit] Shopify Inbox:', e.message));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };

  } catch (error) {
    console.error('IONOS SMTP Fehler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Versand fehlgeschlagen: ' + error.message }),
    };
  }
};
