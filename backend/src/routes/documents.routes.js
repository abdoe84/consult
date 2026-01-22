import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { createDocument, attachDocument, detachDocument, listByEntity } from "../controllers/documents.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/", createDocument);
router.post("/attach", attachDocument);
router.post("/detach", detachDocument);
router.get("/by-entity", listByEntity);

export default router;
