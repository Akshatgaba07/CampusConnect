const nodemailer = require('nodemailer');
const env = require('./env');
// Outlook SMTP: STARTTLS on 587. Needs an account with SMTP AUTH enabled + app password (see docs/setup-guide.md).
const transporter = nodemailer.createTransport({
  host: env.smtp.host, port: env.smtp.port, secure: false, requireTLS: true,
  auth: { user: env.smtp.user, pass: env.smtp.pass },
  tls: { minVersion: 'TLSv1.2' },
});
module.exports = { transporter, from: env.smtp.from };
