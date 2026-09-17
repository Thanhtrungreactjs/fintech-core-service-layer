import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { appUserRepository } from "../repositories/appUserRepository";
import { AppUser } from "../types/domain";
import { Errors } from "../utils/errors";
import { env } from "../config/env";

export interface AuthTokenPayload {
  user_id: number;
  username: string;
  role: AppUser["role"];
}

export const authService = {
  /** Xác thực username/password (bcrypt) và cấp JWT — đây là NGUỒN DUY NHẤT xác định danh
   * tính maker/checker từ nay; middleware requireAuth giải mã token này, không tin request body. */
  async login(username: string, password: string): Promise<{ token: string; user: AppUser }> {
    const record = await appUserRepository.findByUsername(username);
    if (!record) throw Errors.unauthorized("Sai tên đăng nhập hoặc mật khẩu");

    const ok = await bcrypt.compare(password, record.password_hash);
    if (!ok) throw Errors.unauthorized("Sai tên đăng nhập hoặc mật khẩu");

    const payload: AuthTokenPayload = { user_id: record.user_id, username: record.username, role: record.role };
    const token = jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] });

    const { password_hash: _unused, ...user } = record;
    return { token, user };
  },

  verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, env.jwtSecret) as unknown as AuthTokenPayload;
    } catch {
      throw Errors.unauthorized("Token không hợp lệ hoặc đã hết hạn");
    }
  },
};
