import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { ROLES } from "../config/constants.js";
import {
  createServiceRequest,
  listServiceRequests,
  getServiceRequestById,
  reviewServiceRequest,
  deleteServiceRequest,
  getServiceRequestAttachments,
  updateServiceRequest,
} from "../controllers/serviceRequests.controller.js";

const router = Router();

// Any authenticated user can create/list/view
router.post("/", requireAuth, createServiceRequest);
router.get("/", requireAuth, listServiceRequests);

// Specific routes before parameterized routes
router.get("/:id/attachments", requireAuth, getServiceRequestAttachments);
router.post(
  "/:id/review",
  requireAuth,
  requireRole([ROLES.CONSULTANT, ROLES.ADMIN]),
  reviewServiceRequest
);

// Parameterized routes (order matters - more specific first)
router.patch(
  "/:id",
  requireAuth,
  requireRole([ROLES.MANAGER, ROLES.ADMIN]),
  updateServiceRequest
);
router.delete(
  "/:id",
  requireAuth,
  requireRole([ROLES.MANAGER, ROLES.ADMIN]),
  deleteServiceRequest
);
router.get("/:id", requireAuth, getServiceRequestById);

export const serviceRequestsRoutes = router;
