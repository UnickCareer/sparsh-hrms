/**
 * PerformanceReview.jsx
 *
 * Frontend component/module for HRMS application
 */

// src/pages/PerformanceReview.jsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ClipboardList,
    ClipboardCheck,
    Lock,
    Play,
    Loader2,
    CheckCircle2,
    XCircle,
    X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";

function PerformanceReview() {
    const navigate = useNavigate();
    const { currentUser, employeeId } = useAuth();

    // ============================================================
    // EMPLOYEE REVIEWS
    // ============================================================

    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);

    // ============================================================
    // PERFORMANCE APPROVALS
    // Admin only
    //
    // These remain as a TAB INSIDE Performance Review.
    // ============================================================

    const canApprovePerformance =
        String(currentUser?.role || "").toLowerCase() ===
            "admin" ||
        currentUser?.isAdmin === true;

    const [activeTab, setActiveTab] = useState("reviews");

    const [pendingApprovals, setPendingApprovals] = useState(
        []
    );

    const [approvalLoading, setApprovalLoading] =
        useState(false);

    const [selectedApproval, setSelectedApproval] =
        useState(null);

    const [approvalComment, setApprovalComment] =
        useState("");

    const [approvalAction, setApprovalAction] =
        useState(null);

    // ============================================================
    // FETCH MY PERFORMANCE REVIEWS
    // ============================================================

    const fetchReviews = async () => {
        if (!employeeId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            const response = await fetch(
                `/api/performance-reviews/my/${employeeId}`,
                {
                    cache: "no-store",
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                        "Failed to load performance reviews"
                );
            }

            setReviews(data.reviews || []);
        } catch (error) {
            console.error(
                "fetchReviews error:",
                error
            );

            toast.error(
                error.message ||
                    "Unable to load performance review"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [employeeId]);

    // ============================================================
    // FETCH ADMIN PERFORMANCE APPROVALS
    // ============================================================

    const fetchPerformanceApprovals = async () => {
        if (!canApprovePerformance) {
            setPendingApprovals([]);
            return;
        }

        try {
            setApprovalLoading(true);

            const query =
                employeeId
                    ? `?approver_id=${encodeURIComponent(
                          employeeId
                      )}`
                    : "";

            const response = await fetch(
                `/api/performance-reviews/approvals${query}`,
                {
                    cache: "no-store",
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                        "Unable to load performance approvals"
                );
            }

            setPendingApprovals(
                Array.isArray(data.reviews)
                    ? data.reviews
                    : []
            );
        } catch (error) {
            console.error(
                "fetchPerformanceApprovals error:",
                error
            );

            toast.error(
                error.message ||
                    "Unable to load performance approvals"
            );
        } finally {
            setApprovalLoading(false);
        }
    };

    // ============================================================
    // LOAD APPROVALS WHEN ADMIN OPENS THE APPROVAL TAB
    // ============================================================

    useEffect(() => {
        if (
            activeTab === "approvals" &&
            canApprovePerformance
        ) {
            fetchPerformanceApprovals();
        }
    }, [
        activeTab,
        employeeId,
        canApprovePerformance,
    ]);

    // ============================================================
    // OPEN APPROVAL DETAIL
    //
    // We first try to fetch the complete approval detail from
    // the backend.
    //
    // If the list already contains goals, those can still be
    // displayed as a fallback.
    // ============================================================

    const openApprovalDetail = async (review) => {
        try {
            setApprovalLoading(true);

            const response = await fetch(
                `/api/performance-reviews/approvals/${review.id}`,
                {
                    cache: "no-store",
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                        "Unable to load performance review details"
                );
            }

            setSelectedApproval(
                data.review || review
            );

            setApprovalComment("");
        } catch (error) {
            console.error(
                "openApprovalDetail error:",
                error
            );

            // ----------------------------------------------------
            // Fallback:
            // If the approval list already contains the details,
            // still allow Admin to review it.
            // ----------------------------------------------------

            if (
                review &&
                Array.isArray(review.goals)
            ) {
                setSelectedApproval(review);
                setApprovalComment("");
            } else {
                toast.error(
                    error.message ||
                        "Unable to load performance review details"
                );
            }
        } finally {
            setApprovalLoading(false);
        }
    };

    // ============================================================
    // APPROVE / REJECT PERFORMANCE REVIEW
    // ============================================================

    const handleApprovalAction = async (
        reviewId,
        action
    ) => {
        if (
            !reviewId ||
            !employeeId ||
            approvalAction
        ) {
            return;
        }

        // --------------------------------------------------------
        // Rejection requires a reason
        // --------------------------------------------------------

        if (
            action === "reject" &&
            !approvalComment.trim()
        ) {
            toast.error(
                "Please enter a reason before rejecting"
            );
            return;
        }

        try {
            setApprovalAction(
                `${action}-${reviewId}`
            );

            const response = await fetch(
                `/api/performance-reviews/${reviewId}/approval`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        action,
                        approver_id: employeeId,
                        comments:
                            approvalComment.trim() ||
                            null,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                        "Unable to process performance approval"
                );
            }

            // ----------------------------------------------------
            // Success message
            // ----------------------------------------------------

            if (action === "approve") {
                toast.success(
                    "Performance review approved successfully"
                );
            } else {
                toast.success(
                    "Performance review rejected and sent back for correction"
                );
            }

            // ----------------------------------------------------
            // Close modal
            // ----------------------------------------------------

            setSelectedApproval(null);
            setApprovalComment("");

            // ----------------------------------------------------
            // Refresh both Admin approvals and employee reviews
            // ----------------------------------------------------

            await Promise.all([
                fetchPerformanceApprovals(),
                fetchReviews(),
            ]);
        } catch (error) {
            console.error(
                "handleApprovalAction error:",
                error
            );

            toast.error(
                error.message ||
                    "Unable to process performance approval"
            );
        } finally {
            setApprovalAction(null);
        }
    };

    // ============================================================
    // START PERFORMANCE REVIEW
    //
    // Flow:
    //
    // No review
    //      ↓
    // POST /performance-reviews
    //      ↓
    // review created
    //      ↓
    // PATCH /:reviewId/start
    //      ↓
    // Goals
    //
    // Existing review:
    //
    // Not Started / Needs Changes
    //      ↓
    // PATCH /:reviewId/start
    // ============================================================

    const handleStart = async (
        cycleId,
        existingReview = null
    ) => {
        if (!employeeId) {
            toast.error(
                "Unable to find the logged-in employee"
            );
            return;
        }

        if (starting) {
            return;
        }

        try {
            setStarting(true);

            let reviewId =
                existingReview?.id || null;

            // ====================================================
            // STEP 1
            // Create review if one does not exist.
            // ====================================================

            if (!reviewId) {
                const createResponse = await fetch(
                    "/api/performance-reviews",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            cycle_id: cycleId,
                            employee_id:
                                employeeId,
                        }),
                    }
                );

                const createData =
                    await createResponse.json();

                // ------------------------------------------------
                // Created successfully
                // ------------------------------------------------

                if (
                    createResponse.ok &&
                    createData.success &&
                    createData.review
                ) {
                    reviewId =
                        createData.review.id;
                }

                // ------------------------------------------------
                // Review already existed
                // ------------------------------------------------

                else if (
                    createResponse.status === 409 &&
                    createData.review_id
                ) {
                    reviewId =
                        createData.review_id;
                } else {
                    throw new Error(
                        createData.message ||
                            "Unable to create performance review"
                    );
                }
            }

            // ====================================================
            // STEP 2
            // Start the review
            // ====================================================

            const startResponse = await fetch(
                `/api/performance-reviews/${reviewId}/start`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        employee_id:
                            employeeId,
                    }),
                }
            );

            const startData =
                await startResponse.json();

            if (
                !startResponse.ok ||
                !startData.success
            ) {
                // ------------------------------------------------
                // If already started / cannot start because it is
                // already in an active workflow, simply open it.
                // ------------------------------------------------

                const message =
                    String(
                        startData.message || ""
                    ).toLowerCase();

                if (
                    startResponse.status ===
                        400 &&
                    (
                        message.includes(
                            "cannot be started"
                        ) ||
                        message.includes(
                            "already started"
                        ) ||
                        message.includes(
                            "already in progress"
                        )
                    )
                ) {
                    navigate(
                        `/performance-review/${reviewId}`
                    );
                    return;
                }

                throw new Error(
                    startData.message ||
                        "Unable to start performance review"
                );
            }

            // ====================================================
            // STEP 3
            // Update local state
            // ====================================================

            if (startData.review) {
                setReviews(
                    (previousReviews) => {
                        const exists =
                            previousReviews.some(
                                (review) =>
                                    Number(
                                        review.id
                                    ) ===
                                    Number(
                                        startData
                                            .review
                                            .id
                                    )
                            );

                        if (exists) {
                            return previousReviews.map(
                                (review) =>
                                    Number(
                                        review.id
                                    ) ===
                                    Number(
                                        startData
                                            .review
                                            .id
                                    )
                                        ? {
                                              ...review,
                                              ...startData.review,
                                          }
                                        : review
                            );
                        }

                        return [
                            startData.review,
                            ...previousReviews,
                        ];
                    }
                );
            }

            toast.success(
                "Performance review started"
            );

            // ====================================================
            // STEP 4
            // Open review detail
            // ====================================================

            navigate(
                `/performance-review/${reviewId}`
            );
        } catch (error) {
            console.error(
                "handleStart error:",
                error
            );

            toast.error(
                error.message ||
                    "Could not start performance review"
            );
        } finally {
            setStarting(false);
        }
    };

    // ============================================================
    // OPEN EXISTING REVIEW
    // ============================================================

    const handleOpenReview = (reviewId) => {
        if (!reviewId) {
            return;
        }

        navigate(
            `/performance-review/${reviewId}`
        );
    };

    // ============================================================
    // LOADING
    // ============================================================

    if (loading) {
        return (
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mb-6">
                    <ClipboardList size={22} />
                    Performance Review
                </h1>

                <div className="bg-white rounded-xl shadow-sm flex items-center justify-center py-20">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Loader2
                            size={18}
                            className="animate-spin"
                        />
                        Loading your performance reviews...
                    </div>
                </div>
            </div>
        );
    }

    // ============================================================
    // AUTHENTICATION CHECK
    // ============================================================

    if (!currentUser || !employeeId) {
        return (
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 mb-6">
                    <ClipboardList size={22} />
                    Performance Review
                </h1>

                <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                    <p className="text-sm text-gray-500">
                        Unable to find the logged-in employee.
                    </p>
                </div>
            </div>
        );
    }

    // ============================================================
    // CURRENT REVIEW
    // ============================================================

    const existingReview =
        reviews.length > 0
            ? reviews[0]
            : null;

    // ============================================================
    // CURRENT CYCLE
    //
    // Until a dedicated cycle endpoint is used, use the cycle
    // information returned with the employee review.
    // ============================================================

    const currentCycle = {
        id:
            existingReview?.cycle_id ||
            1,

        name:
            existingReview?.cycle_name ||
            "Own Your Growth",

        financialYear:
            existingReview?.financial_year ||
            "FY 2026-27",

        startDate:
            existingReview?.cycle_start_date ||
            "2026-04-01",

        endDate:
            existingReview?.cycle_end_date ||
            "2027-03-31",

        status:
            existingReview?.cycle_status ||
            "Active",
    };

    // ============================================================
    // REVIEW STATUS
    // ============================================================

    const reviewStatus =
        existingReview?.status ||
        "Not Started";

    const normalizedStatus =
        String(reviewStatus)
            .trim()
            .toLowerCase();

    const isReviewStarted =
        Boolean(existingReview) &&
        normalizedStatus !==
            "not started";

    const isNeedsCorrection =
        normalizedStatus ===
            "needs correction" ||
        normalizedStatus ===
            "needs changes" ||
        normalizedStatus ===
            "rejected";

    // ============================================================
    // STATUS STYLE
    // ============================================================

    const getStatusClasses = (status) => {
        const normalized =
            String(status || "")
                .trim()
                .toLowerCase();

        if (
            normalized === "approved" ||
            normalized === "completed"
        ) {
            return "bg-green-50 text-green-600 border-green-200";
        }

        if (
            normalized ===
                "needs correction" ||
            normalized ===
                "needs changes" ||
            normalized === "rejected"
        ) {
            return "bg-red-50 text-red-600 border-red-200";
        }

        if (
            normalized ===
                "manager review"
        ) {
            return "bg-blue-50 text-blue-600 border-blue-200";
        }

        if (
            normalized ===
                "self assessment"
        ) {
            return "bg-orange-50 text-orange-600 border-orange-200";
        }

        if (normalized === "goals") {
            return "bg-purple-50 text-purple-600 border-purple-200";
        }

        return "bg-gray-50 text-gray-500 border-gray-300";
    };

    // ============================================================
    // FORMAT DATE
    // ============================================================

    const formatDate = (date) => {
        if (!date) {
            return "-";
        }

        const parsedDate =
            new Date(date);

        if (
            Number.isNaN(
                parsedDate.getTime()
            )
        ) {
            return date;
        }

        return parsedDate.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    };

    // ============================================================
    // MAIN UI
    // ============================================================

    return (
        <div>
            {/* ==================================================
                PAGE HEADER
            ================================================== */}

            <div className="mb-6">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                    <ClipboardList size={22} />
                    Performance Review
                </h1>

                <p className="text-sm text-gray-400 mt-1">
                    Manage your annual goals and
                    performance review.
                </p>
            </div>

            {/* ==================================================
                MAIN CARD
            ================================================== */}

            <div className="bg-white rounded-xl shadow-sm p-5">

                {/* ==================================================
                    TABS
                ================================================== */}

                <div className="border-b border-gray-200 mb-5">
                    <div className="flex items-center gap-6">

                        {/* ------------------------------------------
                            MY REVIEWS
                        ------------------------------------------ */}

                        <button
                            type="button"
                            onClick={() =>
                                setActiveTab(
                                    "reviews"
                                )
                            }
                            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab ===
                                "reviews"
                                    ? "text-orange-600 border-orange-500"
                                    : "text-gray-400 border-transparent hover:text-gray-600"
                            }`}
                        >
                            My Reviews
                        </button>

                        {/* ------------------------------------------
                            PERFORMANCE APPROVALS
                            ADMIN ONLY
                        ------------------------------------------ */}

                        {canApprovePerformance && (
                            <button
                                type="button"
                                onClick={() =>
                                    setActiveTab(
                                        "approvals"
                                    )
                                }
                                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                                    activeTab ===
                                    "approvals"
                                        ? "text-orange-600 border-orange-500"
                                        : "text-gray-400 border-transparent hover:text-gray-600"
                                }`}
                            >
                                Performance Approvals

                                {pendingApprovals.length >
                                    0 && (
                                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold flex items-center justify-center">
                                        {pendingApprovals.length >
                                        9
                                            ? "9+"
                                            : pendingApprovals.length}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* ==================================================
                    MY REVIEWS TAB
                ================================================== */}

                {activeTab ===
                    "reviews" && (
                    <>
                        {/* ------------------------------------------
                            EMPLOYEE INFORMATION
                        ------------------------------------------ */}

                        <div className="mb-5">
                            <p className="text-sm font-semibold text-gray-900">
                                {
                                    currentUser.full_name
                                }
                            </p>

                            <p className="text-xs text-gray-400 mt-1">
                                {currentUser.employee_code ||
                                    currentUser.email}

                                {currentUser.designation &&
                                    ` · ${currentUser.designation}`}
                            </p>
                        </div>

                        {/* ------------------------------------------
                            REVIEW TABLE
                        ------------------------------------------ */}

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500 border-b border-gray-200">
                                        <th className="py-3 pr-4 font-medium">
                                            Cycle
                                        </th>

                                        <th className="py-3 pr-4 font-medium">
                                            FY
                                        </th>

                                        <th className="py-3 pr-4 font-medium">
                                            My Stage
                                        </th>

                                        <th className="py-3 pr-4 font-medium text-right">
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <tr className="border-b border-gray-100">

                                        {/* ----------------------------------
                                            CYCLE
                                        ---------------------------------- */}

                                        <td className="py-4 pr-4">
                                            <div>
                                                <p className="font-semibold text-gray-900">
                                                    {
                                                        currentCycle.name
                                                    }
                                                </p>

                                                <p className="text-xs text-gray-400 mt-1">
                                                    {formatDate(
                                                        currentCycle.startDate
                                                    )}
                                                    {" – "}
                                                    {formatDate(
                                                        currentCycle.endDate
                                                    )}
                                                </p>
                                            </div>
                                        </td>

                                        {/* ----------------------------------
                                            FINANCIAL YEAR
                                        ---------------------------------- */}

                                        <td className="py-4 pr-4 text-gray-600">
                                            {
                                                currentCycle.financialYear
                                            }
                                        </td>

                                        {/* ----------------------------------
                                            STATUS
                                        ---------------------------------- */}

                                        <td className="py-4 pr-4">
                                            <span
                                                className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getStatusClasses(
                                                    reviewStatus
                                                )}`}
                                            >
                                                {
                                                    reviewStatus
                                                }
                                            </span>
                                        </td>

                                        {/* ----------------------------------
                                            ACTION
                                        ---------------------------------- */}

                                        <td className="py-4 pr-4 text-right">

                                            {/* ==============================
                                                NO REVIEW
                                            ============================== */}

                                            {!existingReview && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleStart(
                                                            currentCycle.id
                                                        )
                                                    }
                                                    disabled={
                                                        starting
                                                    }
                                                    className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors ml-auto"
                                                >
                                                    {starting ? (
                                                        <>
                                                            <Loader2
                                                                size={
                                                                    14
                                                                }
                                                                className="animate-spin"
                                                            />
                                                            Starting...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play
                                                                size={
                                                                    14
                                                                }
                                                            />
                                                            Start
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            {/* ==============================
                                                NOT STARTED
                                            ============================== */}

                                            {existingReview &&
                                                normalizedStatus ===
                                                    "not started" && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleStart(
                                                                currentCycle.id,
                                                                existingReview
                                                            )
                                                        }
                                                        disabled={
                                                            starting
                                                        }
                                                        className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors ml-auto"
                                                    >
                                                        {starting ? (
                                                            <>
                                                                <Loader2
                                                                    size={
                                                                        14
                                                                    }
                                                                    className="animate-spin"
                                                                />
                                                                Starting...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Play
                                                                    size={
                                                                        14
                                                                    }
                                                                />
                                                                Start
                                                            </>
                                                        )}
                                                    </button>
                                                )}

                                            {/* ==============================
                                                NEEDS CORRECTION
                                            ============================== */}

                                            {existingReview &&
                                                isNeedsCorrection && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleOpenReview(
                                                                existingReview.id
                                                            )
                                                        }
                                                        className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                                                    >
                                                        Open & Correct
                                                    </button>
                                                )}

                                            {/* ==============================
                                                ACTIVE / COMPLETED REVIEW
                                            ============================== */}

                                            {existingReview &&
                                                isReviewStarted &&
                                                !isNeedsCorrection && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleOpenReview(
                                                                existingReview.id
                                                            )
                                                        }
                                                        className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                                                    >
                                                        Open Review
                                                    </button>
                                                )}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* ------------------------------------------
                            INFORMATION BOX
                        ------------------------------------------ */}

                        <div className="mt-5 rounded-lg bg-gray-50 border border-gray-100 p-4">
                            <div className="flex items-start gap-2">
                                <Lock
                                    size={15}
                                    className="text-gray-400 mt-0.5 shrink-0"
                                />

                                <div>
                                    <p className="text-xs font-medium text-gray-600">
                                        Performance Review Cycle
                                    </p>

                                    <p className="text-xs text-gray-400 mt-1">
                                        Set and manage
                                        your goals for
                                        FY 2026-27.
                                        Once submitted,
                                        your goals and
                                        self-assessment
                                        will be reviewed
                                        through the
                                        performance
                                        approval workflow.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ==================================================
                    PERFORMANCE APPROVALS TAB
                    ADMIN ONLY
                ================================================== */}

                {activeTab ===
                    "approvals" &&
                    canApprovePerformance && (
                        <div>

                            {/* ------------------------------------------
                                HEADER
                            ------------------------------------------ */}

                            <div className="mb-5">
                                <h2 className="text-lg font-bold text-gray-900">
                                    Performance Approvals
                                </h2>

                                <p className="text-sm text-gray-400 mt-1">
                                    Review employee
                                    performance
                                    submissions and
                                    approve or send them
                                    back for correction.
                                </p>
                            </div>

                            {/* ------------------------------------------
                                LOADING
                            ------------------------------------------ */}

                            {approvalLoading ? (
                                <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                                    <Loader2
                                        size={18}
                                        className="animate-spin mr-2"
                                    />
                                    Loading performance
                                    approvals...
                                </div>
                            ) : pendingApprovals.length ===
                              0 ? (
                                /* --------------------------------------
                                    EMPTY STATE
                                -------------------------------------- */

                                <div className="border border-gray-200 rounded-xl p-10 text-center">
                                    <ClipboardCheck
                                        size={34}
                                        className="mx-auto mb-3 text-gray-300"
                                    />

                                    <p className="text-sm font-semibold text-gray-600">
                                        No pending
                                        performance
                                        approvals
                                    </p>

                                    <p className="text-xs text-gray-400 mt-1">
                                        Employee submissions
                                        will appear here
                                        after they submit
                                        their performance
                                        review.
                                    </p>
                                </div>
                            ) : (
                                /* --------------------------------------
                                    APPROVAL TABLE
                                -------------------------------------- */

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-gray-500 border-b border-gray-200">

                                                <th className="py-3 pr-4 font-medium">
                                                    Employee
                                                </th>

                                                <th className="py-3 pr-4 font-medium">
                                                    Cycle
                                                </th>

                                                <th className="py-3 pr-4 font-medium">
                                                    FY
                                                </th>

                                                <th className="py-3 pr-4 font-medium">
                                                    Stage
                                                </th>

                                                <th className="py-3 text-right font-medium">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {pendingApprovals.map(
                                                (
                                                    review
                                                ) => (
                                                    <tr
                                                        key={
                                                            review.id
                                                        }
                                                        className="border-b border-gray-100"
                                                    >

                                                        {/* EMPLOYEE */}

                                                        <td className="py-4 pr-4">
                                                            <p className="font-semibold text-gray-900">
                                                                {review.employee_name ||
                                                                    "Employee"}
                                                            </p>

                                                            <p className="text-xs text-gray-400 mt-1">
                                                                {review.employee_code ||
                                                                    review.employee_email ||
                                                                    "-"}
                                                            </p>
                                                        </td>

                                                        {/* CYCLE */}

                                                        <td className="py-4 pr-4 text-gray-700">
                                                            {review.cycle_name ||
                                                                "-"}
                                                        </td>

                                                        {/* FY */}

                                                        <td className="py-4 pr-4 text-gray-600">
                                                            {review.financial_year ||
                                                                "-"}
                                                        </td>

                                                        {/* STAGE */}

                                                        <td className="py-4 pr-4">
                                                            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                                                                {review.status ||
                                                                    "Manager Review"}
                                                            </span>
                                                        </td>

                                                        {/* ACTION */}

                                                        <td className="py-4 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    openApprovalDetail(
                                                                        review
                                                                    )
                                                                }
                                                                disabled={
                                                                    approvalLoading
                                                                }
                                                                className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-xs font-semibold px-4 py-2 rounded-lg"
                                                            >
                                                                Review
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                {/* ==================================================
                    APPROVAL DETAIL MODAL
                ================================================== */}

                {selectedApproval &&
                    canApprovePerformance && (
                        <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">

                            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">

                                {/* --------------------------------------
                                    MODAL HEADER
                                -------------------------------------- */}

                                <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">

                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">
                                            Review Performance
                                            Submission
                                        </h2>

                                        <p className="text-xs text-gray-400 mt-1">
                                            {selectedApproval.employee_name ||
                                                "Employee"}

                                            {selectedApproval.employee_code
                                                ? ` · ${selectedApproval.employee_code}`
                                                : ""}

                                            {selectedApproval.cycle_name
                                                ? ` · ${selectedApproval.cycle_name}`
                                                : ""}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedApproval(
                                                null
                                            )
                                        }
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* --------------------------------------
                                    MODAL CONTENT
                                -------------------------------------- */}

                                <div className="p-5">

                                    {/* ==============================
                                        GOALS
                                    ============================== */}

                                    {Array.isArray(
                                        selectedApproval.goals
                                    ) &&
                                    selectedApproval
                                        .goals.length >
                                        0 ? (
                                        selectedApproval.goals.map(
                                            (
                                                goal
                                            ) => (
                                                <div
                                                    key={
                                                        goal.id
                                                    }
                                                    className="border border-gray-200 rounded-xl p-4 mb-4"
                                                >

                                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">

                                                        <div>
                                                            <p className="font-semibold text-gray-900">
                                                                Goal{" "}
                                                                {goal.goal_number ||
                                                                    "-"}
                                                                :{" "}
                                                                {goal.goal_category ||
                                                                    "Performance Goal"}
                                                            </p>
                                                        </div>

                                                        <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full w-fit">
                                                            {goal.weightage ??
                                                                0}
                                                            %{" "}
                                                            Weight
                                                        </span>
                                                    </div>

                                                    {/* GOAL DESCRIPTION */}

                                                    <div className="mb-3">
                                                        <p className="text-xs font-semibold text-gray-500 mb-1">
                                                            Employee
                                                            Goal
                                                        </p>

                                                        <p className="text-sm text-gray-700 whitespace-pre-line">
                                                            {goal.goal_description ||
                                                                "No goal description"}
                                                        </p>
                                                    </div>

                                                    {/* EMPLOYEE COMMENTS */}

                                                    <div className="bg-gray-50 rounded-lg p-3">
                                                        <p className="text-xs font-semibold text-gray-500 mb-1">
                                                            Employee
                                                            Comments
                                                        </p>

                                                        <p className="text-sm text-gray-700 whitespace-pre-line">
                                                            {goal.employee_comments ||
                                                                "No employee comments"}
                                                        </p>
                                                    </div>

                                                    {/* SELF ASSESSMENT */}

                                                    {goal.self_assessment && (
                                                        <div className="mt-3 bg-orange-50 border border-orange-100 rounded-lg p-3">
                                                            <p className="text-xs font-semibold text-orange-600 mb-1">
                                                                Self
                                                                Assessment
                                                            </p>

                                                            <p className="text-sm text-gray-700 whitespace-pre-line">
                                                                {
                                                                    goal.self_assessment
                                                                }
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        )
                                    ) : (
                                        <div className="border border-gray-200 rounded-xl p-6 text-center">
                                            <p className="text-sm text-gray-500">
                                                No performance
                                                goals were
                                                found for
                                                this
                                                submission.
                                            </p>
                                        </div>
                                    )}

                                    {/* ==============================
                                        EXISTING EMPLOYEE COMMENTS
                                    ============================== */}

                                    {selectedApproval.employee_comments &&
                                        !Array.isArray(
                                            selectedApproval.goals
                                        ) && (
                                            <div className="mt-4 bg-gray-50 rounded-xl p-4">
                                                <p className="text-xs font-semibold text-gray-500 mb-1">
                                                    Employee
                                                    Comments
                                                </p>

                                                <p className="text-sm text-gray-700 whitespace-pre-line">
                                                    {
                                                        selectedApproval.employee_comments
                                                    }
                                                </p>
                                            </div>
                                        )}

                                    {/* ==============================
                                        ADMIN COMMENTS
                                    ============================== */}

                                    <div className="mt-5">
                                        <label className="block text-xs font-semibold text-gray-600 mb-2">
                                            Admin Comments
                                        </label>

                                        <textarea
                                            value={
                                                approvalComment
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setApprovalComment(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            rows={4}
                                            placeholder="Add feedback. A rejection reason is required when sending the review back."
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100"
                                        />
                                    </div>

                                    {/* ==============================
                                        ACTION BUTTONS
                                    ============================== */}

                                    <div className="flex flex-col sm:flex-row justify-end gap-3 mt-5">

                                        {/* REJECT */}

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleApprovalAction(
                                                    selectedApproval.id,
                                                    "reject"
                                                )
                                            }
                                            disabled={Boolean(
                                                approvalAction
                                            )}
                                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold disabled:opacity-50"
                                        >
                                            {approvalAction ===
                                            `reject-${selectedApproval.id}` ? (
                                                <Loader2
                                                    size={
                                                        16
                                                    }
                                                    className="animate-spin"
                                                />
                                            ) : (
                                                <XCircle
                                                    size={
                                                        16
                                                    }
                                                />
                                            )}

                                            Reject
                                        </button>

                                        {/* APPROVE */}

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleApprovalAction(
                                                    selectedApproval.id,
                                                    "approve"
                                                )
                                            }
                                            disabled={Boolean(
                                                approvalAction
                                            )}
                                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50"
                                        >
                                            {approvalAction ===
                                            `approve-${selectedApproval.id}` ? (
                                                <Loader2
                                                    size={
                                                        16
                                                    }
                                                    className="animate-spin"
                                                />
                                            ) : (
                                                <CheckCircle2
                                                    size={
                                                        16
                                                    }
                                                />
                                            )}

                                            Approve
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
            </div>
        </div>
    );
}

export default PerformanceReview;