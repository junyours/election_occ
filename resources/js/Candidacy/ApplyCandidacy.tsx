// resources/js/pages/Candidacy/ApplyCandidacy.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
    Loader2,
    ArrowLeft,
    AlertCircle,
    UserCircle,
    CheckCircle,
    XCircle,
    ListChecks,
    GraduationCap,
    ShieldAlert,
    Building2,
} from "lucide-react";
import CandidacyApplicationForm from "../components/CandidacyApplicationForm";
import { electionAPI } from "../api/elections";
import { useAuth } from "../contexts/AuthContext";

interface Election {
    election_id: number;
    title: string;
    election_type: string;
    department?: string | null;
    description?: string;
    voting_start: string;
    voting_end: string;
    is_active?: boolean;
    course_id?: number;
    course?: {
        course_id: number;
        course_code: string;
        course_name: string;
    };
    positions?: Array<{
        position_id: number;
        title: string;
        category?: string;
        order_in_ballot: number;
        max_winners: number;
    }>;
    partylists?: Array<{
        partylist_id: number;
        name: string;
        description?: string;
        logo_url?: string;
        candidates_count?: number;
    }>;
    status?: string;
    is_ongoing?: boolean;
}

const COURSE_TO_DEPARTMENT: Record<string, string> = {
    BSIT: "CIT",
    BEED: "TED",
    BSBA: "CBA",
};

const REQUIRED_PROFILE_FIELDS: Array<{
    key: string;
    label: string;
    getValue: (user: any) => any;
}> = [
        { key: "first_name", label: "First Name", getValue: (u) => u?.first_name },
        { key: "last_name", label: "Last Name", getValue: (u) => u?.last_name },
        { key: "id_no", label: "Student ID", getValue: (u) => u?.id_no },
        { key: "course", label: "Course", getValue: (u) => u?.course },
        { key: "year_level", label: "Year Level", getValue: (u) => u?.year_level },
        { key: "birthdate", label: "Birthdate", getValue: (u) => u?.birthdate },
        { key: "age", label: "Age", getValue: (u) => u?.age },
        {
            key: "present_address",
            label: "Present Address",
            getValue: (u) => u?.present_address,
        },
        {
            key: "cellphone",
            label: "Cellphone Number",
            getValue: (u) => u?.cellphone,
        },
        {
            key: "no_unit_load",
            label: "Number of Unit Load",
            getValue: (u) => u?.no_unit_load,
        },
    ];

