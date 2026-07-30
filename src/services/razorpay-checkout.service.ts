import crypto from 'crypto';
import config from '../config';

export type CheckoutTokenPayload = {
  uid: string;
  order_id: string;
  amount_paise: number;
  plan_id?: number;
  return_url?: string;
  exp: number;
};

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function signingSecret(): string {
  return config.razorpay.secret || config.jwt.secret;
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data, 'utf8').toString('base64url');
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8');
}

export function createCheckoutToken(payload: Omit<CheckoutTokenPayload, 'exp'>): string {
  const full: CheckoutTokenPayload = { ...payload, exp: Date.now() + TOKEN_TTL_MS };
  const body = base64UrlEncode(JSON.stringify(full));
  const sig = crypto.createHmac('sha256', signingSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyCheckoutToken(token: string): CheckoutTokenPayload {
  const [body, sig] = token.split('.');
  if (!body || !sig) throw new Error('Invalid checkout token');

  const expected = crypto.createHmac('sha256', signingSecret()).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Invalid checkout token signature');
  }

  const payload = JSON.parse(base64UrlDecode(body)) as CheckoutTokenPayload;
  if (payload.exp < Date.now()) throw new Error('Checkout link expired');
  if (!payload.order_id || !payload.uid || !payload.amount_paise) throw new Error('Invalid checkout token payload');

  return payload;
}

export function buildCheckoutPageUrl(token: string): string {
  const base = `${config.appUrl}${config.apiPrefix}/payments/razorpay/checkout`;
  return `${base}?t=${encodeURIComponent(token)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderRazorpayCheckoutPage(opts: {
  key: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  email: string;
  contact: string;
  returnUrl?: string;
}): string {
  const key = escapeHtml(opts.key);
  const orderId = escapeHtml(opts.orderId);
  const currency = escapeHtml(opts.currency);
  const name = escapeHtml(opts.name);
  const email = escapeHtml(opts.email);
  const contact = escapeHtml(opts.contact);
  const returnUrl = opts.returnUrl ? escapeHtml(opts.returnUrl) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TrulyNikah Payment</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #f7f7f7; color: #222; }
    .card { max-width: 420px; margin: 40px auto; background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
    button { width: 100%; padding: 14px; font-size: 16px; border: 0; border-radius: 8px; background: #0d6e3a; color: #fff; cursor: pointer; }
    p { line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Complete payment</h2>
    <p>Secure payment powered by Razorpay.</p>
    <button id="pay-btn" type="button">Pay now</button>
    <p id="status" style="margin-top:16px;font-size:14px;color:#555;"></p>
  </div>
  <script>
    (function () {
      var returnUrl = ${returnUrl ? `'${returnUrl}'` : 'null'};
      var options = {
        key: '${key}',
        amount: ${opts.amountPaise},
        currency: '${currency}',
        name: 'TrulyNikah',
        description: 'Membership payment',
        order_id: '${orderId}',
        prefill: { name: '${name}', email: '${email}', contact: '${contact}' },
        theme: { color: '#0d6e3a' },
        handler: function (response) {
          var q = new URLSearchParams({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            status: 'success'
          });
          if (returnUrl) {
            var sep = returnUrl.indexOf('?') >= 0 ? '&' : '?';
            window.location.href = returnUrl + sep + q.toString();
          } else {
            document.getElementById('status').textContent =
              'Payment successful. Return to the app and complete verification.';
          }
        },
        modal: {
          ondismiss: function () {
            document.getElementById('status').textContent = 'Payment cancelled.';
          }
        }
      };
      var rzp = new Razorpay(options);
      document.getElementById('pay-btn').onclick = function () { rzp.open(); };
      rzp.open();
    })();
  </script>
</body>
</html>`;
}
