// Contact form: POST /api/contact
//
// Checks the form and sends the message through Gmail's SMTP server (smtp.gmail.com:465, an app password),
// straight from this Pages Function with Cloudflare's TCP sockets. It is delivered to your Gmail inbox, and
// Reply-To is the visitor, so "Reply" in Gmail goes to them. (Cloudflare Email Routing keeps forwarding
// contact@sizeit.games to the same Gmail for people who write to the address directly.)
//
// Settings: Cloudflare Pages → the project → Settings → Variables and Secrets (type "Secret"):
//   GMAIL_USER          the Gmail address that sends and receives the messages
//   GMAIL_APP_PASSWORD  a 16-letter Google "App password" (Google Account → Security → 2-Step Verification → App passwords)
//   CONTACT_TO          optional, the address shown in the To: line; defaults to contact@sizeit.games
// For `wrangler pages dev`, put them in .dev.vars.
import { connect } from 'cloudflare:sockets';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
});
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const oneLine = s => s.replace(/[\r\n]+/g, ' ');
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const TOPICS = ['A number looks wrong', 'Something broke', 'Idea for a game or feature', 'Leagues and schools', 'Press or partnership', 'My data', 'Something else'];

export async function onRequestPost({ request, env }) {
  // Only the site's own pages may post here
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'Not allowed.' }, 403);

  let d;
  try { d = await request.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400); }

  // Bots fill the hidden field; pretend it worked
  if (clean(d.website, 100)) return json({ ok: true });

  const name = oneLine(clean(d.name, 80));
  const email = clean(d.email, 160);
  const topic = TOPICS.includes(d.topic) ? d.topic : 'Something else';
  const message = clean(d.message, 4000);
  if (!name) return json({ ok: false, error: 'Please tell us your name.' }, 400);
  if (!EMAIL.test(email)) return json({ ok: false, error: 'Please enter a valid email address so we can reply.' }, 400);
  if (message.length < 10) return json({ ok: false, error: 'Please write a little more (at least 10 characters).' }, 400);

  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) return json({ ok: false, error: 'Sending is not set up yet.' }, 503);

  const page = clean(d.page, 300);
  const body = [`From: ${name} <${email}>`, `Topic: ${topic}`, ...(page ? [`Page: ${page}`] : []), '', message].join('\n');
  // The mail shows as sent to contact@sizeit.games, but is delivered straight to the Gmail inbox: Cloudflare Email
  // Routing refuses to forward a message that comes from the same Gmail it forwards to.
  const shownTo = addr(env.CONTACT_TO || 'contact@sizeit.games');
  const to = addr(env.GMAIL_USER);
  const raw = [
    `From: ${hdr('sizeit.games contact form')} <${addr(env.GMAIL_USER)}>`,
    `To: ${shownTo}`,
    `Reply-To: ${hdr(name)} <${addr(email)}>`,
    `Subject: ${hdr(`[sizeit.games] ${topic}: ${name}`.slice(0, 200))}`,
    `Message-ID: <${crypto.randomUUID()}@sizeit.games>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(body).replace(/.{1,76}/g, '$&\r\n').trimEnd()
  ].join('\r\n');

  try {
    await Promise.race([
      smtpSend(env.GMAIL_USER.trim(), env.GMAIL_APP_PASSWORD.replace(/\s+/g, ''), to, raw),
      new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 12000))
    ]);
  } catch (e) {
    console.log('contact: smtp failed', String(e));
    return json({ ok: false, error: 'Could not send right now.' }, 502);
  }
  return json({ ok: true });
}

const b64 = s => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const hdr = s => `=?UTF-8?B?${b64(s.replace(/[\r\n]+/g, ' '))}?=`;   // header text that may hold any characters
const addr = s => String(s).replace(/[\r\n<>"\s]/g, '');

// A minimal SMTP client: implicit TLS on port 465, AUTH LOGIN, one message.
async function smtpSend(user, pass, to, raw) {
  const socket = connect({ hostname: 'smtp.gmail.com', port: 465 }, { secureTransport: 'on' });
  const w = socket.writable.getWriter(), r = socket.readable.getReader();
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = '';
  async function reply() {
    for (;;) {
      const parts = buf.split('\r\n');
      let used = 0;
      for (let i = 0; i < parts.length - 1; i++) {
        used += parts[i].length + 2;
        if (/^\d{3} /.test(parts[i])) { buf = buf.slice(used); return parts[i]; }   // last line of a (multi-line) reply
      }
      const { value, done } = await r.read();
      if (done) throw new Error('connection closed');
      buf += dec.decode(value, { stream: true });
    }
  }
  async function step(line, expect) {
    if (line !== null) await w.write(enc.encode(line + '\r\n'));
    const rep = await reply();
    if (!rep.startsWith(expect)) throw new Error('SMTP ' + rep);
  }
  try {
    await step(null, '220');
    await step('EHLO sizeit.games', '250');
    await step('AUTH LOGIN', '334');
    await step(btoa(user), '334');
    await step(btoa(pass), '235');
    await step(`MAIL FROM:<${addr(user)}>`, '250');
    await step(`RCPT TO:<${to}>`, '250');
    await step('DATA', '354');
    await step(raw + '\r\n.', '250');
    await w.write(enc.encode('QUIT\r\n')).catch(() => {});
  } finally { try { socket.close(); } catch {} }
}