const ApplyCandidacy: React.FC = () => {
    const { electionId } = useParams<{ electionId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [election, setElection] = useState<Election | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (electionId) {
            fetchElection(electionId);
        } else {
            setError("No election selected");
            setLoading(false);
        }
    }, [electionId]);

    const fetchElection = async (id: string) => {
        setLoading(true);
        setError("");
        try {
            const response = await electionAPI.getById(parseInt(id));
            let electionData = null;
            if (response.data) {
                if (response.data.data) {
                    electionData = response.data.data;
                } else {
                    electionData = response.data;
                }
            }
            if (electionData) {
                setElection(electionData);
            } else {
                setError("Election not found");
            }
        } catch (err: any) {
            console.error("Failed to fetch election:", err);
            const errorMessage =
                err.response?.data?.message ||
                "Failed to load election. Please try again.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const missingFields = useMemo(() => {
        if (!user) return REQUIRED_PROFILE_FIELDS.map((f) => f.label);
        return REQUIRED_PROFILE_FIELDS.filter((field) => {
            const value = field.getValue(user);
            if (value === null || value === undefined) return true;
            if (typeof value === "string" && value.trim() === "") return true;
            return false;
        }).map((f) => f.label);
    }, [user]);

    const isProfileComplete = missingFields.length === 0;

    const departmentCheck = useMemo(() => {
        if (!user || !election) return { ok: true as const };

        if (election.election_type !== "SBO") {
            return { ok: true as const };
        }

        // ✅ Fallback: derive department from course.course_code when department is missing
        let electionDept = election.department || null;

        if (!electionDept && election.course?.course_code) {
            electionDept =
                COURSE_TO_DEPARTMENT[
                election.course.course_code.toUpperCase()
                ] ?? null;
        }

        // Get the user's department
        let userCourseCode = "";
        if (user.course) {
            if (
                typeof user.course === "object" &&
                "course_code" in user.course
            ) {
                userCourseCode = (user.course as any).course_code || "";
            } else if (typeof user.course === "string") {
                userCourseCode = user.course;
            }
        }

        const userDept =
            COURSE_TO_DEPARTMENT[userCourseCode.toUpperCase()] || null;

        // If we still cannot determine the election's department, allow
        if (!electionDept) {
            return { ok: true as const };
        }

        if (!userDept) {
            return {
                ok: false as const,
                userDept: "Unknown",
                electionDept,
                reason:
                    "We couldn't determine your department from your course. Please make sure your course is set correctly.",
            };
        }

        if (userDept !== electionDept) {
            return {
                ok: false as const,
                userDept,
                electionDept,
                reason: `This SBO election is for the ${electionDept} department. Your department is ${userDept}. You can only apply for candidacy in SBO elections that match your own department.`,
            };
        }

        return { ok: true as const };
    }, [user, election]);

    const handleSuccess = () => {
        setTimeout(() => {
            window.close();
        }, 2000);
    };

    const handleCancel = () => {
        window.close();
    };

    const handleGoToProfile = () => {
        navigate("/profile");
    };

    if (loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error || !election) {
        return (
            <div className="max-w-4xl mx-auto p-6 text-center">
                <div className="flex items-center justify-center mb-4">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Election Not Found
                </h2>
                <p className="text-gray-500 mb-4">
                    {error ||
                        "The election you're trying to apply for does not exist."}
                </p>
                <div className="flex gap-3 justify-center">
                    <Button onClick={() => window.close()} variant="outline">
                        Close
                    </Button>
                    <Button
                        onClick={() => navigate("/dashboard")}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        Go to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    if (!departmentCheck.ok) {
        return (
            <div className="max-w-3xl mx-auto py-8 px-4">
                <div className="flex items-center gap-4 mb-6">
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="rounded-xl"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Close
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Apply for Candidacy
                        </h1>
                        <p className="text-sm text-gray-500">
                            {election.title}
                        </p>
                    </div>
                </div>

                <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-red-500 to-rose-500 px-6 py-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <ShieldAlert className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    Department Mismatch
                                </h2>
                                <p className="text-rose-50 text-sm">
                                    You cannot apply for this SBO election
                                </p>
                            </div>
                        </div>
                    </div>

                    <CardContent className="p-6">
                        <Alert
                            variant="destructive"
                            className="rounded-xl mb-6"
                        >
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                {departmentCheck.reason}
                            </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <GraduationCap className="w-4 h-4 text-blue-600" />
                                    <p className="text-xs font-semibold text-blue-700 uppercase">
                                        Your Department
                                    </p>
                                </div>
                                <p className="text-3xl font-bold text-blue-700">
                                    {departmentCheck.userDept}
                                </p>
                            </div>
                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                                <div className="flex items-center justify-center gap-2 mb-1">
                                    <Building2 className="w-4 h-4 text-rose-600" />
                                    <p className="text-xs font-semibold text-rose-700 uppercase">
                                        Election Department
                                    </p>
                                </div>
                                <p className="text-3xl font-bold text-rose-700">
                                    {departmentCheck.electionDept}
                                </p>
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-amber-800 text-sm">
                                        Why is this restricted?
                                    </h4>
                                    <p className="text-sm text-amber-700 mt-1">
                                        SBO elections are organized by
                                        department. You can only run for
                                        candidacy in elections that match your
                                        own department so that the
                                        representation stays accurate.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={handleCancel}
                                className="rounded-xl"
                            >
                                Close
                            </Button>
                            <Button
                                onClick={() => navigate("/elections")}
                                className="bg-blue-600 hover:bg-blue-700 rounded-xl px-6"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Browse Eligible Elections
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!isProfileComplete) {
        return (
            <div className="max-w-3xl mx-auto py-8 px-4">
                <div className="flex items-center gap-4 mb-6">
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="rounded-xl"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Close
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Apply for Candidacy
                        </h1>
                        <p className="text-sm text-gray-500">
                            {election.title}
                        </p>
                    </div>
                </div>

                <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <ListChecks className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    Complete Your Profile First
                                </h2>
                                <p className="text-amber-50 text-sm">
                                    You need to fill in your personal
                                    information before applying as a candidate.
                                </p>
                            </div>
                        </div>
                    </div>

                    <CardContent className="p-6">
                        <Alert className="bg-amber-50 border-amber-200 rounded-xl mb-6">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800">
                                <p className="font-semibold mb-1">
                                    Missing Required Information
                                </p>
                                <p className="text-sm">
                                    The following fields must be completed in
                                    your profile:
                                </p>
                            </AlertDescription>
                        </Alert>

                        <div className="space-y-2 mb-6">
                            {REQUIRED_PROFILE_FIELDS.map((field) => {
                                const value = user
                                    ? field.getValue(user)
                                    : null;
                                const isMissing =
                                    value === null ||
                                    value === undefined ||
                                    (typeof value === "string" &&
                                        value.trim() === "");
                                return (
                                    <div
                                        key={field.key}
                                        className={`flex items-center gap-3 p-3 rounded-xl border ${isMissing
                                                ? "bg-red-50 border-red-200"
                                                : "bg-green-50 border-green-200"
                                            }`}
                                    >
                                        {isMissing ? (
                                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                        ) : (
                                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                        )}
                                        <span
                                            className={`text-sm font-medium ${isMissing
                                                    ? "text-red-700"
                                                    : "text-green-700"
                                                }`}
                                        >
                                            {field.label}
                                        </span>
                                        {isMissing && (
                                            <Badge className="ml-auto bg-red-100 text-red-700 border-0 text-xs">
                                                Missing
                                            </Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <UserCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-blue-800 text-sm">
                                        Why do we need this?
                                    </h4>
                                    <p className="text-sm text-blue-700 mt-1">
                                        Your personal information will appear
                                        on your official Certificate of
                                        Candidacy and recommendation letter.
                                        Please make sure everything is accurate.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={handleCancel}
                                className="rounded-xl"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleGoToProfile}
                                className="bg-blue-600 hover:bg-blue-700 rounded-xl px-6"
                            >
                                <UserCircle className="w-4 h-4 mr-2" />
                                Go to Profile Settings
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="flex items-center gap-4 mb-6">
                <Button variant="outline" onClick={handleCancel}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Close
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Apply for Candidacy
                    </h1>
                    <p className="text-sm text-gray-500">{election.title}</p>
                </div>
                <span className="ml-auto text-sm text-gray-400">
                    {new Date(election.voting_start).toLocaleDateString()} -{" "}
                    {new Date(election.voting_end).toLocaleDateString()}
                </span>
            </div>

            <CandidacyApplicationForm
                electionId={election.election_id}
                electionTitle={election.title}
                electionType={election.election_type}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
            />
        </div>
    );
};

export default ApplyCandidacy;