import { pool, Executor } from "../db/pool";
import { AuthQueueEntry, AuthQueueOperationType, AuthQueueStatus } from "../types/domain";

export const authQueueRepository = {
  async findById(id: number, exec: Executor = pool): Promise<AuthQueueEntry | null> {
    const { rows } = await exec.query<AuthQueueEntry>(`SELECT * FROM auth_queue WHERE queue_id = :id`, { id });
    return rows[0] ?? null;
  },

  async findByIdForUpdate(id: number, exec: Executor): Promise<AuthQueueEntry | null> {
    const { rows } = await exec.query<AuthQueueEntry>(
      `SELECT * FROM auth_queue WHERE queue_id = :id FOR UPDATE`,
      { id }
    );
    return rows[0] ?? null;
  },

  async list(status: AuthQueueStatus | undefined, limit: number, offset: number) {
    const where = status ? `WHERE status = :status` : "";
    const params: Record<string, unknown> = { limit, offset, status };
    const { rows } = await pool.query<AuthQueueEntry>(
      `SELECT * FROM auth_queue ${where} ORDER BY queue_id DESC LIMIT :limit OFFSET :offset`,
      params
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM auth_queue ${where}`,
      params
    );
    return { rows, total: Number(countRows[0]?.total ?? 0) };
  },

  async create(
    input: { operation_type: AuthQueueOperationType; payload: Record<string, unknown>; maker_id: number },
    exec: Executor = pool
  ): Promise<AuthQueueEntry> {
    const { rows } = await exec.query<AuthQueueEntry>(
      `INSERT INTO auth_queue (operation_type, payload, maker_id)
       VALUES (:operation_type, :payload::jsonb, :maker_id)
       RETURNING *`,
      {
        operation_type: input.operation_type,
        payload: JSON.stringify(input.payload),
        maker_id: input.maker_id,
      }
    );
    return rows[0];
  },

  /** Nhận lock để authorize — chuyển pending -> authorized ngay trong bước này (xem authQueueService.authorize). */
  async claimForAuthorization(id: number, checkerId: number, exec: Executor): Promise<void> {
    await exec.query(
      `UPDATE auth_queue SET status = 'authorized', checker_id = :checkerId, decided_at = now()
       WHERE queue_id = :id`,
      { id, checkerId }
    );
  },

  /** Hoàn tác claim nếu executor thất bại — trả lại hàng đợi 'pending' để checker thử lại. */
  async revertClaim(id: number, exec: Executor): Promise<void> {
    await exec.query(
      `UPDATE auth_queue SET status = 'pending', checker_id = NULL, decided_at = NULL WHERE queue_id = :id`,
      { id }
    );
  },

  async attachResult(id: number, result: unknown, exec: Executor = pool): Promise<void> {
    await exec.query(`UPDATE auth_queue SET result = :result::jsonb WHERE queue_id = :id`, {
      id,
      result: JSON.stringify(result),
    });
  },

  async reject(id: number, checkerId: number, reason: string, exec: Executor = pool): Promise<void> {
    await exec.query(
      `UPDATE auth_queue SET status = 'rejected', checker_id = :checkerId, decided_at = now(), reject_reason = :reason
       WHERE queue_id = :id`,
      { id, checkerId, reason }
    );
  },
};
