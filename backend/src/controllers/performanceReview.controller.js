import pool from "../config/db.js";

// ============================================================
// Helper: Get complete review with employee, cycle and goals
// ============================================================

const REVIEW_SELECT = `
    SELECT
        pr.*,

        e.full_name AS employee_name,
        e.employee_code,
        e.department,
        e.designation,
        e.reporting_manager,
        e.reporting_manager_designation,
        e.reporting_manager_email,

        pc.name AS cycle_name,
        pc.financial_year,
        pc.start_date AS cycle_start_date,
        pc.end_date AS cycle_end_date,
        pc.status AS cycle_status,

        COALESCE(
            (
                SELECT json_agg(
                    json_build_object(
                        'id', pg.id,
                        'goal_number', pg.goal_number,
                        'goal_category', pg.goal_category,
                        'goal_description', pg.goal_description,
                        'weightage', pg.weightage,
                        'employee_comments', pg.employee_comments,
                        'manager_comments', pg.manager_comments,
                        'employee_rating', pg.employee_rating,
                        'manager_rating', pg.manager_rating,
                        'status', pg.status
                    )
                    ORDER BY pg.goal_number
                )
                FROM performance_goals pg
                WHERE pg.review_id = pr.id
            ),
            '[]'::json
        ) AS goals

    FROM performance_reviews pr

    JOIN employees e
        ON pr.employee_id = e.id

    JOIN performance_cycles pc
        ON pr.cycle_id = pc.id
`;


// ============================================================
// Helper: Create notification
// ============================================================
//
// Uses the existing notifications table.
//
// IMPORTANT:
// The notification read flag used by this implementation is:
//
//     is_read
//
// NOT:
//
//     read_at
//
// ============================================================

const createNotification = async (
    client,
    {
        recipientEmployeeId,
        title,
        message,
        type = "performance",
        referenceId = null,
        referenceType = "performance_review",
    }
) => {
    if (!recipientEmployeeId) {
        return null;
    }

    const result = await client.query(
        `
        INSERT INTO notifications
        (
            recipient_employee_id,
            title,
            message,
            type,
            reference_id,
            reference_type,
            is_read,
            created_at
        )
        VALUES
        (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            false,
            NOW()
        )
        RETURNING
            id,
            recipient_employee_id,
            title,
            message,
            type,
            reference_id,
            reference_type,
            is_read,
            created_at
        `,
        [
            recipientEmployeeId,
            title,
            message,
            type,
            referenceId,
            referenceType,
        ]
    );

    return result.rows[0];
};


// ============================================================
// Helper: Get performance approvers
// ============================================================
//
// Admin / HR / Manager / Owner / is_admin users receive
// performance review submission notifications.
//
// ============================================================

const getPerformanceApprovers = async (client) => {
    const result = await client.query(
        `
        SELECT
            id,
            full_name,
            employee_code,
            role
        FROM employees
        WHERE LOWER(
            COALESCE(role, '')
        ) IN (
            'admin',
            'hr',
            'manager',
            'owner'
        )
        ORDER BY id
        `
    );

    return result.rows;
};


// ============================================================
// Helper: Notify all performance approvers
// ============================================================

const notifyPerformanceApprovers = async (
    client,
    {
        employeeId,
        employeeName,
        financialYear,
        reviewId,
        isResubmission = false,
    }
) => {
    const approvers =
        await getPerformanceApprovers(client);

    const title = isResubmission
        ? "Performance Review Resubmitted"
        : "Performance Review Submitted";

    const message = isResubmission
        ? `${employeeName} has resubmitted their performance review for ${financialYear} after correction. It is waiting for approval.`
        : `${employeeName} has submitted their performance review for ${financialYear}. It is waiting for approval.`;

    const notifications = [];

    for (const approver of approvers) {
        if (
            Number(approver.id) ===
            Number(employeeId)
        ) {
            continue;
        }

        const notification =
            await createNotification(
                client,
                {
                    recipientEmployeeId:
                        approver.id,

                    title,

                    message,

                    type: "performance",

                    referenceId: reviewId,

                    referenceType:
                        "performance_review",
                }
            );

        notifications.push(notification);
    }

    return notifications;
};


// ============================================================
// GET MY PERFORMANCE REVIEWS
// GET /api/performance-reviews/my/:employeeId
// ============================================================

export const getMyPerformanceReviews = async (
    req,
    res
) => {
    try {
        const { employeeId } = req.params;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message:
                    "Employee ID is required",
            });
        }

        const result = await pool.query(
            `
            ${REVIEW_SELECT}

            WHERE pr.employee_id = $1

            ORDER BY
                pc.start_date DESC,
                pr.created_at DESC
            `,
            [employeeId]
        );

        return res.json({
            success: true,
            reviews: result.rows,
        });
    } catch (err) {
        console.error(
            "getMyPerformanceReviews error:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error fetching performance reviews",
        });
    }
};


// ============================================================
// GET SINGLE PERFORMANCE REVIEW
// GET /api/performance-reviews/:reviewId
// ============================================================

export const getPerformanceReviewById = async (
    req,
    res
) => {
    try {
        const { reviewId } = req.params;

        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message:
                    "Review ID is required",
            });
        }

        const result = await pool.query(
            `
            ${REVIEW_SELECT}

            WHERE pr.id = $1
            `,
            [reviewId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Performance review not found",
            });
        }

        return res.json({
            success: true,
            review: result.rows[0],
        });
    } catch (err) {
        console.error(
            "getPerformanceReviewById error:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error fetching performance review",
        });
    }
};


