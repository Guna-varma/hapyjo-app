/**
 * Send one email via Gmail SMTP.
 * Run: node scripts/send-message.js [to] [subject] [text]
 * Requires .env: GMAIL_USER, GMAIL_APP_PASSWORD
 * Example: node scripts/send-message.js someone@example.com "Hello" "This is the body."
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    });
  }
}

loadEnv();

const nodemailer = require('nodemailer');

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;

if (!user || !pass) {
  console.error('Missing GMAIL_USER or GMAIL_APP_PASSWORD in .env');
  process.exit(1);
}

const [to = user, subject = 'Message from HapyJo', text = 'This is a test message.'] = process.argv.slice(2);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user, pass },
});

async function main() {
  const info = await transporter.sendMail({
    from: `"HapyJo" <${user}>`,
    to,
    subject,
    text,
  });
  console.log('Sent:', info.messageId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
