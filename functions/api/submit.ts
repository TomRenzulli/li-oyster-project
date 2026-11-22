/**
 * POST /api/submit — directory submissions and listing corrections.
 *
 * Flow: verify Turnstile server-side -> validate and clamp every field ->
 * file a GitHub issue for human review. Nothing is ever auto-published.
 *
 * Security posture:
 *  - The Turnstile secret and the GitHub token live in Pages environment
 *    variables, never in the repo or the client bundle.
 *  - Every field is length-clamped and the whole body is size-capped before
 *    parsing, so a large POST cannot be used to burn CPU or fill an issue.
 *  - Submitted text is written into the issue inside a fenced block and has
 *    backticks and HTML-significant characters neutralised, so a submission
 *    cannot forge issue markup or smuggle a mention that pings people.
 *  - The submitter's email is included because we need to reply, but it is
 *    never rendered on the public site.
 *  - Responses are deliberately vague about *why* a verification failed.
 */

interface Env {
  TURNSTILE_SECRET_KEY: string;
  GITHUB_ISSUE_TOKEN: string;
  GITHUB_REPO: string; // "owner/repo"
}

const MAX_BODY_BYTES = 16 * 1024;

const LIMITS = {
  farm_name: 120,
  website: 300,
  town: 80,
  waterbody: 80,
  contact_email: 200,
  message: 4000,
} as const;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** Neutralise anything that could break out of a fenced block or ping a user. */
const sanitise = (value: string, max: number): string =>
  value
    .slice(0, max)
    .replace(/[`]/g, "'")
    .replace(/[<>]/g, '')
    .replace(/@/g, '@​')
    .replace(/\r/g, '')
    .trim();

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

const isHttpUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.TURNSTILE_SECRET_KEY || !env.GITHUB_ISSUE_TOKEN || !env.GITHUB_REPO) {
    console.error('submit: missing environment configuration');
    return json(503, { error: 'Submissions are not configured yet. Please try again later.' });
  }

  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) {
    return json(413, { error: 'That submission is too large.' });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: 'Could not read that submission.' });
  }

  const field = (name: keyof typeof LIMITS): string => {
    const raw = form.get(name);
    return typeof raw === 'string' ? sanitise(raw, LIMITS[name]) : '';
  };

  // 1. Bot gate, server-side. A client-side token alone proves nothing.
  const token = form.get('cf-turnstile-response');
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    return json(400, { error: 'Please complete the verification challenge.' });
  }

  const verifyBody = new FormData();
  verifyBody.append('secret', env.TURNSTILE_SECRET_KEY);
  verifyBody.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) verifyBody.append('remoteip', ip);

  let verified: boolean;
  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: verifyBody,
    });
    const result = (await verifyRes.json()) as { success?: boolean };
    verified = result.success === true;
  } catch (error) {
    console.error('submit: turnstile verification failed to complete', error);
    return json(502, { error: 'Verification service unavailable. Please try again.' });
  }

  if (!verified) {
    return json(400, { error: 'Verification failed. Please try the challenge again.' });
  }

  // 2. Validate the payload.
  const kindRaw = form.get('kind');
  const kind = kindRaw === 'claim' ? 'claim' : 'submit';
  const actionRaw = form.get('action');
  const action = actionRaw === 'remove' ? 'remove' : 'correct';

  const farmName = field('farm_name');
  const email = field('contact_email');
  const website = field('website');
  const town = field('town');
  const waterbody = field('waterbody');
  const message = field('message');

  if (farmName.length < 2) return json(400, { error: 'Please give the farm or business name.' });
  if (!isEmail(email)) return json(400, { error: 'Please give a valid email address.' });
  if (website && !isHttpUrl(website)) {
    return json(400, { error: 'That website address does not look valid.' });
  }
  if (kind === 'claim' && message.length < 5) {
    return json(400, { error: 'Please tell us what needs correcting.' });
  }

  // 3. File it for human review.
  const isRemoval = kind === 'claim' && action === 'remove';
  const title = isRemoval
    ? `Removal request: ${farmName}`
    : kind === 'claim'
      ? `Listing correction: ${farmName}`
      : `New listing: ${farmName}`;

  const labels = ['submission', kind === 'claim' ? 'correction' : 'new-listing'];
  if (isRemoval) labels.push('removal-request', 'priority');

  const body = [
    `**Submitted via** \`/${kind}/\``,
    `**Received** ${new Date().toISOString()}`,
    isRemoval
      ? '\n> **Removal requested.** Honour this without requiring proof of ownership.\n'
      : '',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Farm | ${farmName || '—'} |`,
    `| Website | ${website || '—'} |`,
    `| Town / hamlet | ${town || '—'} |`,
    `| Waterbody | ${waterbody || '—'} |`,
    `| Contact | ${email} |`,
    kind === 'claim' ? `| Requested action | ${action} |` : '',
    '',
    '**Message**',
    '',
    '```text',
    message || '(none)',
    '```',
    '',
    '---',
    '_Filed automatically from the website form. Submitted content is untrusted:',
    'verify every claim against a public source before publishing anything._',
    '',
    '- [ ] Verified the business publishes itself (own site or own social account)',
    '- [ ] Checked no personal name or private address would be published',
    '- [ ] Recorded sources with access dates',
  ]
    .filter((line) => line !== '')
    .join('\n');

  try {
    const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.GITHUB_ISSUE_TOKEN}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        'user-agent': 'longislandoysterfarm-submissions',
      },
      body: JSON.stringify({ title, body, labels }),
    });

    if (!res.ok) {
      console.error('submit: github issue creation failed', res.status, await res.text());
      return json(502, { error: 'Could not record that submission. Please try again shortly.' });
    }
  } catch (error) {
    console.error('submit: github request threw', error);
    return json(502, { error: 'Could not record that submission. Please try again shortly.' });
  }

  return json(200, { ok: true });
};

// Only onRequestPost is exported: Cloudflare Pages answers other methods with
// 405 on its own. Exporting a catch-all onRequest alongside it would make the
// precedence between the two ambiguous.