// ============================================================
// CREATE PERFORMANCE REVIEW
// POST /api/performance-reviews
//
// Body:
// {
//     cycle_id: 1,
//     employee_id: 44
// }
// ============================================================

export const createPerformanceReview = async (
    req,
    res
) => {
    const client = await pool.connect();

    try {
        const {
            cycle_id,
            employee_id,
        } = req.body;

        if (!cycle_id || !employee_id) {
            return res.status(400).json({
                success: false,
                message:
                    "cycle_id and employee_id are required",
            });
        }

        await client.query("BEGIN");

        // ----------------------------------------------------
        // Check cycle
        // ----------------------------------------------------

        const cycleResult =
            await client.query(
                `
                SELECT *
                FROM performance_cycles
                WHERE id = $1
                `,
                [cycle_id]
            );

        if (cycleResult.rows.length === 0) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(404).json({
                success: false,
                message:
                    "Performance cycle not found",
            });
        }

        const cycle =
            cycleResult.rows[0];

        // ----------------------------------------------------
        // Only allow reviews for Active cycles
        // ----------------------------------------------------

        if (cycle.status !== "Active") {
            await client.query(
                "ROLLBACK"
            );

            return res.status(400).json({
                success: false,
                message:
                    "This performance cycle is not active",
            });
        }

        // ----------------------------------------------------
        // Check employee
        // ----------------------------------------------------

        const employeeResult =
            await client.query(
                `
                SELECT *
                FROM employees
                WHERE id = $1
                `,
                [employee_id]
            );

        if (
            employeeResult.rows.length === 0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(404).json({
                success: false,
                message:
                    "Employee not found",
            });
        }

        // ----------------------------------------------------
        // Prevent duplicate review
        // ----------------------------------------------------

        const existingResult =
            await client.query(
                `
                SELECT id
                FROM performance_reviews
                WHERE cycle_id = $1
                  AND employee_id = $2
                `,
                [
                    cycle_id,
                    employee_id,
                ]
            );

        if (
            existingResult.rows.length > 0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(409).json({
                success: false,
                message:
                    "Performance review already exists for this employee and cycle",
                review_id:
                    existingResult.rows[0]
                        .id,
            });
        }

        // ----------------------------------------------------
        // Create review
        // ----------------------------------------------------

        const reviewResult =
            await client.query(
                `
                INSERT INTO performance_reviews
                (
                    cycle_id,
                    employee_id,
                    status,
                    current_stage
                )
                VALUES
                (
                    $1,
                    $2,
                    'Not Started',
                    'Goals'
                )
                RETURNING *
                `,
                [
                    cycle_id,
                    employee_id,
                ]
            );

        const review =
            reviewResult.rows[0];

        // ----------------------------------------------------
        // Create default 5 goals
        // ----------------------------------------------------

        const defaultGoals = [
            {
                number: 1,
                category:
                    "Business outcome related",
                description: null,
                weightage: 20,
            },
            {
                number: 2,
                category:
                    "Business outcome related",
                description: null,
                weightage: 20,
            },
            {
                number: 3,
                category:
                    "Business outcome related",
                description: null,
                weightage: 20,
            },
            {
                number: 4,
                category:
                    "Personal development (ownership of work)",
                description:
                    "- Solution Mindset\n- Proactiveness\n- Reliability & Responsibility",
                weightage: 20,
            },
            {
                number: 5,
                category:
                    "Team development (communication & collaboration)",
                description:
                    "- Open & Clear Communication\n- Streamlining Channels & Response Time\n- Removing Silos",
                weightage: 20,
            },
        ];

        for (const goal of defaultGoals) {
            await client.query(
                `
                INSERT INTO performance_goals
                (
                    review_id,
                    goal_number,
                    goal_category,
                    goal_description,
                    weightage,
                    status
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    'Locked'
                )
                `,
                [
                    review.id,
                    goal.number,
                    goal.category,
                    goal.description,
                    goal.weightage,
                ]
            );
        }

        // ----------------------------------------------------
        // History
        // ----------------------------------------------------

        await client.query(
            `
            INSERT INTO performance_review_history
            (
                review_id,
                action,
                performed_by,
                old_status,
                new_status
            )
            VALUES
            (
                $1,
                'Review Created',
                $2,
                NULL,
                'Not Started'
            )
            `,
            [
                review.id,
                employee_id,
            ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message:
                "Performance review created successfully",
            review,
        });
    } catch (err) {
        await client.query(
            "ROLLBACK"
        );

        console.error(
            "createPerformanceReview error:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error creating performance review",
        });
    } finally {
        client.release();
    }
};


// ============================================================
// START PERFORMANCE REVIEW
// PATCH /api/performance-reviews/:reviewId/start
//
// Employee:
//
// Not Started
//      ↓
// Goals
//
// Also unlocks default goals.
// ============================================================

