import config from '../config';
import prisma from '../lib/prisma';

export async function sendOtpSms(mobile: string, otp: number): Promise<boolean> {
  const message = `Assalamualaikum, ${otp} is your OTP for Nikah Mubarak by Barakah Innovations Pvt Ltd. This OTP is valid for 5 min. Kindly do not share OTP with anyone.`;

  if (!config.mtalkz.key) {
    if (config.env === 'development') {
      console.log(`[DEV OTP] ${mobile}: ${otp}`);
      return true;
    }
    return false;
  }

  try {
    const response = await fetch(config.mtalkz.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: config.mtalkz.key,
        senderid: config.mtalkz.sender,
        number: mobile,
        message,
        format: 'json',
      }),
      signal: AbortSignal.timeout(15000),
    });

    return response.ok;
  } catch (error) {
    console.error('[mTalkz]', error);
    return false;
  }
}

export async function createAndSendOtp(userId: bigint, mobile: string): Promise<boolean> {
  return createAndSendOtpForMobile(mobile, userId);
}

/** Send OTP — userId optional (null = mobile not registered yet) */
export async function createAndSendOtpForMobile(mobile: string, userId?: bigint): Promise<boolean> {
  const otp = Math.floor(100000 + Math.random() * 900000);
  const sent = await sendOtpSms(mobile, otp);
  if (!sent) return false;

  const expiresAt = new Date(Date.now() + config.mtalkz.expiryMinutes * 60 * 1000);

  await prisma.otp.create({
    data: {
      user_id: userId ?? null,
      mobile,
      otp: otp.toString(),
      expires_at: expiresAt,
    },
  });

  return true;
}

export async function verifyOtpForUser(userId: bigint, mobile: string, otp: string) {
  const record = await prisma.otp.findFirst({
    where: { user_id: userId, mobile, otp, is_used: false },
    orderBy: { created_at: 'desc' },
  });

  if (!record) return { ok: false as const, reason: 'Invalid OTP' };
  if (new Date() > record.expires_at) return { ok: false as const, reason: 'OTP expired' };

  await prisma.$transaction([
    prisma.otp.update({ where: { id: record.id }, data: { is_used: true } }),
    prisma.user.update({ where: { id: userId }, data: { phone_verified: true } }),
  ]);

  return { ok: true as const };
}

/** Verify OTP by mobile only (mobile app entry — new or existing user) */
export async function verifyMobileOtp(mobile: string, otp: string) {
  const record = await prisma.otp.findFirst({
    where: { mobile, otp, is_used: false },
    orderBy: { created_at: 'desc' },
  });

  if (!record) return { ok: false as const, reason: 'Invalid OTP' };
  if (new Date() > record.expires_at) return { ok: false as const, reason: 'OTP expired' };

  await prisma.otp.update({ where: { id: record.id }, data: { is_used: true } });

  if (record.user_id) {
    await prisma.user.update({
      where: { id: record.user_id },
      data: { phone_verified: true },
    });
  }

  return { ok: true as const, userId: record.user_id };
}

export async function canResendOtp(mobile: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const lastOtp = await prisma.otp.findFirst({
    where: { mobile },
    orderBy: { created_at: 'desc' },
  });

  if (!lastOtp) return { allowed: true };

  const elapsed = Math.floor((Date.now() - lastOtp.created_at.getTime()) / 1000);
  if (elapsed < config.mtalkz.cooldownSeconds) {
    return { allowed: false, retryAfter: config.mtalkz.cooldownSeconds - elapsed };
  }
  return { allowed: true };
}
