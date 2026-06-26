// ZainCash integration helpers.
//
// Flow (per ZainCash merchant docs at https://docs.zaincash.iq):
//   1. We sign a JWT (HS256) with the merchant secret carrying:
//        amount, serviceType, msisdn, orderId, redirectUrl, merchantId
//      and POST it to `${BASE}/transaction/init` as form-urlencoded
//      `{token, merchantId, lang}`.
//   2. ZainCash returns `{id: "<transactionId>"}`. We redirect the visitor
//      to `${PAY_BASE}/transaction/pay?id=<transactionId>`.
//   3. After the customer pays, ZainCash redirects back to our
//      `redirectUrl` with `?token=<signedJWT>` carrying the transaction
//      result (status, orderid, operation, amount, msisdn).
//   4. We verify the token using the same merchant secret and activate
//      the matching subscription.
//
// All four pieces of data needed to call ZainCash live in env vars so we
// can swap test ↔ production credentials without redeploying code:
//
//   ZAINCASH_MERCHANT_ID      Issued by ZainCash for the merchant account.
//   ZAINCASH_SECRET           HS256 signing secret for the merchant.
//   ZAINCASH_MSISDN           The merchant's MSISDN (Iraqi mobile number).
//   ZAINCASH_ENV              "test" (default) or "production".

import jwt from 'jsonwebtoken';

const TEST_API = 'https://test.zaincash.iq';
const PROD_API = 'https://api.zaincash.iq';

interface ZainCashConfig {
  merchantId: string;
  secret: string;
  msisdn: string;
  apiBase: string;
  payBase: string;
}

export function loadZainCashConfig(): ZainCashConfig | null {
  const merchantId = (process.env.ZAINCASH_MERCHANT_ID || '').trim();
  const secret = (process.env.ZAINCASH_SECRET || '').trim();
  const msisdn = (process.env.ZAINCASH_MSISDN || '').trim();
  const env = (process.env.ZAINCASH_ENV || 'test').trim();
  if (!merchantId || !secret || !msisdn) return null;
  const isProd = env === 'production' || env === 'prod';
  const base = isProd ? PROD_API : TEST_API;
  return { merchantId, secret, msisdn, apiBase: base, payBase: base };
}

export interface InitArgs {
  amountIQD: number;
  orderId: string;
  redirectUrl: string;
}

export interface InitResult {
  transactionId: string;
  payUrl: string;
}

export async function initTransaction(
  cfg: ZainCashConfig,
  args: InitArgs,
): Promise<InitResult> {
  const payload = {
    amount: args.amountIQD,
    serviceType: 'sadis_ultra_subscription',
    msisdn: cfg.msisdn,
    orderId: args.orderId,
    redirectUrl: args.redirectUrl,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4, // 4h
  };
  const token = jwt.sign(payload, cfg.secret, { algorithm: 'HS256' });
  const body = new URLSearchParams({
    token,
    merchantId: cfg.merchantId,
    lang: 'ar',
  });
  const res = await fetch(`${cfg.apiBase}/transaction/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`ZainCash init failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id?: string; err?: string };
  if (!data.id) {
    throw new Error(`ZainCash init missing id: ${JSON.stringify(data)}`);
  }
  return {
    transactionId: data.id,
    payUrl: `${cfg.payBase}/transaction/pay?id=${data.id}`,
  };
}

/**
 * Result of a callback token. ZainCash sends `status` = "success" /
 * "failed" / "pending"; we treat anything other than `success` as
 * unconfirmed.
 */
export interface CallbackPayload {
  status: 'success' | 'failed' | 'pending' | string;
  orderid: string;
  amount?: number;
  operation?: string;
  msisdn?: string;
}

/** Verify a callback token from ZainCash and return the decoded payload. */
export function verifyCallbackToken(
  cfg: ZainCashConfig,
  token: string,
): CallbackPayload {
  const decoded = jwt.verify(token, cfg.secret) as CallbackPayload;
  return decoded;
}