export const startPerformanceReview = async (
    req,
    res
) => {
    const client = await pool.connect();

    try {
        const { reviewId } =
            req.params;

        const { employee_id } =
            req.body;

        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message:
                    "Review ID is required",
            });
        }

        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message:
                    "employee_id is required",
            });
        }

        await client.query("BEGIN");

        // ----------------------------------------------------
        // Get review + cycle
        // ----------------------------------------------------

        const reviewResult =
            await client.query(
                `
                SELECT
                    pr.*,
                    pc.status AS cycle_status
                FROM performance_reviews pr

                JOIN performance_cycles pc
                    ON pr.cycle_id = pc.id

                WHERE pr.id = $1

                FOR UPDATE
                `,
                [reviewId]
            );

        if (
            reviewResult.rows.length === 0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(404).json({
                success: false,
                message:
                    "Performance review not found",
            });
        }

        const review =
            reviewResult.rows[0];

        // ----------------------------------------------------
        // Verify employee owns review
        // ----------------------------------------------------

        if (
            Number(employee_id) !==
            Number(review.employee_id)
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to start this review",
            });
        }

        // ----------------------------------------------------
        // Check cycle
        // ----------------------------------------------------

        if (
            review.cycle_status !==
            "Active"
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(400).json({
                success: false,
                message:
                    "This performance cycle is not active",
            });
        }

        // ----------------------------------------------------
        // Review must be Not Started
        // ----------------------------------------------------

        if (
            review.status !==
            "Not Started"
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(400).json({
                success: false,
                message:
                    `This performance review cannot be started because its current status is "${review.status}"`,
            });
        }

        // ----------------------------------------------------
        // Update review
        // ----------------------------------------------------

        const updatedReviewResult =
            await client.query(
                `
                UPDATE performance_reviews
                SET
                    status = 'Goals',
                    current_stage = 'Goals',
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
                `,
                [reviewId]
            );

        const updatedReview =
            updatedReviewResult
                .rows[0];

        // ----------------------------------------------------
        // Unlock employee goals
        // ----------------------------------------------------

        await client.query(
            `
            UPDATE performance_goals
            SET
                status = 'Open',
                updated_at = NOW()
            WHERE review_id = $1
              AND status = 'Locked'
            `,
            [reviewId]
        );

        // ----------------------------------------------------
        // History
        // ----------------------------------------------------

        await client.query(
            `
            INSERT INTO performance_review_history
            (
                review_id,
                action,
                performed_by,
                old_status,
                new_status
            )
            VALUES
            (
                $1,
                'Employee Started Performance Review',
                $2,
                $3,
                'Goals'
            )
            `,
            [
                reviewId,
                employee_id,
                review.status,
            ]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message:
                "Performance review started successfully",
            review: updatedReview,
        });
    } catch (err) {
        await client.query(
            "ROLLBACK"
        );

        console.error(
            "startPerformanceReview error:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error starting performance review",
        });
    } finally {
        client.release();
    }
};


// ============================================================
// UPDATE PERFORMANCE REVIEW
// PATCH /api/performance-reviews/:reviewId
// ============================================================

export const updatePerformanceReview = async (
    req,
    res
) => {
    const client = await pool.connect();

    try {
        const { reviewId } =
            req.params;

        const {
            current_stage,
            manager_comments,
            hr_comments,
            final_rating,
            employee_id,
        } = req.body;

        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message:
                    "Review ID is required",
            });
        }

        await client.query("BEGIN");

        // ----------------------------------------------------
        // Get existing review
        // ----------------------------------------------------

        const existingResult =
            await client.query(
                `
                SELECT *
                FROM performance_reviews
                WHERE id = $1
                FOR UPDATE
                `,
                [reviewId]
            );

        if (
            existingResult.rows.length ===
            0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(404).json({
                success: false,
                message:
                    "Performance review not found",
            });
        }

        const existing =
            existingResult.rows[0];

        // ----------------------------------------------------
        // Optional employee ownership check
        // ----------------------------------------------------

        if (
            employee_id &&
            Number(employee_id) !==
                Number(existing.employee_id)
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to update this performance review",
            });
        }

        // ----------------------------------------------------
        // Update
        // ----------------------------------------------------

        const result =
            await client.query(
                `
                UPDATE performance_reviews
                SET
                    current_stage =
                        COALESCE(
                            $1,
                            current_stage
                        ),

                    manager_comments =
                        COALESCE(
                            $2,
                            manager_comments
                        ),

                    hr_comments =
                        COALESCE(
                            $3,
                            hr_comments
                        ),

                    final_rating =
                        COALESCE(
                            $4,
                            final_rating
                        ),

                    updated_at = NOW()

                WHERE id = $5

                RETURNING *
                `,
                [
                    current_stage ??
                        null,

                    manager_comments ??
                        null,

                    hr_comments ??
                        null,

                    final_rating ??
                        null,

                    reviewId,
                ]
            );

        // ----------------------------------------------------
        // History
        // ----------------------------------------------------

        await client.query(
            `
            INSERT INTO performance_review_history
            (
                review_id,
                action,
                performed_by,
                old_status,
                new_status
            )
            VALUES
            (
                $1,
                'Review Updated',
                $2,
                $3,
                $4
            )
            `,
            [
                reviewId,

                employee_id ??
                    existing.employee_id,

                existing.status,

                result.rows[0]
                    .status,
            ]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message:
                "Performance review updated successfully",
            review:
                result.rows[0],
        });
    } catch (err) {
        await client.query(
            "ROLLBACK"
        );

        console.error(
            "updatePerformanceReview error:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error updating performance review",
        });
    } finally {
        client.release();
    }
};


