// src/pages/PerformanceReviewDetail.jsx

import { useEffect, useState } from "react";
import {
    ArrowLeft,
    CheckCircle2,
    ClipboardList,
    Lock,
    Save,
    Send,
    MessageSquare,
    AlertCircle,
    Loader2,
    ArrowRight,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";


// ============================================================
// STATUS STYLES
// ============================================================

const statusStyles = {
    "Not Started":
        "bg-gray-100 text-gray-600 border-gray-200",

    Goals:
        "bg-orange-50 text-orange-600 border-orange-200",

    "Self Assessment":
        "bg-blue-50 text-blue-600 border-blue-200",

    "Manager Review":
        "bg-purple-50 text-purple-600 border-purple-200",

    "HR Review":
        "bg-orange-50 text-orange-600 border-orange-200",

    Approved:
        "bg-green-50 text-green-600 border-green-200",

    "Needs Correction":
        "bg-red-50 text-red-600 border-red-200",

    Completed:
        "bg-green-50 text-green-600 border-green-200",
};


// ============================================================
// COMPONENT
// ============================================================

function PerformanceReviewDetail() {
    const { reviewId } = useParams();
    const navigate = useNavigate();
    const { currentUser, employeeId } = useAuth();

    const [review, setReview] = useState(null);
    const [loading, setLoading] = useState(true);

    const [savingGoal, setSavingGoal] = useState(null);
    const [savingAll, setSavingAll] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [goalData, setGoalData] = useState({});


    // ========================================================
    // FETCH REVIEW
    // ========================================================

    useEffect(() => {
        fetchReview();
    }, [reviewId]);


    async function fetchReview() {
        if (!reviewId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            const response = await fetch(
                `/api/performance-reviews/${reviewId}`
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                toast.error(
                    data.message || "Failed to load performance review"
                );
                setReview(null);
                return;
            }

            setReview(data.review);

            // ------------------------------------------------
            // Prepare local goal state
            // ------------------------------------------------

            const initialGoals = {};

            (data.review.goals || []).forEach((goal) => {
                initialGoals[goal.id] = {
                    goal_description:
                        goal.goal_description || "",

                    employee_comments:
                        goal.employee_comments || "",
                };
            });

            setGoalData(initialGoals);

        } catch (error) {
            console.error("fetchReview error:", error);

            toast.error(
                "Could not connect to the server"
            );
        } finally {
            setLoading(false);
        }
    }


    // ========================================================
    // UPDATE LOCAL GOAL FIELD
    // ========================================================

    function handleGoalChange(goalId, field, value) {
        setGoalData((previous) => ({
            ...previous,
            [goalId]: {
                ...previous[goalId],
                [field]: value,
            },
        }));
    }


    // ========================================================
    // DETERMINE WHETHER EMPLOYEE CAN EDIT
    // ========================================================

    const canEdit =
        review &&
        (
            review.status === "Goals" ||
            review.status === "Self Assessment" ||
            review.status === "Needs Correction"
        );


    // ========================================================
    // SAVE SINGLE GOAL
    // ========================================================

    async function handleSaveGoal(goal) {
        const data = goalData[goal.id];

        if (!data) return;

        if (!canEdit) {
            toast.error(
                "These goals are currently locked"
            );
            return;
        }

        try {
            setSavingGoal(goal.id);

            const response = await fetch(
                `/api/performance-reviews/goals/${goal.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        goal_description:
                            data.goal_description.trim() || null,

                        employee_comments:
                            data.employee_comments.trim() || null,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                toast.error(
                    result.message ||
                        "Failed to save goal"
                );
                return;
            }

            // ------------------------------------------------
            // Update local review
            // ------------------------------------------------

            setReview((previous) => ({
                ...previous,
                goals: previous.goals.map((item) =>
                    item.id === goal.id
                        ? {
                              ...item,
                              ...result.goal,
                          }
                        : item
                ),
            }));

            toast.success(
                `Goal ${goal.goal_number} saved`
            );

        } catch (error) {
            console.error(
                "handleSaveGoal error:",
                error
            );

            toast.error(
                "Could not connect to the server"
            );
        } finally {
            setSavingGoal(null);
        }
    }


    // ========================================================
    // SAVE ALL GOALS
    // ========================================================

    async function saveAllGoals() {
        if (!review) return false;

        try {
            setSavingAll(true);

            for (const goal of review.goals || []) {
                const data = goalData[goal.id];

                if (!data) {
                    throw new Error(
                        `Goal ${goal.goal_number} data is missing`
                    );
                }

                const response = await fetch(
                    `/api/performance-reviews/goals/${goal.id}`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            goal_description:
                                data.goal_description.trim() ||
                                null,

                            employee_comments:
                                data.employee_comments.trim() ||
                                null,
                        }),
                    }
                );

                const result =
                    await response.json();

                if (
                    !response.ok ||
                    !result.success
                ) {
                    toast.error(
                        result.message ||
                            `Failed to save Goal ${goal.goal_number}`
                    );

                    return false;
                }
            }

            await fetchReview();

            return true;

        } catch (error) {
            console.error(
                "saveAllGoals error:",
                error
            );

            toast.error(
                error.message ||
                    "Could not save all goals"
            );

            return false;
        } finally {
            setSavingAll(false);
        }
    }


    // ========================================================
    // MOVE REVIEW TO SELF ASSESSMENT
    //
    // This is required because submitPerformanceReview
    // only accepts reviews with status = "Self Assessment".
    // ========================================================

    async function handleContinueToSelfAssessment() {
    if (!review) return;

    // ----------------------------------------------------
    // Validate every goal
    // ----------------------------------------------------

    const incompleteGoal = (review.goals || []).find((goal) => {
        const data = goalData[goal.id];

        return (
            !data ||
            !data.goal_description ||
            !data.goal_description.trim()
        );
    });

    if (incompleteGoal) {
        toast.error(
            `Please complete Goal ${incompleteGoal.goal_number} before continuing`
        );
        return;
    }

    // ----------------------------------------------------
    // Save all goals first
    // ----------------------------------------------------

    const saved = await saveAllGoals();

    if (!saved) return;

    try {
        setSubmitting(true);

        // ------------------------------------------------
        // Goals → Self Assessment
        // ------------------------------------------------

        const response = await fetch(
            `/api/performance-reviews/${review.id}/self-assessment`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    employee_id:
                        employeeId || currentUser?.id,
                }),
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            toast.error(
                data.message ||
                    "Unable to continue to Self Assessment"
            );
            return;
        }

        toast.success(
            "Goals saved. Self Assessment is now open."
        );

        await fetchReview();
    } catch (error) {
        console.error(
            "handleContinueToSelfAssessment error:",
            error
        );

        toast.error(
            "Could not connect to the server"
        );
    } finally {
        setSubmitting(false);
    }
}


    // ========================================================
    // SUBMIT PERFORMANCE REVIEW
    // ========================================================

    async function handleSubmit() {
        if (!review) return;

        // ----------------------------------------------------
        // Only Self Assessment can be submitted
        // ----------------------------------------------------

        if (
            review.status !== "Self Assessment"
        ) {
            toast.error(
                "This review is not ready for submission"
            );
            return;
        }

        // ----------------------------------------------------
        // Validate goals
        // ----------------------------------------------------

        const incompleteGoal =
            (review.goals || []).find((goal) => {
                const data =
                    goalData[goal.id];

                return (
                    !data ||
                    !data.goal_description ||
                    !data.goal_description.trim()
                );
            });

        if (incompleteGoal) {
            toast.error(
                `Please complete Goal ${incompleteGoal.goal_number} before submitting`
            );
            return;
        }

        // ----------------------------------------------------
        // Confirmation
        // ----------------------------------------------------

        const confirmed =
            window.confirm(
                "Are you sure you want to submit your performance review? You will not be able to edit your goals while your manager/HR is reviewing them."
            );

        if (!confirmed) return;

        try {
            setSubmitting(true);

            // ------------------------------------------------
            // Save latest goal changes
            // ------------------------------------------------

            const saved =
                await saveAllGoals();

            if (!saved) return;

            // ------------------------------------------------
            // Submit review
            // ------------------------------------------------

            const submitResponse =
                await fetch(
                    `/api/performance-reviews/${review.id}/submit`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            employee_id:
                                employeeId ||
                                currentUser?.id,
                        }),
                    }
                );

            const submitData =
                await submitResponse.json();

            if (
                !submitResponse.ok ||
                !submitData.success
            ) {
                toast.error(
                    submitData.message ||
                        "Failed to submit performance review"
                );

                return;
            }

            toast.success(
                "Performance review submitted successfully"
            );

            await fetchReview();

        } catch (error) {
            console.error(
                "handleSubmit error:",
                error
            );

            toast.error(
                "Could not connect to the server"
            );
        } finally {
            setSubmitting(false);
        }
    }


    // ========================================================
    // LOADING
    // ========================================================

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Loader2
                        size={18}
                        className="animate-spin"
                    />

                    Loading performance review...
                </div>
            </div>
        );
    }


    // ========================================================
    // NOT FOUND
    // ========================================================

    if (!review) {
        return (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center">

                <AlertCircle
                    size={35}
                    className="mx-auto mb-3 text-red-400"
                />

                <h2 className="text-lg font-semibold text-gray-900">
                    Performance review not found
                </h2>

                <p className="text-sm text-gray-400 mt-1 mb-5">
                    This performance review may have been
                    removed or you may not have access to it.
                </p>

                <button
                    onClick={() =>
                        navigate(
                            "/performance-review"
                        )
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
                >
                    <ArrowLeft size={15} />
                    Back to Performance Review
                </button>

            </div>
        );
    }


    // ========================================================
    // SUBMITTED / LOCKED STATE
    // ========================================================

    const isSubmitted =
        review.status === "Manager Review" ||
        review.status === "HR Review" ||
        review.status === "Approved" ||
        review.status === "Completed";


    // ========================================================
    // RENDER
    // ========================================================

    return (
        <div className="pb-10">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="flex items-center justify-between mb-6">

                <div className="flex items-center gap-3">

                    <button
                        onClick={() =>
                            navigate(
                                "/performance-review"
                            )
                        }
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                        title="Back"
                    >
                        <ArrowLeft size={19} />
                    </button>

                    <div>

                        <div className="flex items-center gap-2">

                            <ClipboardList
                                size={21}
                                className="text-orange-500"
                            />

                            <h1 className="text-2xl font-bold text-gray-900">
                                Performance Review
                            </h1>

                        </div>

                        <p className="text-sm text-gray-400 mt-1">
                            {review.cycle_name}
                            {" · "}
                            {review.financial_year}
                        </p>

                    </div>

                </div>


                <span
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                        statusStyles[
                            review.status
                        ] ||
                        "bg-gray-100 text-gray-600 border-gray-200"
                    }`}
                >
                    {review.status}
                </span>

            </div>


            {/* =================================================
                CYCLE INFORMATION
            ================================================= */}

            <div className="bg-white rounded-xl shadow-sm p-5 mb-5">

                <div className="flex flex-wrap items-start justify-between gap-4">

                    <div>

                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                            Performance Cycle
                        </p>

                        <h2 className="text-lg font-bold text-gray-900">
                            {review.cycle_name}
                        </h2>

                        <p className="text-sm text-gray-500 mt-1">
                            {review.financial_year}
                        </p>

                    </div>


                    <div className="text-right">

                        <p className="text-xs text-gray-400 mb-1">
                            Review Period
                        </p>

                        <p className="text-sm font-medium text-gray-700">
                            {formatDate(
                                review.cycle_start_date
                            )}

                            {" – "}

                            {formatDate(
                                review.cycle_end_date
                            )}
                        </p>

                    </div>

                </div>


                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">

                    <InfoCard
                        label="Current Stage"
                        value={
                            review.current_stage
                        }
                    />

                    <InfoCard
                        label="Review Status"
                        value={
                            review.status
                        }
                    />

                    <InfoCard
                        label="Total Goals"
                        value={`${
                            review.goals?.length ||
                            0
                        } Goals`}
                    />

                </div>

            </div>


            {/* =================================================
                APPROVED MESSAGE
            ================================================= */}

            {review.status === "Approved" && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-5">

                    <div className="flex items-start gap-3">

                        <CheckCircle2
                            size={22}
                            className="text-green-600 mt-0.5"
                        />

                        <div>

                            <h3 className="font-semibold text-green-800">
                                Your performance review
                                has been approved
                            </h3>

                            <p className="text-sm text-green-700 mt-1">
                                Your performance review
                                has been reviewed and
                                approved by management.
                            </p>

                        </div>

                    </div>

                </div>
            )}


            {/* =================================================
                MANAGER / HR REVIEW MESSAGE
            ================================================= */}

            {isSubmitted &&
                review.status !==
                    "Approved" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">

                        <div className="flex items-start gap-3">

                            <Lock
                                size={21}
                                className="text-blue-600 mt-0.5"
                            />

                            <div>

                                <h3 className="font-semibold text-blue-800">
                                    Your goals are under review
                                </h3>

                                <p className="text-sm text-blue-700 mt-1">
                                    Your goals have been
                                    submitted and are
                                    currently being reviewed
                                    by your manager / HR.
                                </p>

                            </div>

                        </div>

                    </div>
                )}


            {/* =================================================
                NEEDS CORRECTION
            ================================================= */}

            {review.status ===
                "Needs Correction" && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-5">

                    <div className="flex items-start gap-3">

                        <MessageSquare
                            size={21}
                            className="text-red-600 mt-0.5"
                        />

                        <div>

                            <h3 className="font-semibold text-red-800">
                                Changes requested
                            </h3>

                            <p className="text-sm text-red-700 mt-1">
                                Your manager / HR has
                                requested changes to your
                                goals. Please review the
                                feedback below and update
                                your goals before
                                submitting again.
                            </p>

                            {review.manager_comments && (
                                <div className="mt-3 bg-white border border-red-100 rounded-lg p-3">

                                    <p className="text-xs font-semibold text-gray-500 mb-1">
                                        Manager feedback
                                    </p>

                                    <p className="text-sm text-gray-700 whitespace-pre-line">
                                        {
                                            review.manager_comments
                                        }
                                    </p>

                                </div>
                            )}

                            {review.hr_comments && (
                                <div className="mt-3 bg-white border border-red-100 rounded-lg p-3">

                                    <p className="text-xs font-semibold text-gray-500 mb-1">
                                        HR feedback
                                    </p>

                                    <p className="text-sm text-gray-700 whitespace-pre-line">
                                        {
                                            review.hr_comments
                                        }
                                    </p>

                                </div>
                            )}

                        </div>

                    </div>

                </div>
            )}


            {/* =================================================
                SELF ASSESSMENT INFORMATION
            ================================================= */}

            {review.status ===
                "Self Assessment" && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">

                    <div className="flex items-start gap-3">

                        <ClipboardList
                            size={21}
                            className="text-blue-600 mt-0.5"
                        />

                        <div>

                            <h3 className="font-semibold text-blue-800">
                                Self Assessment
                            </h3>

                            <p className="text-sm text-blue-700 mt-1">
                                Review your goals and
                                comments carefully before
                                submitting your performance
                                review.
                            </p>

                        </div>

                    </div>

                </div>
            )}


            {/* =================================================
                GOALS
            ================================================= */}

            <div className="mb-5">

                <div className="flex items-center justify-between mb-4">

                    <div>

                        <h2 className="text-lg font-bold text-gray-900">
                            My Performance Goals
                        </h2>

                        <p className="text-sm text-gray-400 mt-1">
                            Define the goals you want to
                            achieve during this financial
                            year.
                        </p>

                    </div>

                    <span className="text-xs text-gray-400">
                        100% total weightage
                    </span>

                </div>


                <div className="flex flex-col gap-4">

                    {(review.goals || []).map(
                        (goal) => {

                            const data =
                                goalData[
                                    goal.id
                                ] || {
                                    goal_description:
                                        goal.goal_description ||
                                        "",

                                    employee_comments:
                                        goal.employee_comments ||
                                        "",
                                };

                            return (
                                <div
                                    key={goal.id}
                                    className="bg-white rounded-xl shadow-sm p-5"
                                >

                                    {/* GOAL HEADER */}

                                    <div className="flex items-start justify-between gap-4 mb-4">

                                        <div className="flex items-start gap-3">

                                            <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm">
                                                {
                                                    goal.goal_number
                                                }
                                            </div>

                                            <div>

                                                <h3 className="text-sm font-semibold text-gray-900">
                                                    Goal{" "}
                                                    {
                                                        goal.goal_number
                                                    }
                                                </h3>

                                                <p className="text-xs text-gray-500 mt-1">
                                                    {
                                                        goal.goal_category
                                                    }
                                                </p>

                                            </div>

                                        </div>


                                        <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                                            {
                                                goal.weightage
                                            }
                                            % Weight
                                        </span>

                                    </div>


                                    {/* GOAL DESCRIPTION */}

                                    <div className="mb-4">

                                        <label className="block text-xs font-semibold text-gray-600 mb-2">
                                            What do you want
                                            to achieve?
                                        </label>

                                        <textarea
                                            value={
                                                data.goal_description
                                            }
                                            disabled={
                                                !canEdit
                                            }
                                            onChange={(e) =>
                                                handleGoalChange(
                                                    goal.id,
                                                    "goal_description",
                                                    e.target.value
                                                )
                                            }
                                            rows={4}
                                            placeholder="Describe your goal, expected outcome and what success will look like..."
                                            className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 outline-none resize-none transition-colors ${
                                                canEdit
                                                    ? "border-gray-300 focus:border-orange-400 focus:ring-1 focus:ring-orange-100"
                                                    : "bg-gray-50 border-gray-200 cursor-not-allowed"
                                            }`}
                                        />

                                    </div>


                                    {/* EMPLOYEE COMMENTS */}

                                    <div className="mb-4">

                                        <label className="block text-xs font-semibold text-gray-600 mb-2">
                                            Employee comments
                                        </label>

                                        <textarea
                                            value={
                                                data.employee_comments
                                            }
                                            disabled={
                                                !canEdit
                                            }
                                            onChange={(e) =>
                                                handleGoalChange(
                                                    goal.id,
                                                    "employee_comments",
                                                    e.target.value
                                                )
                                            }
                                            rows={3}
                                            placeholder="Add any additional details, milestones or expectations..."
                                            className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 outline-none resize-none transition-colors ${
                                                canEdit
                                                    ? "border-gray-300 focus:border-orange-400 focus:ring-1 focus:ring-orange-100"
                                                    : "bg-gray-50 border-gray-200 cursor-not-allowed"
                                            }`}
                                        />

                                    </div>


                                    {/* MANAGER COMMENTS */}

                                    {goal.manager_comments && (
                                        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-4">

                                            <div className="flex items-center gap-2 mb-1">

                                                <MessageSquare
                                                    size={14}
                                                    className="text-purple-600"
                                                />

                                                <span className="text-xs font-semibold text-purple-700">
                                                    Manager feedback
                                                </span>

                                            </div>

                                            <p className="text-sm text-gray-700 whitespace-pre-line">
                                                {
                                                    goal.manager_comments
                                                }
                                            </p>

                                        </div>
                                    )}


                                    {/* MANAGER RATING */}

                                    {goal.manager_rating !==
                                        null &&
                                        goal.manager_rating !==
                                            undefined && (
                                            <div className="flex items-center gap-2 mb-4">

                                                <span className="text-xs text-gray-500">
                                                    Manager Rating:
                                                </span>

                                                <span className="text-sm font-bold text-purple-600">
                                                    {
                                                        goal.manager_rating
                                                    }
                                                </span>

                                            </div>
                                        )}


                                    {/* SAVE BUTTON */}

                                    {canEdit && (
                                        <div className="flex justify-end pt-3 border-t border-gray-100">

                                            <button
                                                onClick={() =>
                                                    handleSaveGoal(
                                                        goal
                                                    )
                                                }
                                                disabled={
                                                    savingGoal ===
                                                        goal.id ||
                                                    savingAll ||
                                                    submitting
                                                }
                                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold disabled:opacity-50"
                                            >

                                                {savingGoal ===
                                                goal.id ? (
                                                    <>
                                                        <Loader2
                                                            size={14}
                                                            className="animate-spin"
                                                        />
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Save
                                                            size={14}
                                                        />
                                                        Save Goal
                                                    </>
                                                )}

                                            </button>

                                        </div>
                                    )}

                                </div>
                            );
                        }
                    )}

                </div>

            </div>


            {/* =================================================
                ACTION SECTION
            ================================================= */}

            {review.status ===
                "Goals" && (
                <div className="bg-white rounded-xl shadow-sm p-5">

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                        <div>

                            <h3 className="font-semibold text-gray-900">
                                Complete your Performance Goals
                            </h3>

                            <p className="text-sm text-gray-400 mt-1">
                                Complete all five goals and
                                continue to the Self Assessment
                                stage.
                            </p>

                        </div>

                        <button
                            onClick={
                                handleContinueToSelfAssessment
                            }
                            disabled={
                                savingAll ||
                                submitting
                            }
                            className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >

                            {savingAll ||
                            submitting ? (
                                <>
                                    <Loader2
                                        size={16}
                                        className="animate-spin"
                                    />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    Continue
                                    <ArrowRight
                                        size={16}
                                    />
                                </>
                            )}

                        </button>

                    </div>

                </div>
            )}


            {/* =================================================
                SELF ASSESSMENT SUBMIT
            ================================================= */}

            {review.status ===
                "Self Assessment" && (
                <div className="bg-white rounded-xl shadow-sm p-5">

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                        <div>

                            <h3 className="font-semibold text-gray-900">
                                Ready to submit your review?
                            </h3>

                            <p className="text-sm text-gray-400 mt-1">
                                Once submitted, your goals will
                                be locked and sent to your
                                reporting manager for review.
                            </p>

                        </div>


                        <button
                            onClick={handleSubmit}
                            disabled={
                                submitting ||
                                savingAll
                            }
                            className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >

                            {submitting ? (
                                <>
                                    <Loader2
                                        size={16}
                                        className="animate-spin"
                                    />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    Submit Review
                                </>
                            )}

                        </button>

                    </div>

                </div>
            )}


            {/* =================================================
                NEEDS CORRECTION ACTION
            ================================================= */}

            {review.status ===
                "Needs Correction" && (
                <div className="bg-white rounded-xl shadow-sm p-5">

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                        <div>

                            <h3 className="font-semibold text-gray-900">
                                Update requested changes
                            </h3>

                            <p className="text-sm text-gray-400 mt-1">
                                Make the requested changes and
                                continue your Self Assessment.
                            </p>

                        </div>

                        <button
                            onClick={
                                handleContinueToSelfAssessment
                            }
                            disabled={
                                savingAll ||
                                submitting
                            }
                            className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                        >

                            {savingAll ||
                            submitting ? (
                                <>
                                    <Loader2
                                        size={16}
                                        className="animate-spin"
                                    />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    Save & Continue
                                    <ArrowRight
                                        size={16}
                                    />
                                </>
                            )}

                        </button>

                    </div>

                </div>
            )}


            {/* =================================================
                LOCKED NOTICE
            ================================================= */}

            {!canEdit && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">

                    <div className="flex items-center gap-2 text-gray-500">

                        <Lock size={16} />

                        <p className="text-xs">
                            Your goals are currently locked because
                            this review is being processed.
                        </p>

                    </div>

                </div>
            )}

        </div>
    );
}


// ============================================================
// INFO CARD
// ============================================================

function InfoCard({ label, value }) {
    return (
        <div className="bg-gray-50 rounded-lg p-3">

            <p className="text-xs text-gray-400 mb-1">
                {label}
            </p>

            <p className="text-sm font-semibold text-gray-700">
                {value || "—"}
            </p>

        </div>
    );
}


// ============================================================
// DATE FORMATTER
// ============================================================

function formatDate(dateString) {
    if (!dateString) return "—";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}


export default PerformanceReviewDetail;