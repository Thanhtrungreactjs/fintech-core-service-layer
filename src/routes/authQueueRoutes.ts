import { Router } from "express";
import { authQueueController } from "../controllers/authQueueController";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { idParam } from "../validators/common";
import { enqueueBody, rejectBody, listAuthQueueQuery } from "../validators/authQueueSchemas";

export const authQueueRoutes = Router();

// Toàn bộ thao tác ghi (nộp lệnh / duyệt / từ chối) bắt buộc đăng nhập — maker_id/checker_id
// luôn lấy từ req.user (JWT đã xác thực), không nhận từ request body.
authQueueRoutes.post("/", requireAuth(), validate({ body: enqueueBody }), authQueueController.enqueue);
authQueueRoutes.get("/", validate({ query: listAuthQueueQuery }), authQueueController.list);
authQueueRoutes.get("/:id", validate({ params: idParam("id") }), authQueueController.getById);
authQueueRoutes.post(
  "/:id/authorize",
  requireAuth(),
  validate({ params: idParam("id") }),
  authQueueController.authorize
);
authQueueRoutes.post(
  "/:id/reject",
  requireAuth(),
  validate({ params: idParam("id"), body: rejectBody }),
  authQueueController.reject
);