// ============================================================
// UPDATE PERFORMANCE GOAL
// PATCH /api/performance-reviews/goals/:goalId
//
// Employee:
// {
//     goal_description,
//     employee_comments,
//     employee_rating,
//     employee_id
// }
//
// Manager:
// {
//     manager_comments,
//     manager_rating,
//     employee_id
// }
//
// ============================================================

export const updatePerformanceGoal = async (
    req,
    res
) => {
    try {
        const { goalId } =
            req.params;

        const {
            goal_description,
            employee_comments,
            employee_rating,
            manager_comments,
            manager_rating,
            employee_id,
        } = req.body;

        if (!goalId) {
            return res.status(400).json({
                success: false,
                message:
                    "Goal ID is required",
            });
        }

        // ----------------------------------------------------
        // Get goal + review + cycle
        // ----------------------------------------------------

        const goalResult =
            await pool.query(
                `
                SELECT
                    pg.*,

                    pr.employee_id,
                    pr.status AS review_status,
                    pr.current_stage,

                    pc.status AS cycle_status

                FROM performance_goals pg

                JOIN performance_reviews pr
                    ON pg.review_id = pr.id

                JOIN performance_cycles pc
                    ON pr.cycle_id = pc.id

                WHERE pg.id = $1
                `,
                [goalId]
            );

        if (
            goalResult.rows.length ===
            0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Performance goal not found",
            });
        }

        const goal =
            goalResult.rows[0];

        // ----------------------------------------------------
        // Verify employee owns review
        // ----------------------------------------------------

        if (
            employee_id &&
            Number(employee_id) !==
                Number(goal.employee_id)
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to update this performance goal",
            });
        }

        // ----------------------------------------------------
        // Cycle must be active
        // ----------------------------------------------------

        if (
            goal.cycle_status !==
            "Active"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This performance cycle is not active",
            });
        }

        // ----------------------------------------------------
        // Goal must not be locked/submitted/approved
        // ----------------------------------------------------

        if (
            goal.status ===
                "Locked" ||
            goal.status ===
                "Submitted" ||
            goal.status ===
                "Approved"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "This goal is currently locked",
            });
        }

        // ----------------------------------------------------
        // Determine employee update
        // ----------------------------------------------------

        const isEmployeeUpdate =
            goal_description !==
                undefined ||
            employee_comments !==
                undefined ||
            employee_rating !==
                undefined;

        // ----------------------------------------------------
        // Employee editable stages
        // ----------------------------------------------------

        if (
            isEmployeeUpdate &&
            goal.review_status !==
                "Goals" &&
            goal.review_status !==
                "Self Assessment" &&
            goal.review_status !==
                "Needs Correction"
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Employee goal information cannot be edited at this stage",
            });
        }

        // ----------------------------------------------------
        // Update goal
        // ----------------------------------------------------

        const result =
            await pool.query(
                `
                UPDATE performance_goals
                SET
                    goal_description =
                        COALESCE(
                            $1,
                            goal_description
                        ),

                    employee_comments =
                        COALESCE(
                            $2,
                            employee_comments
                        ),

                    employee_rating =
                        COALESCE(
                            $3,
                            employee_rating
                        ),

                    manager_comments =
                        COALESCE(
                            $4,
                            manager_comments
                        ),

                    manager_rating =
                        COALESCE(
                            $5,
                            manager_rating
                        ),

                    updated_at = NOW()

                WHERE id = $6

                RETURNING *
                `,
                [
                    goal_description ??
                        null,

                    employee_comments ??
                        null,

                    employee_rating ??
                        null,

                    manager_comments ??
                        null,

                    manager_rating ??
                        null,

                    goalId,
                ]
            );

        return res.json({
            success: true,
            message:
                "Performance goal updated successfully",
            goal:
                result.rows[0],
        });
    } catch (err) {
        console.error(
            "updatePerformanceGoal error:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error updating performance goal",
        });
    }
};


// ============================================================
// MOVE GOALS → SELF ASSESSMENT
// PATCH /api/performance-reviews/:reviewId/self-assessment
//
// Normal:
//
// Goals
//   ↓
// Self Assessment
//
// Correction:
//
// Needs Correction
//   ↓
// Self Assessment
// ============================================================

