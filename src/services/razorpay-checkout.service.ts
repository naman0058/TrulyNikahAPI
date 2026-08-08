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
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <meta name="theme-color" content="#6d6d6d" />
  <title>TrulyNikah Payment</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #6d6d6d;
      color: #fff;
      -webkit-font-smoothing: antialiased;
    }
    .screen {
      position: fixed;
      inset: 0;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
      background: #6d6d6d;
      transition: opacity 0.35s ease, visibility 0.35s ease;
    }
    .screen.is-hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .is-hidden { display: none !important; }
    .screen--light {
      background: #f4f6f5;
      color: #1a1a1a;
    }
    .brand {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.85;
      margin-bottom: 28px;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(255,255,255,0.25);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
    .screen--light .spinner {
      border-color: rgba(13,110,58,0.15);
      border-top-color: #0d6e3a;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loader-title {
      margin: 22px 0 6px;
      font-size: 16px;
      font-weight: 500;
    }
    .loader-sub {
      margin: 0;
      font-size: 13px;
      opacity: 0.65;
    }
    .status-title {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 600;
    }
    .status-msg {
      margin: 0 0 24px;
      font-size: 14px;
      opacity: 0.75;
      max-width: 280px;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      min-width: 200px;
      padding: 14px 24px;
      font-size: 15px;
      font-weight: 600;
      border: 0;
      border-radius: 10px;
      background: #0d6e3a;
      color: #fff;
      cursor: pointer;
      text-decoration: none;
    }
    .btn--ghost {
      background: transparent;
      color: #0d6e3a;
      border: 1px solid rgba(13,110,58,0.35);
      margin-top: 12px;
    }
    .secure-note {
      position: fixed;
      bottom: max(20px, env(safe-area-inset-bottom));
      left: 0;
      right: 0;
      text-align: center;
      font-size: 11px;
      opacity: 0.45;
      color: #fff;
      pointer-events: none;
    }
    .screen--light .secure-note { color: #666; }
  </style>
</head>
<body>
  <div id="screen-loader" class="screen" aria-live="polite">
    <div class="brand">TrulyNikah</div>
    <div class="spinner" role="status" aria-label="Loading"></div>
    <p class="loader-title">Opening secure checkout</p>
    <p class="loader-sub">Please wait…</p>
  </div>

  <div id="screen-cancelled" class="screen screen--light is-hidden">
    <p class="status-title">Payment cancelled</p>
    <p class="status-msg">You closed the payment window. You can try again when ready.</p>
    <button type="button" class="btn" id="btn-retry">Try again</button>
  </div>

  <div id="screen-success" class="screen screen--light is-hidden">
    <p class="status-title" style="color:#0d6e3a">Payment successful</p>
    <p class="status-msg" id="success-msg"></p>
    <a id="open-app" class="btn is-hidden" href="#">Return to app</a>
  </div>

  <div id="screen-error" class="screen screen--light is-hidden">
    <p class="status-title">Unable to load checkout</p>
    <p class="status-msg">Check your connection and try again.</p>
    <button type="button" class="btn" id="btn-reload">Retry</button>
  </div>

  <p class="secure-note" id="secure-note">Secured by Razorpay</p>

  <script>
    (function () {
      var returnUrl = ${returnUrlJs};
      var rzpInstance = null;
      var loaderEl = document.getElementById('screen-loader');
      var cancelledEl = document.getElementById('screen-cancelled');
      var successEl = document.getElementById('screen-success');
      var errorEl = document.getElementById('screen-error');
      var secureNote = document.getElementById('secure-note');

      function showOnly(el) {
        [loaderEl, cancelledEl, successEl, errorEl].forEach(function (node) {
          if (!node) return;
          node.classList.toggle('is-hidden', node !== el);
        });
        if (secureNote) {
          secureNote.style.display = el === loaderEl ? 'block' : 'none';
        }
      }

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

      function razorpayModalVisible() {
        return !!(
          document.querySelector('.razorpay-container') ||
          document.querySelector('.razorpay-backdrop') ||
          document.querySelector('iframe[src*="razorpay"]')
        );
      }

      function hideLoaderWhenModalReady() {
        var attempts = 0;
        var timer = setInterval(function () {
          attempts += 1;
          if (razorpayModalVisible() || attempts > 120) {
            clearInterval(timer);
            loaderEl.classList.add('is-hidden');
          }
        }, 50);
      }

      function showSuccess(response, deepTarget) {
        showOnly(successEl);
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
          msg.textContent = 'Return to the TrulyNikah app to complete.';
          openApp.href = deepTarget;
          openApp.classList.remove('is-hidden');
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
          msg.textContent = 'You can close this screen and return to the app.';
          openApp.classList.add('is-hidden');
        }
      }

      function buildOptions() {
        return {
          key: '${key}',
          amount: ${opts.amountPaise},
          currency: '${currency}',
          name: 'TrulyNikah',
          description: 'Membership payment',
          order_id: '${orderId}',
          prefill: { name: '${name}', email: '${email}', contact: '${contact}' },
          theme: { color: '#0d6e3a', backdrop_color: '#6d6d6d' },
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
              showOnly(cancelledEl);
            }
          }
        };
      }

      function openCheckout() {
        if (typeof Razorpay === 'undefined') {
          showOnly(errorEl);
          return;
        }
        showOnly(loaderEl);
        loaderEl.classList.remove('is-hidden');
        rzpInstance = new Razorpay(buildOptions());
        rzpInstance.open();
        hideLoaderWhenModalReady();
      }

      document.getElementById('btn-retry').addEventListener('click', openCheckout);
      document.getElementById('btn-reload').addEventListener('click', function () {
        window.location.reload();
      });

      var script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = openCheckout;
      script.onerror = function () {
        showOnly(errorEl);
      };
      document.head.appendChild(script);
    })();
  </script>
</body>
</html>`;
}
