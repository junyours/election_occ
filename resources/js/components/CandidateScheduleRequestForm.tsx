// resources/js/pages/Candidates/CandidateScheduleRequestForm.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
    Card,
    CardContent,
    CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { campaignScheduleRequestAPI } from "../api/campaignScheduleRequest";
import { courseAPI } from "../api/courses";
import { campaignScheduleAPI } from "../api/campaignschedules";
import { useElections } from "../hooks/useElections";
import { useAuth } from "../contexts/AuthContext";
import { candidateAPI } from "../api/candidates";
import {
    Calendar,
    Clock,
    Send,
    Loader2,
    CheckCircle,
    AlertCircle,
    School,
    FileText,
    Plus,
    Info,
    CalendarDays,
    Timer,
    Ban,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Users,
} from "lucide-react";

interface CourseSection {
    section_id: number;
    section_code: string;
    section_name: string;
    year_level: number;
    course_id: number;
    course?: {
        course_id: number;
        course_code: string;
        course_name: string;
    };
}

interface ScheduleRequest {
    request_id: number;
    section_id: number;
    preferred_date: string;
    preferred_start_time: string;
    preferred_end_time: string;
    message: string | null;
    status: "pending" | "approved" | "rejected" | "rescheduled";
    admin_remarks: string | null;
    created_at: string;
    section?: {
        section_id: number;
        section_code: string;
        year_level: number;
        course?: {
            course_code: string;
        };
    };
}

interface ExistingSchedule {
    schedule_id: number;
    section_id: number;
    start_time: string;
    end_time: string;
    status: string;
    section?: {
        section_code: string;
        year_level: number;
        course?: {
            course_code: string;
        };
    };
}

const formatDateFriendly = (dateStr: string): string => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};

const formatTimeFriendly = (timeStr: string): string => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
};