export const startSelfAssessment = async (
    req,
    res
) => {
    const client = await pool.connect();

    try {
        const { reviewId } =
            req.params;

        const { employee_id } =
            req.body;

        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message:
                    "Review ID is required",
            });
        }

        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message:
                    "employee_id is required",
            });
        }

        await client.query("BEGIN");

        // ----------------------------------------------------
        // Get review + cycle
        // ----------------------------------------------------

        const reviewResult =
            await client.query(
                `
                SELECT
                    pr.*,

                    e.full_name AS employee_name,
                    e.employee_code,

                    pc.name AS cycle_name,
                    pc.financial_year,
                    pc.status AS cycle_status

                FROM performance_reviews pr

                JOIN employees e
                    ON pr.employee_id = e.id

                JOIN performance_cycles pc
                    ON pr.cycle_id = pc.id

                WHERE pr.id = $1

                FOR UPDATE
                `,
                [reviewId]
            );

        if (
            reviewResult.rows.length ===
            0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(404).json({
                success: false,
                message:
                    "Performance review not found",
            });
        }

        const review =
            reviewResult.rows[0];

        // ----------------------------------------------------
        // Verify employee
        // ----------------------------------------------------

        if (
            Number(employee_id) !==
            Number(review.employee_id)
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to update this performance review",
            });
        }

        // ----------------------------------------------------
        // Check cycle
        // ----------------------------------------------------

        if (
            review.cycle_status !==
            "Active"
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(400).json({
                success: false,
                message:
                    "This performance cycle is not active",
            });
        }

        // ----------------------------------------------------
        // Allow Goals or Needs Correction
        // ----------------------------------------------------

        if (
            review.status !== "Goals" &&
            review.status !==
                "Needs Correction"
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(400).json({
                success: false,
                message:
                    `This review cannot move to Self Assessment from "${review.status}"`,
            });
        }

        const oldStatus =
            review.status;

        // ----------------------------------------------------
        // Update review
        // ----------------------------------------------------

        const updatedReviewResult =
            await client.query(
                `
                UPDATE performance_reviews
                SET
                    status = 'Self Assessment',
                    current_stage = 'Self Assessment',
                    updated_at = NOW()

                WHERE id = $1

                RETURNING *
                `,
                [reviewId]
            );

        const updatedReview =
            updatedReviewResult
                .rows[0];

        // ----------------------------------------------------
        // Re-open goals after correction
        // ----------------------------------------------------

        if (
            oldStatus ===
            "Needs Correction"
        ) {
            await client.query(
                `
                UPDATE performance_goals
                SET
                    status = 'Open',
                    updated_at = NOW()

                WHERE review_id = $1
                  AND status <> 'Approved'
                `,
                [reviewId]
            );
        }

        // ----------------------------------------------------
        // History
        // ----------------------------------------------------

        await client.query(
            `
            INSERT INTO performance_review_history
            (
                review_id,
                action,
                performed_by,
                old_status,
                new_status
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                'Self Assessment'
            )
            `,
            [
                reviewId,

                oldStatus ===
                "Needs Correction"
                    ? "Employee Started Correction"
                    : "Employee Completed Goals",

                employee_id,

                oldStatus,
            ]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,

            message:
                oldStatus ===
                "Needs Correction"
                    ? "Correction process started successfully"
                    : "Self Assessment started successfully",

            review:
                updatedReview,
        });
    } catch (err) {
        await client.query(
            "ROLLBACK"
        );

        console.error(
            "startSelfAssessment error:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error starting Self Assessment",
        });
    } finally {
        client.release();
    }
};


// ============================================================
// SUBMIT PERFORMANCE REVIEW
// PATCH /api/performance-reviews/:reviewId/submit
//
// Self Assessment
//       ↓
// Manager Review
//
// This also supports resubmission after correction.
//
// Notifications:
// - Admin
// - HR
// - Manager
// - Owner
//
// The submitting employee is never notified here.
// ============================================================

