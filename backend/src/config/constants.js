export const ROLES = Object.freeze({
    ADMIN: "ADMIN",
    MANAGER: "MANAGER",
    CONSULTANT: "CONSULTANT",
    FINANCE: "FINANCE",
    LEGAL: "LEGAL",
    OPS: "OPS",
  });

  export const SERVICE_REQUEST_STATUS = Object.freeze({
    PENDING_REVIEW: "PENDING_REVIEW",
    CONSULTANT_ACCEPTED: "CONSULTANT_ACCEPTED",
    CONSULTANT_REJECTED: "CONSULTANT_REJECTED",
  });

  export const OFFER_STATUS = Object.freeze({
    DRAFT: "DRAFT",
    SUBMITTED_TO_MANAGER: "SUBMITTED_TO_MANAGER",
    MANAGER_APPROVED: "MANAGER_APPROVED",
    MANAGER_REJECTED: "MANAGER_REJECTED",
  });

  export const CONTRACT_STATUS = Object.freeze({
    CONTRACT_DRAFT: "CONTRACT_DRAFT",
    CONTRACT_UPLOADED: "CONTRACT_UPLOADED",
    CONTRACT_SIGNED: "CONTRACT_SIGNED",
  });

  export const PROJECT_STATUS = Object.freeze({
    DRAFT: "DRAFT",
    ACTIVE: "ACTIVE",
    CLOSED: "CLOSED",
    ARCHIVED: "ARCHIVED",
  });

  export const MILESTONE_STATUS = Object.freeze({
    PLANNED: "PLANNED",
    IN_PROGRESS: "IN_PROGRESS",
    DONE: "DONE",
    CANCELLED: "CANCELLED",
  });

  export const TASK_STATUS = Object.freeze({
    TODO: "TODO",
    IN_PROGRESS: "IN_PROGRESS",
    OVERDUE: "OVERDUE",
    DONE: "DONE",
    CANCELLED: "CANCELLED",
  });

  export const PRIORITY = Object.freeze({
    LOW: "LOW",
    NORMAL: "NORMAL",
    HIGH: "HIGH",
    URGENT: "URGENT",
  });

  export const PARTNER_TYPE = Object.freeze({
    SUBCONTRACTOR: "SUBCONTRACTOR",
    LAB: "LAB",
  });

  export const INVOICE_STATUS = Object.freeze({
    DRAFT: "DRAFT",
    ISSUED: "ISSUED",
    PARTIALLY_PAID: "PARTIALLY_PAID",
    PAID: "PAID",
    VOID: "VOID",
  });

  export const PAYMENT_STATUS = Object.freeze({
    PENDING: "PENDING",
    RECEIVED: "RECEIVED",
    FAILED: "FAILED",
    REFUNDED: "REFUNDED",
  });

  export const NOTIF_TYPE = Object.freeze({
    INFO: "INFO",
    WARN: "WARN",
    ACTION: "ACTION",
  });

  // Allowed transitions (backend validation) – DB check constraints still enforce values
  export const TRANSITIONS = Object.freeze({
    serviceRequest: Object.freeze({
      [SERVICE_REQUEST_STATUS.PENDING_REVIEW]: [
        SERVICE_REQUEST_STATUS.CONSULTANT_ACCEPTED,
        SERVICE_REQUEST_STATUS.CONSULTANT_REJECTED,
      ],
      [SERVICE_REQUEST_STATUS.CONSULTANT_ACCEPTED]: [],
      [SERVICE_REQUEST_STATUS.CONSULTANT_REJECTED]: [],
    }),

    offer: Object.freeze({
      [OFFER_STATUS.DRAFT]: [OFFER_STATUS.SUBMITTED_TO_MANAGER],
      [OFFER_STATUS.SUBMITTED_TO_MANAGER]: [
        OFFER_STATUS.MANAGER_APPROVED,
        OFFER_STATUS.MANAGER_REJECTED,
      ],
      [OFFER_STATUS.MANAGER_REJECTED]: [OFFER_STATUS.SUBMITTED_TO_MANAGER],
      [OFFER_STATUS.MANAGER_APPROVED]: [],
    }),

    contract: Object.freeze({
      [CONTRACT_STATUS.CONTRACT_DRAFT]: [CONTRACT_STATUS.CONTRACT_UPLOADED],
      [CONTRACT_STATUS.CONTRACT_UPLOADED]: [
        CONTRACT_STATUS.CONTRACT_SIGNED,
        CONTRACT_STATUS.CONTRACT_DRAFT,
      ],
      [CONTRACT_STATUS.CONTRACT_SIGNED]: [],
    }),

    project: Object.freeze({
      [PROJECT_STATUS.DRAFT]: [PROJECT_STATUS.ACTIVE],
      [PROJECT_STATUS.ACTIVE]: [PROJECT_STATUS.CLOSED],
      [PROJECT_STATUS.CLOSED]: [PROJECT_STATUS.ARCHIVED],
      [PROJECT_STATUS.ARCHIVED]: [],
    }),
  });

  export function canTransition(domain, fromStatus, toStatus) {
    const map = TRANSITIONS?.[domain];
    if (!map) return false;
    const allowed = map?.[fromStatus] || [];
    return allowed.includes(toStatus);
  }
