import prisma from '../lib/prisma';
import { verifyPassword } from '../lib/bcrypt';
import { signAdminToken } from '../lib/jwt';
import { AppError, ErrorCode } from '../utils/errors';

export async function loginAdmin(email: string, password: string) {
  const admin = await prisma.admin.findFirst({ where: { email } });
  if (!admin) throw AppError.unauthorized('Invalid credentials', ErrorCode.AUTH_INVALID);

  const valid = await verifyPassword(password, admin.password);
  if (!valid) throw AppError.unauthorized('Invalid credentials', ErrorCode.AUTH_INVALID);

  const token = signAdminToken(admin.id, admin.email);
  const { password: _, ...safe } = admin;
  return { admin: safe, token };
}

export async function getDashboardStats() {
  const [total, premium, pending, deleted] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'premium' } }),
    prisma.user.count({ where: { status: 'pending' } }),
    prisma.user.count({ where: { status: 'deleted' } }),
  ]);

  const recentSubscriptions = await prisma.subscription.findMany({
    take: 10,
    orderBy: { created_at: 'desc' },
    include: { user: { select: { name: true, member_id: true, email: true } }, plan: true },
  });

  return { total, premium, pending, deleted, recentSubscriptions };
}