const calculateDuration = (start: string, end: string): string => {
    if (!start || !end) return "";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const diff = endMin - startMin;
    if (diff <= 0) return "";
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    if (hours === 0) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    if (minutes === 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
    return `${hours}h ${minutes}m`;
};

const getTodayISO = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const getCurrentTimeHHMM = (): string => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const CandidateScheduleRequestForm: React.FC = () => {
    const { user } = useAuth();
    const { data: elections = [] } = useElections();

    const [sections, setSections] = useState<CourseSection[]>([]);
    const [myRequests, setMyRequests] = useState<ScheduleRequest[]>([]);
    const [mySchedules, setMySchedules] = useState<ExistingSchedule[]>([]);
    const [loadingInitial, setLoadingInitial] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [showHistory, setShowHistory] = useState(false);

    const [formData, setFormData] = useState({
        election_id: "",
        section_id: "",
        preferred_date: getTodayISO(),
        preferred_start_time: "",
        preferred_end_time: "",
        message: "",
    });

    // ============================================================
    // INITIAL LOAD
    // ============================================================
    useEffect(() => {
        const init = async () => {
            setLoadingInitial(true);
            try {
                await Promise.all([fetchSections(), fetchMyRequests()]);
            } finally {
                setLoadingInitial(false);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (elections.length > 0 && !formData.election_id) {
            setFormData((prev) => ({
                ...prev,
                election_id: elections[0].election_id.toString(),
            }));
        }
    }, [elections]);

    // When election changes, load schedules for the candidate
    useEffect(() => {
        if (!formData.election_id || !user) return;
        fetchMySchedules();
    }, [formData.election_id, user?.user_id]);

    const fetchSections = async () => {
        try {
            const response = await courseAPI.getAllSections();
            const data = response.data || [];
            setSections(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch sections:", err);
        }
    };

    const fetchMyRequests = async () => {
        try {
            const requests = await campaignScheduleRequestAPI.getMyRequests();
            setMyRequests(Array.isArray(requests) ? requests : []);
        } catch (err) {
            console.warn("Failed to fetch my requests:", err);
        }
    };

    const fetchMySchedules = async () => {
        if (!user) return;
        try {
            // Find candidate record for this election
            const candidatesRes = await candidateAPI.getByElection(
                parseInt(formData.election_id),
            );
            const allCandidates = Array.isArray(candidatesRes.data)
                ? candidatesRes.data
                : candidatesRes.data?.data || [];
            const me = allCandidates.find(
                (c: any) => Number(c.user_id) === Number(user.user_id),
            );
            if (!me) {
                setMySchedules([]);
                return;
            }
            const res = await campaignScheduleAPI.getByCandidate(
                me.candidate_id,
            );
            const data = res.data?.data ?? res.data;
            setMySchedules(Array.isArray(data) ? data : []);
        } catch (err) {
            console.warn("Failed to fetch schedules:", err);
            setMySchedules([]);
        }
    };

    // ============================================================
    // DERIVED STATE
    // ============================================================
    const selectedSection = useMemo(
        () =>
            sections.find(
                (s) => s.section_id.toString() === formData.section_id,
            ),
        [sections, formData.section_id],
    );

    const duration = useMemo(
        () =>
            calculateDuration(
                formData.preferred_start_time,
                formData.preferred_end_time,
            ),
        [formData.preferred_start_time, formData.preferred_end_time],
    );

    /**
     * Live validation messages
     */
    const validation = useMemo(() => {
        const errors: Record<string, string> = {};

        if (!formData.election_id) {
            errors.election_id = "Please select an election";
        }
        if (!formData.section_id) {
            errors.section_id = "Please select a course section";
        }
        if (!formData.preferred_date) {
            errors.preferred_date = "Please choose a date";
        } else if (formData.preferred_date < getTodayISO()) {
            errors.preferred_date = "Date cannot be in the past";
        }
        if (!formData.preferred_start_time) {
            errors.preferred_start_time = "Please choose a start time";
        }
        if (!formData.preferred_end_time) {
            errors.preferred_end_time = "Please choose an end time";
        } else if (
            formData.preferred_start_time &&
            formData.preferred_end_time <= formData.preferred_start_time
        ) {
            errors.preferred_end_time =
                "End time must be after start time";
        }

        // If date is today, ensure start time hasn't passed
        if (
            formData.preferred_date === getTodayISO() &&
            formData.preferred_start_time &&
            formData.preferred_start_time < getCurrentTimeHHMM()
        ) {
            errors.preferred_start_time =
                "This time has already passed today";
        }

        return errors;
    }, [formData]);

    const hasErrors = Object.keys(validation).length > 0;
    const pendingRequest = myRequests.find((r) => r.status === "pending");

    // ============================================================
    // SUBMIT
    // ============================================================
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (hasErrors) {
            setError("Please fix the highlighted fields before submitting");
            return;
        }

        setSubmitting(true);
        try {
            await campaignScheduleRequestAPI.create({
                election_id: parseInt(formData.election_id),
                section_id: parseInt(formData.section_id),
                preferred_date: formData.preferred_date,
                preferred_start_time: formData.preferred_start_time,
                preferred_end_time: formData.preferred_end_time,
                message: formData.message,
            });

            setSuccess(
                "Schedule request submitted successfully! COMELEC will review your request and notify you.",
            );

            // Reset form (keep election), refresh data
            setFormData((prev) => ({
                ...prev,
                section_id: "",
                preferred_date: getTodayISO(),
                preferred_start_time: "",
                preferred_end_time: "",
                message: "",
            }));
            await fetchMyRequests();
        } catch (err: any) {
            const apiErrors = err.response?.data?.errors;
            if (apiErrors) {
                const firstError = Object.values(apiErrors)[0];
                setError(
                    Array.isArray(firstError) ? firstError[0] : String(firstError),
                );
            } else {
                setError(
                    err.response?.data?.message ||
                    "Failed to submit schedule request",
                );
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setError("");
        setSuccess("");
    };

    // ============================================================
    // LOADING
    // ============================================================
    if (loadingInitial) {
        return (
            <div className="min-h-[300px] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">
                        Loading form...
                    </p>
                </div>
            </div>
        );
    }

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="space-y-6 max-w-3xl mx-auto pb-10">
            {/* Header */}
            <div className="relative rounded-2xl overflow-hidden bg-blue-600 shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="relative px-6 py-8">
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-5 h-5 text-yellow-300" />
                        <Badge className="bg-white/20 text-white border-0">
                            Schedule Request
                        </Badge>
                    </div>
                    <h1 className="text-3xl font-bold text-white">
                        Request Campaign Schedule
                    </h1>
                    <p className="text-blue-100 mt-1">
                        Submit a schedule request for your campaign. COMELEC
                        will review it shortly.
                    </p>
                </div>
            </div>

            {/* Pending request banner */}
            {pendingRequest && (
                <Alert className="bg-yellow-50 border-yellow-200 rounded-xl">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                        <p className="font-semibold mb-1">
                            You already have a pending request
                        </p>
                        <p className="text-sm">
                            Your request for{" "}
                            <strong>
                                {pendingRequest.section?.course?.course_code} -
                                Year {pendingRequest.section?.year_level} Section{" "}
                                {pendingRequest.section?.section_code}
                            </strong>{" "}
                            on{" "}
                            <strong>
                                {formatDateFriendly(
                                    pendingRequest.preferred_date,
                                )}
                            </strong>{" "}
                            is awaiting COMELEC approval. Please wait before
                            submitting another.
                        </p>
                    </AlertDescription>
                </Alert>
            )}

            {/* Success / Error */}
            {success && (
                <Alert className="bg-green-50 border-green-200 rounded-xl animate-in fade-in duration-300">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 font-medium">
                        {success}
                    </AlertDescription>
                </Alert>
            )}
            {error && (
                <Alert variant="destructive" className="rounded-xl animate-in fade-in duration-300">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* FORM */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b">
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Schedule Details
                    </CardTitle>
                </div>
                <CardContent className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* STEP 1: Election */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                                    1
                                </span>
                                <Label className="text-base font-semibold text-gray-800">
                                    Which election?
                                </Label>
                            </div>
                            <Select
                                value={formData.election_id}
                                onValueChange={(value) =>
                                    handleChange("election_id", value)
                                }
                            >
                                <SelectTrigger
                                    className={`rounded-xl h-12 ${validation.election_id
                                        ? "border-red-300"
                                        : ""
                                        }`}
                                >
                                    <SelectValue placeholder="Choose an election" />
                                </SelectTrigger>
                                <SelectContent>
                                    {elections.map((election: any) => (
                                        <SelectItem
                                            key={election.election_id}
                                            value={election.election_id.toString()}
                                        >
                                            <span className="font-medium">
                                                {election.title}
                                            </span>
                                            <span className="text-xs text-gray-400 ml-2">
                                                {election.election_type}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {validation.election_id && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {validation.election_id}
                                </p>
                            )}
                        </div>

                        {/* STEP 2: Section */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                                    2
                                </span>
                                <Label className="text-base font-semibold text-gray-800">
                                    Which course section?
                                </Label>
                            </div>
                            <Select
                                value={formData.section_id}
                                onValueChange={(value) =>
                                    handleChange("section_id", value)
                                }
                            >
                                <SelectTrigger
                                    className={`rounded-xl h-12 ${validation.section_id
                                        ? "border-red-300"
                                        : ""
                                        }`}
                                >
                                    <SelectValue placeholder="Choose a course section" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sections.map((section) => (
                                        <SelectItem
                                            key={section.section_id}
                                            value={section.section_id.toString()}
                                        >
                                            <span className="font-medium">
                                                {section.course?.course_code ||
                                                    "Course"}
                                            </span>
                                            <span className="text-gray-500 ml-2">
                                                · Year {section.year_level} ·
                                                Section{" "}
                                                {section.section_code}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedSection && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                                    <School className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                    <p className="text-xs text-blue-800">
                                        <strong>
                                            {selectedSection.course?.course_code}
                                        </strong>{" "}
                                        · Year {selectedSection.year_level} ·
                                        Section{" "}
                                        {selectedSection.section_code}
                                    </p>
                                </div>
                            )}
                            {validation.section_id && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {validation.section_id}
                                </p>
                            )}
                        </div>

                        {/* STEP 3: Date + Time */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                                    3
                                </span>
                                <Label className="text-base font-semibold text-gray-800">
                                    When would you like to campaign?
                                </Label>
                            </div>

                            {/* Date */}
                            <div className="space-y-1.5">
                                <Label className="text-sm text-gray-600 flex items-center gap-1.5">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    Date
                                </Label>
                                <Input
                                    type="date"
                                    value={formData.preferred_date}
                                    min={getTodayISO()}
                                    onChange={(e) =>
                                        handleChange(
                                            "preferred_date",
                                            e.target.value,
                                        )
                                    }
                                    className={`rounded-xl h-12 ${validation.preferred_date
                                        ? "border-red-300"
                                        : ""
                                        }`}
                                />
                                {formData.preferred_date && (
                                    <p className="text-xs text-gray-500">
                                        📅{" "}
                                        {formatDateFriendly(
                                            formData.preferred_date,
                                        )}
                                    </p>
                                )}
                                {validation.preferred_date && (
                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {validation.preferred_date}
                                    </p>
                                )}
                            </div>

                            {/* Time range */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-sm text-gray-600 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        Start Time
                                    </Label>
                                    <Input
                                        type="time"
                                        value={
                                            formData.preferred_start_time
                                        }
                                        onChange={(e) =>
                                            handleChange(
                                                "preferred_start_time",
                                                e.target.value,
                                            )
                                        }
                                        className={`rounded-xl h-12 ${validation.preferred_start_time
                                            ? "border-red-300"
                                            : ""
                                            }`}
                                    />
                                    {formData.preferred_start_time && (
                                        <p className="text-xs text-gray-500">
                                            🕐{" "}
                                            {formatTimeFriendly(
                                                formData.preferred_start_time,
                                            )}
                                        </p>
                                    )}
                                    {validation.preferred_start_time && (
                                        <p className="text-xs text-red-500 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            {validation.preferred_start_time}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-sm text-gray-600 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        End Time
                                    </Label>
                                    <Input
                                        type="time"
                                        value={formData.preferred_end_time}
                                        onChange={(e) =>
                                            handleChange(
                                                "preferred_end_time",
                                                e.target.value,
                                            )
                                        }
                                        className={`rounded-xl h-12 ${validation.preferred_end_time
                                            ? "border-red-300"
                                            : ""
                                            }`}
                                    />
                                    {formData.preferred_end_time && (
                                        <p className="text-xs text-gray-500">
                                            🕐{" "}
                                            {formatTimeFriendly(
                                                formData.preferred_end_time,
                                            )}
                                        </p>
                                    )}
                                    {validation.preferred_end_time && (
                                        <p className="text-xs text-red-500 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            {validation.preferred_end_time}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Duration preview */}
                            {duration && !hasErrors && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
                                    <Timer className="w-4 h-4 text-green-600" />
                                    <p className="text-xs text-green-800">
                                        Duration:{" "}
                                        <strong>{duration}</strong>
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* STEP 4: Message */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-sm font-bold">
                                    4
                                </span>
                                <Label className="text-base font-semibold text-gray-800">
                                    Add a note{" "}
                                    <span className="text-xs font-normal text-gray-400">
                                        (optional)
                                    </span>
                                </Label>
                            </div>
                            <Textarea
                                value={formData.message}
                                onChange={(e) =>
                                    handleChange("message", e.target.value)
                                }
                                placeholder="Any special requests or additional info for COMELEC..."
                                rows={3}
                                className="rounded-xl resize-none"
                                maxLength={500}
                            />
                            <p className="text-xs text-gray-400 text-right">
                                {formData.message.length}/500
                            </p>
                        </div>

                        {/* Submit */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Info className="w-3 h-3" />
                                {hasErrors
                                    ? `${Object.keys(validation).length} field${Object.keys(validation).length !== 1 ? "s" : ""} need attention`
                                    : "All fields look good"}
                            </p>
                            <Button
                                type="submit"
                                disabled={
                                    submitting || hasErrors || !!pendingRequest
                                }
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 rounded-xl px-8 h-12 text-base font-semibold shadow-md"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        Submit Request
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* MY REQUEST HISTORY (collapsible) */}
            {myRequests.length > 0 && (
                <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowHistory((p) => !p)}
                        className="w-full bg-gray-50 px-6 py-4 border-b flex items-center justify-between hover:bg-gray-100 transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-purple-600" />
                            <span className="font-semibold text-gray-800">
                                My Request History
                            </span>
                            <Badge className="bg-purple-100 text-purple-700 border-0">
                                {myRequests.length}
                            </Badge>
                        </span>
                        {showHistory ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                    </button>
                    {showHistory && (
                        <CardContent className="p-0">
                            <div className="divide-y divide-gray-100">
                                {myRequests.map((req) => {
                                    const statusConfig = {
                                        pending: {
                                            label: "Pending",
                                            color: "bg-yellow-100 text-yellow-800",
                                        },
                                        approved: {
                                            label: "Approved",
                                            color: "bg-green-100 text-green-800",
                                        },
                                        rejected: {
                                            label: "Rejected",
                                            color: "bg-red-100 text-red-800",
                                        },
                                        rescheduled: {
                                            label: "Rescheduled",
                                            color: "bg-blue-100 text-blue-800",
                                        },
                                    }[req.status] || {
                                        label: req.status,
                                        color: "bg-gray-100 text-gray-800",
                                    };

                                    return (
                                        <div
                                            key={req.request_id}
                                            className="p-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-start justify-between flex-wrap gap-2">
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {req.section?.course
                                                            ?.course_code ||
                                                            "Course"}{" "}
                                                        · Year{" "}
                                                        {req.section?.year_level}{" "}
                                                        · Section{" "}
                                                        {req.section?.section_code}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-3 flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {formatDateFriendly(
                                                                req.preferred_date,
                                                            )}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {formatTimeFriendly(
                                                                req.preferred_start_time,
                                                            )}{" "}
                                                            -{" "}
                                                            {formatTimeFriendly(
                                                                req.preferred_end_time,
                                                            )}
                                                        </span>
                                                    </p>
                                                    {req.message && (
                                                        <p className="text-xs text-gray-600 mt-2 italic">
                                                            "{req.message}"
                                                        </p>
                                                    )}
                                                    {req.admin_remarks && (
                                                        <p className="text-xs text-gray-600 mt-2 px-2 py-1 bg-blue-50 rounded">
                                                            <strong>
                                                                Admin:
                                                            </strong>{" "}
                                                            {req.admin_remarks}
                                                        </p>
                                                    )}
                                                </div>
                                                <Badge
                                                    className={`${statusConfig.color} border-0 flex-shrink-0`}
                                                >
                                                    {statusConfig.label}
                                                </Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    )}
                </Card>
            )}

            {/* MY APPROVED SCHEDULES */}
            {mySchedules.length > 0 && (
                <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
                    <div className="bg-green-50 px-6 py-4 border-b">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-semibold text-green-800">
                                Approved Campaign Schedules
                            </span>
                            <Badge className="bg-green-100 text-green-800 border-0">
                                {mySchedules.length}
                            </Badge>
                        </div>
                    </div>
                    <CardContent className="p-4">
                        <div className="space-y-2">
                            {mySchedules.map((s) => (
                                <div
                                    key={s.schedule_id}
                                    className="flex items-center gap-3 p-3 bg-green-50/50 border border-green-100 rounded-lg"
                                >
                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <Calendar className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-gray-900">
                                            {s.section?.course?.course_code} ·
                                            Year {s.section?.year_level} ·
                                            Section {s.section?.section_code}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(
                                                s.start_time,
                                            ).toLocaleDateString([], {
                                                weekday: "short",
                                                month: "short",
                                                day: "numeric",
                                            })}{" "}
                                            ·{" "}
                                            {new Date(
                                                s.start_time,
                                            ).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}{" "}
                                            -{" "}
                                            {new Date(
                                                s.end_time,
                                            ).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </p>
                                    </div>
                                    <Badge
                                        className={
                                            {
                                                pending:
                                                    "bg-yellow-100 text-yellow-800",
                                                ongoing:
                                                    "bg-green-100 text-green-800",
                                                completed:
                                                    "bg-blue-100 text-blue-800",
                                                cancelled:
                                                    "bg-red-100 text-red-800",
                                            }[s.status] ||
                                            "bg-gray-100 text-gray-800"
                                        }
                                    >
                                        {s.status}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Info card */}
            <Card className="bg-blue-50 border border-blue-100 rounded-2xl">
                <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-blue-900 mb-2">
                                What happens next?
                            </h4>
                            <ol className="text-sm text-blue-800 space-y-1.5">
                                <li className="flex items-start gap-2">
                                    <span className="font-bold">1.</span>
                                    <span>
                                        You submit a schedule request for a
                                        specific section and time
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="font-bold">2.</span>
                                    <span>
                                        COMELEC reviews your request and checks
                                        for conflicts
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="font-bold">3.</span>
                                    <span>
                                        You'll get a notification with the
                                        decision (approved / rejected /
                                        rescheduled)
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="font-bold">4.</span>
                                    <span>
                                        Approved schedules appear above and in
                                        your dashboard calendar
                                    </span>
                                </li>
                            </ol>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default CandidateScheduleRequestForm;