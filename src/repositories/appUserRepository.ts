import { pool, Executor } from "../db/pool";
import { AppUser, AppUserWithPassword } from "../types/domain";

const PUBLIC_COLUMNS = "user_id, username, display_name, role, created_at";

export const appUserRepository = {
  async list(): Promise<AppUser[]> {
    const { rows } = await pool.query<AppUser>(`SELECT ${PUBLIC_COLUMNS} FROM app_users ORDER BY user_id`);
    return rows;
  },

  async findById(id: number, exec: Executor = pool): Promise<AppUser | null> {
    const { rows } = await exec.query<AppUser>(
      `SELECT ${PUBLIC_COLUMNS} FROM app_users WHERE user_id = :id`,
      { id }
    );
    return rows[0] ?? null;
  },

  /** Có password_hash — CHỈ dùng để xác thực đăng nhập, không bao giờ trả thẳng ra API. */
  async findByUsername(username: string): Promise<AppUserWithPassword | null> {
    const { rows } = await pool.query<AppUserWithPassword>(
      `SELECT * FROM app_users WHERE username = :username`,
      { username }
    );
    return rows[0] ?? null;
  },
};