export const submitPerformanceReview = async (
    req,
    res
) => {
    const client = await pool.connect();

    try {
        const { reviewId } =
            req.params;

        const { employee_id } =
            req.body;

        if (!reviewId) {
            return res.status(400).json({
                success: false,
                message:
                    "Review ID is required",
            });
        }

        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message:
                    "employee_id is required",
            });
        }

        await client.query("BEGIN");

        // ----------------------------------------------------
        // Get review + employee + cycle
        // ----------------------------------------------------

        const reviewResult =
            await client.query(
                `
                SELECT
                    pr.*,

                    e.full_name AS employee_name,
                    e.employee_code,

                    pc.name AS cycle_name,
                    pc.financial_year,
                    pc.status AS cycle_status

                FROM performance_reviews pr

                JOIN employees e
                    ON pr.employee_id = e.id

                JOIN performance_cycles pc
                    ON pr.cycle_id = pc.id

                WHERE pr.id = $1

                FOR UPDATE
                `,
                [reviewId]
            );

        if (
            reviewResult.rows.length ===
            0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(404).json({
                success: false,
                message:
                    "Performance review not found",
            });
        }

        const review =
            reviewResult.rows[0];

        // ----------------------------------------------------
        // Verify employee
        // ----------------------------------------------------

        if (
            Number(employee_id) !==
            Number(review.employee_id)
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to submit this review",
            });
        }

        // ----------------------------------------------------
        // Check cycle
        // ----------------------------------------------------

        if (
            review.cycle_status !==
            "Active"
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(400).json({
                success: false,
                message:
                    "This performance cycle is not active",
            });
        }

        // ----------------------------------------------------
        // Only Self Assessment can be submitted
        // ----------------------------------------------------

        if (
            review.status !==
            "Self Assessment"
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(400).json({
                success: false,
                message:
                    `This performance review is not ready for submission. Current status: "${review.status}"`,
            });
        }

        // ----------------------------------------------------
        // Get goals
        // ----------------------------------------------------

        const goalsResult =
            await client.query(
                `
                SELECT
                    id,
                    goal_number,
                    goal_description,
                    weightage

                FROM performance_goals

                WHERE review_id = $1

                ORDER BY goal_number
                `,
                [reviewId]
            );

        if (
            goalsResult.rows.length ===
            0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(400).json({
                success: false,
                message:
                    "No performance goals were found for this review",
            });
        }

        // ----------------------------------------------------
        // Validate goal descriptions
        // ----------------------------------------------------

        const incompleteGoals =
            goalsResult.rows.filter(
                (goal) =>
                    !String(
                        goal.goal_description ||
                            ""
                    ).trim()
            );

        if (
            incompleteGoals.length >
            0
        ) {
            await client.query(
                "ROLLBACK"
            );

            return res.status(400).json({
                success: false,
                message:
                    `Please complete goal description for Goal ${incompleteGoals[0].goal_number} before submitting the review.`,
            });
        }

        // ----------------------------------------------------
        // Detect whether this is a resubmission
        // ----------------------------------------------------

        const isResubmission =
            Boolean(
                review.submitted_at
            );

        // ----------------------------------------------------
        // Update review
        // ----------------------------------------------------

        const result =
            await client.query(
                `
                UPDATE performance_reviews

                SET
                    status = 'Manager Review',
                    current_stage = 'Manager Review',
                    submitted_at = NOW(),
                    updated_at = NOW()

                WHERE id = $1

                RETURNING *
                `,
                [reviewId]
            );

        const updatedReview =
            result.rows[0];

        // ----------------------------------------------------
        // Lock employee goals
        // ----------------------------------------------------

        await client.query(
            `
            UPDATE performance_goals

            SET
                status = 'Submitted',
                updated_at = NOW()

            WHERE review_id = $1
            `,
            [reviewId]
        );

        // ----------------------------------------------------
        // History
        // ----------------------------------------------------

        await client.query(
            `
            INSERT INTO performance_review_history
            (
                review_id,
                action,
                performed_by,
                old_status,
                new_status
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                'Manager Review'
            )
            `,
            [
                reviewId,

                isResubmission
                    ? "Employee Resubmitted Performance Review"
                    : "Employee Submitted Self Assessment",

                review.employee_id,

                review.status,
            ]
        );

        // ----------------------------------------------------
        // Notify Admin / HR / Manager / Owner
        // ----------------------------------------------------

        await notifyPerformanceApprovers(
            client,
            {
                employeeId:
                    review.employee_id,

                employeeName:
                    review.employee_name,

                financialYear:
                    review.financial_year,

                reviewId:

                    review.id,

                isResubmission,
            }
        );

        await client.query("COMMIT");

        return res.json({
            success: true,

            message:
                isResubmission
                    ? "Performance review resubmitted successfully"
                    : "Performance review submitted successfully",

            review:
                updatedReview,
        });
    } catch (err) {
        await client.query(
            "ROLLBACK"
        );

        console.error(
            "submitPerformanceReview error:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error submitting performance review",
        });
    } finally {
        client.release();
    }
};


// ============================================================
// GET PERFORMANCE APPROVALS
// GET /api/performance-reviews/approvals
//
// Shows reviews currently waiting for approval.
// ============================================================

export const getPerformanceApprovals = async (
    req,
    res
) => {
    try {
        const result =
            await pool.query(
                `
                ${REVIEW_SELECT}

                WHERE pr.status =
                    'Manager Review'

                ORDER BY
                    COALESCE(
                        pr.submitted_at,
                        pr.created_at
                    ) ASC
                `
            );

        return res.json({
            success: true,
            reviews: result.rows,
        });
    } catch (err) {
        console.error(
            "getPerformanceApprovals error:",
            err
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error fetching performance approvals",
        });
    }
};


// ============================================================
// GET PERFORMANCE APPROVAL DETAIL
// GET /api/performance-reviews/approvals/:reviewId
// ============================================================

export const getPerformanceApprovalDetail =
    async (req, res) => {
        try {
            const { reviewId } =
                req.params;

            if (!reviewId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Review ID is required",
                });
            }

            const result =
                await pool.query(
                    `
                    ${REVIEW_SELECT}

                    WHERE pr.id = $1
                    `,
                    [reviewId]
                );

            if (
                result.rows.length ===
                0
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Performance review not found",
                });
            }

            return res.json({
                success: true,
                review:
                    result.rows[0],
            });
        } catch (err) {
            console.error(
                "getPerformanceApprovalDetail error:",
                err
            );

            return res.status(500).json({
                success: false,
                message:
                    "Server error fetching performance approval detail",
            });
        }
    };


// ============================================================
// PROCESS PERFORMANCE APPROVAL
//
// PATCH /api/performance-reviews/:reviewId/approval
//
// Body:
//
// {
//     action: "approve",
//     approver_id: 1,
//     comments: "Good work"
// }
//
// OR
//
// {
//     action: "reject",
//     approver_id: 1,
//     comments: "Please update goal 2"
// }
//
// Workflow:
//
// Manager Review
//       │
//       ├── Approve
//       │       ↓
//       │   Approved
//       │
//       └── Reject
//               ↓
//        Needs Correction
//
// ============================================================

