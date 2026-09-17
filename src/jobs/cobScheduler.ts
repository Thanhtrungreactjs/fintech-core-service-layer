import cron from "node-cron";
import { cobService } from "../services/cobService";
import { env } from "../config/env";

/**
 * T24 thật chạy Close of Business tự động mỗi đêm — không ai bấm tay. Đây là bản tương
 * đương: đăng ký 1 cron job gọi lại đúng cobService.run() (cùng logic hệt nút "Chạy COB
 * ngay" trong UI/API), lên lịch qua COB_CRON_SCHEDULE (mặc định 00:00 mỗi ngày).
 */
export function startCobScheduler(): void {
  if (!cron.validate(env.cobCronSchedule)) {
    console.error(`[COB scheduler] COB_CRON_SCHEDULE không hợp lệ: '${env.cobCronSchedule}' — scheduler KHÔNG khởi động`);
    return;
  }

  cron.schedule(env.cobCronSchedule, async () => {
    console.log(`[COB scheduler] Bắt đầu chạy batch cuối ngày lúc ${new Date().toISOString()}`);
    try {
      const run = await cobService.run();
      console.log(
        `[COB scheduler] Hoàn tất #${run.cob_run_id}: ${run.term_deposits_matured} sổ đáo hạn, ` +
          `${run.loans_marked_defaulted} khoản vay chuyển nợ xấu, ${run.errors_count} lỗi`
      );
    } catch (err) {
      console.error("[COB scheduler] Lỗi khi chạy COB tự động:", err);
    }
  });

  console.log(`[COB scheduler] Đã lên lịch chạy tự động theo cron '${env.cobCronSchedule}'`);
}
