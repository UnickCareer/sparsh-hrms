// server/routes/itRoutes.js

import express from "express";

import {
    getTickets,
    getTicketById,
    createTicket,
    updateTicket,
    addTicketUpdate,
    deleteTicket,
    getITNotifications,
    markITNotificationRead,
} from "../controllers/itController.js";

const router = express.Router();


// ============================================================
// IT TICKETS
// ============================================================

router.get(
    "/tickets",
    getTickets
);

router.get(
    "/tickets/:id",
    getTicketById
);

router.post(
    "/tickets",
    createTicket
);

router.patch(
    "/tickets/:id",
    updateTicket
);

router.post(
    "/tickets/:id/updates",
    addTicketUpdate
);

router.delete(
    "/tickets/:id",
    deleteTicket
);


// ============================================================
// IT NOTIFICATIONS
// ============================================================

router.get(
    "/notifications",
    getITNotifications
);

router.patch(
    "/notifications/:id/read",
    markITNotificationRead
);


export default router;