export const processPerformanceApproval =
    async (req, res) => {
        const client =
            await pool.connect();

        try {
            const { reviewId } =
                req.params;

            const {
                action,
                approver_id,
                comments,
            } = req.body;

            // =================================================
            // VALIDATION
            // =================================================

            if (!reviewId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Review ID is required",
                });
            }

            if (!approver_id) {
                return res.status(400).json({
                    success: false,
                    message:
                        "approver_id is required",
                });
            }

            const normalizedAction =
                String(
                    action || ""
                ).toLowerCase();

            if (
                ![
                    "approve",
                    "reject",
                ].includes(
                    normalizedAction
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid approval action. Use approve or reject.",
                });
            }

            // -------------------------------------------------
            // Rejection requires reason
            // -------------------------------------------------

            if (
                normalizedAction ===
                    "reject" &&
                !String(
                    comments || ""
                ).trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Please provide a reason when requesting correction.",
                });
            }

            await client.query(
                "BEGIN"
            );

            // =================================================
            // GET + LOCK REVIEW
            // =================================================

            const reviewResult =
                await client.query(
                    `
                    SELECT
                        pr.*,

                        e.full_name AS employee_name,
                        e.employee_code,

                        pc.name AS cycle_name,
                        pc.financial_year

                    FROM performance_reviews pr

                    JOIN employees e
                        ON pr.employee_id =
                            e.id

                    JOIN performance_cycles pc
                        ON pr.cycle_id =
                            pc.id

                    WHERE pr.id = $1

                    FOR UPDATE
                    `,
                    [reviewId]
                );

            if (
                reviewResult.rows.length ===
                0
            ) {
                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({
                    success: false,
                    message:
                        "Performance review not found",
                });
            }

            const review =
                reviewResult.rows[0];

            // =================================================
            // VERIFY APPROVER
            // =================================================

const approverResult =
    await client.query(
        `
        SELECT
            id,
            full_name,
            role
        FROM employees
        WHERE id = $1
        `,
        [approver_id]
    );

            if (
                approverResult.rows.length ===
                0
            ) {
                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({
                    success: false,
                    message:
                        "Approver employee not found",
                });
            }

            const approver =
                approverResult.rows[0];

            const approverRole =
                String(
                    approver.role || ""
                ).toLowerCase();

            const isAuthorizedApprover = [
    "admin",
    "hr",
    "manager",
    "owner",
].includes(approverRole);

            if (
                !isAuthorizedApprover
            ) {
                await client.query(
                    "ROLLBACK"
                );

                return res.status(403).json({
                    success: false,
                    message:
                        "You are not authorized to process performance approvals",
                });
            }

            // =================================================
            // ONLY MANAGER REVIEW CAN BE PROCESSED
            // =================================================

            if (
                review.status !==
                "Manager Review"
            ) {
                await client.query(
                    "ROLLBACK"
                );

                return res.status(400).json({
                    success: false,
                    message:
                        `This performance review is currently "${review.status}" and cannot be processed.`,
                });
            }

            // =================================================
            // DETERMINE NEW STATUS
            // =================================================

            const newStatus =
                normalizedAction ===
                "approve"
                    ? "Approved"
                    : "Needs Correction";

            const newStage =
                normalizedAction ===
                "approve"
                    ? "Approved"
                    : "Goals";

            const trimmedComments =
                String(
                    comments || ""
                ).trim();

            // =================================================
            // UPDATE REVIEW
            // =================================================

            const updatedResult =
                await client.query(
                    `
                    UPDATE performance_reviews

                    SET
                        status = $1,
                        current_stage = $2,

                        manager_comments =
                            CASE
                                WHEN $3 = 'approve'
                                    THEN COALESCE(
                                        NULLIF(
                                            $4,
                                            ''
                                        ),
                                        manager_comments
                                    )
                                ELSE
                                    NULLIF(
                                        $4,
                                        ''
                                    )
                            END,

                        hr_comments =
                            CASE
                                WHEN $3 = 'reject'
                                    THEN NULLIF(
                                        $4,
                                        ''
                                    )
                                ELSE
                                    hr_comments
                            END,

                        updated_at = NOW()

                    WHERE id = $5

                    RETURNING *
                    `,
                    [
                        newStatus,
                        newStage,
                        normalizedAction,
                        trimmedComments,
                        reviewId,
                    ]
                );

            // =================================================
            // UPDATE GOALS
            // =================================================

            await client.query(
                `
                UPDATE performance_goals

                SET
                    status = $1,
                    updated_at = NOW()

                WHERE review_id = $2
                `,
                [
                    normalizedAction ===
                    "approve"
                        ? "Approved"
                        : "Open",

                    reviewId,
                ]
            );

            // =================================================
            // HISTORY
            // =================================================

            await client.query(
                `
                INSERT INTO performance_review_history
                (
                    review_id,
                    action,
                    performed_by,
                    old_status,
                    new_status
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                )
                `,
                [
                    reviewId,

                    normalizedAction ===
                    "approve"
                        ? "Performance Review Approved"
                        : "Performance Review Needs Correction",

                    approver_id,

                    review.status,

                    newStatus,
                ]
            );

            // =================================================
            // EMPLOYEE NOTIFICATION
            // =================================================

            const employeeNotificationTitle =
                normalizedAction ===
                "approve"
                    ? "Performance Review Approved"
                    : "Performance Review Needs Correction";

            let employeeNotificationMessage;

            if (
                normalizedAction ===
                "approve"
            ) {
                employeeNotificationMessage =
                    `Your performance review for ${review.financial_year} has been approved.`;
            } else {
                employeeNotificationMessage =
                    `Your performance review for ${review.financial_year} needs correction.`;

                if (
                    trimmedComments
                ) {
                    employeeNotificationMessage +=
                        ` Feedback: ${trimmedComments}`;
                }
            }

            await createNotification(
                client,
                {
                    recipientEmployeeId:
                        review.employee_id,

                    title:
                        employeeNotificationTitle,

                    message:
                        employeeNotificationMessage,

                    type:
                        "performance",

                    referenceId:
                        review.id,

                    referenceType:
                        "performance_review",
                }
            );

            // =================================================
            // COMMIT EVERYTHING
            // =================================================

            await client.query(
                "COMMIT"
            );

            return res.json({
                success: true,

                message:
                    normalizedAction ===
                    "approve"
                        ? "Performance review approved successfully"
                        : "Performance review sent back for correction",

                review:
                    updatedResult
                        .rows[0],
            });
        } catch (err) {
            await client.query(
                "ROLLBACK"
            );

            console.error(
                "processPerformanceApproval error:",
                err
            );

            return res.status(500).json({
                success: false,
                message:
                    "Server error processing performance approval",
            });
        } finally {
            client.release();
        }
    };


