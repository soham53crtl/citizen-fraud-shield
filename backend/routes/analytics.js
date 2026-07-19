import { Router } from "express";
import Complaint from "../models/Complaint.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// GET /api/analytics/summary — headline stats for dashboard cards
router.get("/summary", requireAuth, requireRole("police_officer", "cyber_analyst", "bank_officer", "admin"), async (req, res, next) => {
  try {
    const [total, critical, resolved, lossAgg] = await Promise.all([
      Complaint.countDocuments({}),
      Complaint.countDocuments({ riskBand: "CRITICAL" }),
      Complaint.countDocuments({ status: "resolved" }),
      Complaint.aggregate([{ $group: { _id: null, total: { $sum: "$financialLoss" } } }]),
    ]);
    res.json({
      totalReports: total,
      criticalReports: critical,
      resolvedReports: resolved,
      totalFinancialLoss: lossAgg[0]?.total || 0,
    });
  } catch (err) { next(err); }
});

// GET /api/analytics/by-category?months=6
router.get("/by-category", requireAuth, requireRole("police_officer", "cyber_analyst", "admin"), async (req, res, next) => {
  try {
    const months = Number(req.query.months) || 6;
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const rows = await Complaint.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" }, category: "$category" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
    res.json({ rows });
  } catch (err) { next(err); }
});

// GET /api/analytics/hotspots
router.get("/hotspots", requireAuth, requireRole("police_officer", "cyber_analyst", "admin"), async (req, res, next) => {
  try {
    const rows = await Complaint.aggregate([
      { $match: { "location.district": { $ne: null } } },
      { $group: { _id: "$location.district", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    res.json({ hotspots: rows });
  } catch (err) { next(err); }
});

export default router;
