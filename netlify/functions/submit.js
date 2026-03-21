const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };

  try {
    const data = JSON.parse(event.body);

const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        type: 'login' // Erzwingt das Login-Verfahren
      },
      debug: true, // Erzeugt mehr Details in den Netlify Logs
      logger: true // Loggt den SMTP-Verkehr
    });

    const mailOptions = {
      // IONOS erlaubt oft nur den Versand, wenn "from" die eigene Adresse ist
      from: `"${process.env.FROM_NAME}" <${process.env.SMTP_USER}>`,
      replyTo: data.email, // So kannst du direkt auf die Mail antworten
      to: process.env.STUDIO_EMAIL,
      subject: `Anfrage: ${data.name} via Figuren-Chat`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6;">
          <h2>Neue Figuren-Anfrage</h2>
          <p><strong>Von:</strong> ${data.name} (${data.email})</p>
          <hr />
          <p><strong>Chat-Zusammenfassung:</strong></p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">
            ${data.summary.replace(/\n/g, '<br>')}
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'success' })
    };

  } catch (error) {
    console.error('IONOS SMTP Fehler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Versand über IONOS fehlgeschlagen: ' + error.message })
    };
  }
};