// ============================================================
// GET PERFORMANCE NOTIFICATIONS
//
// GET
// /api/performance-reviews/notifications/:employeeId
//
// IMPORTANT:
// Notifications use `is_read`.
//
// There is NO dependency on `read_at` here.
// ============================================================

export const getPerformanceNotifications =
    async (req, res) => {
        try {
            const { employeeId } =
                req.params;

            if (!employeeId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Employee ID is required",
                });
            }

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        recipient_employee_id,
                        title,
                        message,
                        type,
                        reference_id,
                        reference_type,
                        is_read,
                        created_at

                    FROM notifications

                    WHERE
                        recipient_employee_id =
                            $1

                        AND
                        (
                            LOWER(
                                COALESCE(
                                    type,
                                    ''
                                )
                            ) =
                                'performance'

                            OR

                            LOWER(
                                COALESCE(
                                    title,
                                    ''
                                )
                            ) LIKE
                                '%performance%'

                            OR

                            LOWER(
                                COALESCE(
                                    message,
                                    ''
                                )
                            ) LIKE
                                '%performance review%'
                        )

                    ORDER BY
                        created_at DESC

                    LIMIT 50
                    `,
                    [employeeId]
                );

            const notifications =
                result.rows.map(
                    (
                        notification
                    ) => {
                        const isRead =
                            Boolean(
                                notification.is_read
                            );

                        return {
                            id:
                                notification.id,

                            recipient_employee_id:
                                notification.recipient_employee_id,

                            title:
                                notification.title,

                            message:
                                notification.message,

                            type:
                                notification.type,

                            reference_id:
                                notification.reference_id,

                            reference_type:
                                notification.reference_type,

                            created_at:
                                notification.created_at,

                            createdAt:
                                notification.created_at,

                            is_read:
                                isRead,

                            isRead:

                                isRead,

                            isUnread:
                                !isRead,
                        };
                    }
                );

            const unreadCount =
                notifications.filter(
                    (
                        notification
                    ) =>
                        notification.isUnread
                ).length;

            return res.json({
                success: true,

                notifications,

                unreadCount,
            });
        } catch (err) {
            console.error(
                "getPerformanceNotifications error:",
                err
            );

            return res.status(500).json({
                success: false,
                message:
                    "Server error fetching performance notifications",
            });
        }
    };


// ============================================================
// MARK PERFORMANCE NOTIFICATION AS READ
//
// PATCH
// /api/performance-reviews/notifications/:notificationId/read
//
// Body:
//
// {
//     employee_id: 44
// }
//
// `employee_id` is optional for backward compatibility,
// but when supplied it prevents another employee from marking
// somebody else's notification as read.
// ============================================================

export const markPerformanceNotificationRead =
    async (req, res) => {
        try {
            const {
                notificationId,
            } = req.params;

            const {
                employee_id,
            } = req.body || {};

            if (!notificationId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Notification ID is required",
                });
            }

            let result;

            if (employee_id) {
                result =
                    await pool.query(
                        `
                        UPDATE notifications

                        SET
                            is_read = true

                        WHERE
                            id = $1

                            AND
                            recipient_employee_id =
                                $2

                        RETURNING
                            id,
                            recipient_employee_id,
                            title,
                            message,
                            type,
                            reference_id,
                            reference_type,
                            is_read,
                            created_at
                        `,
                        [
                            notificationId,
                            employee_id,
                        ]
                    );
            } else {
                result =
                    await pool.query(
                        `
                        UPDATE notifications

                        SET
                            is_read = true

                        WHERE id = $1

                        RETURNING
                            id,
                            recipient_employee_id,
                            title,
                            message,
                            type,
                            reference_id,
                            reference_type,
                            is_read,
                            created_at
                        `,
                        [
                            notificationId,
                        ]
                    );
            }

            if (
                result.rows.length ===
                0
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Notification not found",
                });
            }

            const notification =
                result.rows[0];

            return res.json({
                success: true,

                notification: {
                    ...notification,

                    isRead:
                        Boolean(
                            notification.is_read
                        ),

                    isUnread:
                        !Boolean(
                            notification.is_read
                        ),

                    createdAt:
                        notification.created_at,
                },
            });
        } catch (err) {
            console.error(
                "markPerformanceNotificationRead error:",
                err
            );

            return res.status(500).json({
                success: false,
                message:
                    "Server error marking performance notification as read",
            });
        }
    };