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

/** Overrides Helmet default CSP on the hosted checkout HTML only (Razorpay script + inline bootstrapping). */
export const RAZORPAY_CHECKOUT_PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com",
  "script-src-elem 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://checkout.razorpay.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "child-src https://api.razorpay.com https://checkout.razorpay.com",
].join('; ');

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

  const returnUrlJs = opts.returnUrl ? JSON.stringify(opts.returnUrl) : 'null';

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
    button, .btn { display: block; box-sizing: border-box; width: 100%; padding: 14px; font-size: 16px; border: 0; border-radius: 8px; background: #0d6e3a; color: #fff; cursor: pointer; text-align: center; text-decoration: none; }
    .btn-secondary { margin-top: 12px; background: #e8f5ee; color: #0d6e3a; }
    p { line-height: 1.5; }
    .ok { color: #0d6e3a; font-weight: 600; }
    .muted { font-size: 14px; color: #555; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div id="step-pay">
      <h2>Complete payment</h2>
      <p>Secure payment powered by Razorpay.</p>
      <button id="pay-btn" type="button">Pay now</button>
      <p id="status" class="muted" style="margin-top:16px;"></p>
    </div>
    <div id="step-success" class="hidden">
      <h2 class="ok">Payment successful</h2>
      <p id="success-msg" class="muted"></p>
      <a id="open-app" class="btn hidden" href="#">Return to TrulyNikah app</a>
    </div>
  </div>
  <script>
    (function () {
      var returnUrl = ${returnUrlJs};

      function isHttpUrl(url) {
        return /^https?:\\/\\//i.test(url);
      }

      function buildReturnTarget(base, q) {
        var sep = base.indexOf('?') >= 0 ? '&' : '?';
        return base + sep + q.toString();
      }

      function notifyApp(payload) {
        var json = JSON.stringify(payload);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(json);
        }
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.razorpayPayment) {
          window.webkit.messageHandlers.razorpayPayment.postMessage(payload);
        }
        if (window.TrulyNikahPayment && typeof window.TrulyNikahPayment.onSuccess === 'function') {
          window.TrulyNikahPayment.onSuccess(json);
        }
      }

      function likelyInAppWebView() {
        if (window.ReactNativeWebView) return true;
        if (window.TrulyNikahPayment) return true;
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.razorpayPayment) {
          return true;
        }
        return /TrulyNikah/i.test(navigator.userAgent || '');
      }

      function showSuccess(response, deepTarget) {
        document.getElementById('step-pay').classList.add('hidden');
        document.getElementById('step-success').classList.remove('hidden');
        var msg = document.getElementById('success-msg');
        var openApp = document.getElementById('open-app');

        notifyApp({
          type: 'razorpay_success',
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          status: 'success'
        });

        if (deepTarget && !isHttpUrl(returnUrl)) {
          msg.textContent = 'Your payment was completed. Return to the TrulyNikah app to finish.';
          openApp.href = deepTarget;
          openApp.classList.remove('hidden');
          openApp.onclick = function (e) {
            e.preventDefault();
            window.location.href = deepTarget;
          };
          if (likelyInAppWebView()) {
            setTimeout(function () {
              try { window.location.href = deepTarget; } catch (err) {}
            }, 400);
          }
        } else if (!returnUrl) {
          msg.textContent = 'Payment successful. Close this screen and complete verification in the app.';
        }
      }

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
          if (returnUrl && isHttpUrl(returnUrl)) {
            window.location.replace(buildReturnTarget(returnUrl, q));
            return;
          }
          var deepTarget = returnUrl ? buildReturnTarget(returnUrl, q) : null;
          showSuccess(response, deepTarget);
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
