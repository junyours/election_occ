// resources/js/pages/Candidates/PartylistRequestManager.tsx
import React, { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { Input } from "../components/ui/input";
import { partylistAPI } from "../api/partylists";
import {
    Building2,
    Users,
    CheckCircle,
    XCircle,
    AlertCircle,
    Loader2,
    Clock,
    UserCheck,
    UserX,
    Search,
    Mail,
    GraduationCap,
    Shield,
    Filter,
    Award,
    CalendarDays,
    Info,
    RefreshCw,
} from "lucide-react";

interface MembershipRequest {
    membership_id: number;
    candidate_id: number;
    partylist_id: number;
    status: "pending" | "approved" | "rejected";
    created_at: string;
    requested_at?: string;

    candidate_name?: string;
    id_no?: string;
    email?: string;
    year_level?: number | null;
    position?: string;
    course?: {
        course_id: number;
        course_code: string;
        course_name: string;
    } | null;
    partylist_name?: string;
    election?: {
        election_id: number;
        title: string;
    } | null;

    candidate?: {
        candidate_id: number;
        user?: {
            user_id: number;
            first_name: string;
            last_name: string;
            email: string;
            id_no: string;
            year_level?: number;
            profile_photo?: string;
            course?: {
                course_code: string;
                course_name: string;
            };
        };
        position?: {
            position_id: number;
            title: string;
        };
    };
    partylist?: {
        partylist_id: number;
        name: string;
    };
}

const PartylistRequestManager: React.FC = () => {
    const [requests, setRequests] = useState<MembershipRequest[]>([]);
    const [filteredRequests, setFilteredRequests] = useState<
        MembershipRequest[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("pending");
    const [searchTerm, setSearchTerm] = useState("");
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    useEffect(() => {
        fetchRequests();
    }, []);

    useEffect(() => {
        filterRequests();
    }, [requests, statusFilter, searchTerm]);

    const fetchRequests = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await partylistAPI.getMembershipRequests();
            const data = response.data?.data ?? response.data ?? [];
            setRequests(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error("Failed to fetch requests:", err);
            setError(
                err.response?.data?.message ||
                err.response?.data?.error ||
                "Failed to load membership requests",
            );
            setRequests([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filterRequests = () => {
        let filtered = [...requests];

        if (statusFilter !== "all") {
            filtered = filtered.filter((r) => r.status === statusFilter);
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter((req) => {
                const name =
                    req.candidate_name ||
                    `${req.candidate?.user?.first_name || ""} ${req.candidate?.user?.last_name || ""}`.trim();
                const studentId =
                    req.id_no || req.candidate?.user?.id_no || "";
                const partylistName =
                    req.partylist_name || req.partylist?.name || "";

                return (
                    name.toLowerCase().includes(term) ||
                    studentId.toLowerCase().includes(term) ||
                    partylistName.toLowerCase().includes(term)
                );
            });
        }

        setFilteredRequests(filtered);
    };

    const handleProcess = async (
        membershipId: number,
        action: "approve" | "reject",
    ) => {
        setActionLoading(membershipId);
        setError("");
        setSuccess("");

        try {
            const response =
                action === "approve"
                    ? await partylistAPI.approveMembership(membershipId)
                    : await partylistAPI.rejectMembership(membershipId);

            if (response.data?.success === false) {
                throw new Error(
                    response.data?.message ||
                    `Failed to ${action} membership request`,
                );
            }

            setSuccess(
                action === "approve"
                    ? "Membership request approved successfully!"
                    : "Membership request rejected.",
            );

            await fetchRequests();
            setTimeout(() => setSuccess(""), 3000);
        } catch (err: any) {
            const data = err.response?.data;
            setError(
                data?.message ||
                data?.error ||
                err.message ||
                `Failed to ${action} membership request`,
            );
            if (data?.debug) console.error("Backend debug:", data.debug);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchRequests();
    };

    // ============================================================
    // HELPERS
    // ============================================================
    const getStatusBadge = (status: string) => {
        const config: Record<
            string,
            { label: string; color: string; icon: React.ElementType }
        > = {
            pending: {
                label: "Pending",
                color: "bg-yellow-100 text-yellow-800 border-yellow-200",
                icon: Clock,
            },
            approved: {
                label: "Approved",
                color: "bg-green-100 text-green-800 border-green-200",
                icon: CheckCircle,
            },
            rejected: {
                label: "Rejected",
                color: "bg-red-100 text-red-800 border-red-200",
                icon: XCircle,
            },
        };
        return config[status] || config.pending;
    };

    const getName = (req: MembershipRequest): string => {
        if (req.candidate_name) return req.candidate_name;
        const u = req.candidate?.user;
        if (u) return `${u.first_name || ""} ${u.last_name || ""}`.trim();
        return "Unknown";
    };

    const getInitials = (req: MembershipRequest): string => {
        if (req.candidate_name) {
            const parts = req.candidate_name.split(" ").filter(Boolean);
            return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase();
        }
        const u = req.candidate?.user;
        if (u) {
            return `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`.toUpperCase();
        }
        return "?";
    };

    const getEmail = (req: MembershipRequest): string =>
        req.email || req.candidate?.user?.email || "—";

    const getStudentId = (req: MembershipRequest): string =>
        req.id_no || req.candidate?.user?.id_no || "—";

    const getCourseCode = (req: MembershipRequest): string => {
        if (req.course?.course_code) return req.course.course_code;
        if (req.candidate?.user?.course?.course_code)
            return req.candidate.user.course.course_code;
        return "—";
    };

    const getYearLevel = (req: MembershipRequest): string => {
        const year =
            req.year_level ?? req.candidate?.user?.year_level ?? null;
        return year ? `Year ${year}` : "—";
    };

    const getPosition = (req: MembershipRequest): string => {
        if (req.position) return req.position;
        return req.candidate?.position?.title || "—";
    };

    const getPhotoUrl = (req: MembershipRequest): string | undefined => {
        const photo = req.candidate?.user?.profile_photo;
        if (!photo) return undefined;
        if (photo.startsWith("http")) return photo;
        if (photo.startsWith("/storage")) return photo;
        return `http://localhost:8000${photo}`;
    };

    // ============================================================
    // STATS
    // ============================================================
    const stats = {
        total: requests.length,
        pending: requests.filter((r) => r.status === "pending").length,
        approved: requests.filter((r) => r.status === "approved").length,
        rejected: requests.filter((r) => r.status === "rejected").length,
    };

    // ============================================================
    // LOADING
    // ============================================================
    if (loading && !requests.length) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">
                        Loading requests...
                    </p>
                </div>
            </div>
        );
    }

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="relative rounded-2xl overflow-hidden bg-blue-600 shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="relative px-6 py-8">
                    <div className="flex justify-between items-start flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Building2 className="w-5 h-5 text-yellow-300" />
                                <Badge className="bg-white/20 text-white border-0">
                                    Membership Requests
                                </Badge>
                            </div>
                            <h1 className="text-3xl font-bold text-white">
                                Partylist Membership Requests
                            </h1>
                            <p className="text-blue-100 mt-1">
                                Review and manage membership requests for your
                                partylist
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl"
                        >
                            <RefreshCw
                                className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                            />
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            {/* Success / Error */}
            {success && (
                <Alert className="bg-green-50 border-green-200 rounded-xl animate-in fade-in duration-300">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                        {success}
                    </AlertDescription>
                </Alert>
            )}
            {error && (
                <Alert
                    variant="destructive"
                    className="rounded-xl animate-in fade-in duration-300"
                >
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Stats Pills */}
            <div className="flex flex-wrap items-center gap-3 py-1">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">
                        Total
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                        {stats.total}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-full">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-700">
                        Pending
                    </span>
                    <span className="text-sm font-bold text-yellow-800">
                        {stats.pending}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                    <UserCheck className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
                        Approved
                    </span>
                    <span className="text-sm font-bold text-green-800">
                        {stats.approved}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-full">
                    <UserX className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">
                        Rejected
                    </span>
                    <span className="text-sm font-bold text-red-800">
                        {stats.rejected}
                    </span>
                </div>
            </div>

            {/* Filters */}
            <Card className="border-0 shadow-lg rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b">
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-blue-600" />
                        Filters
                    </CardTitle>
                </div>
                <CardContent className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Status
                            </label>
                            <Select
                                value={statusFilter}
                                onValueChange={setStatusFilter}
                            >
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Status
                                    </SelectItem>
                                    <SelectItem value="pending">
                                        Pending
                                    </SelectItem>
                                    <SelectItem value="approved">
                                        Approved
                                    </SelectItem>
                                    <SelectItem value="rejected">
                                        Rejected
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Search
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    placeholder="Search by name or partylist..."
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
                                    className="pl-10 rounded-xl bg-gray-50"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* LIST VIEW — Table */}
            {filteredRequests.length === 0 ? (
                <Card className="border-0 shadow-lg rounded-xl">
                    <CardContent className="text-center py-16">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                            No Membership Requests
                        </h3>
                        <p className="text-gray-500">
                            {statusFilter !== "all"
                                ? `No ${statusFilter} membership requests found`
                                : searchTerm
                                    ? `No requests matching "${searchTerm}"`
                                    : "No membership requests found"}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-0 shadow-lg rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Candidate
                                    </th>
                                    <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Course & Year
                                    </th>
                                    <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Position
                                    </th>
                                    <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Partylist
                                    </th>
                                    <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Requested
                                    </th>
                                    <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="text-right p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredRequests.map((request) => {
                                    const status = getStatusBadge(
                                        request.status,
                                    );
                                    const StatusIcon = status.icon;
                                    const isLoading =
                                        actionLoading ===
                                        request.membership_id;
                                    const photoUrl = getPhotoUrl(request);

                                    return (
                                        <tr
                                            key={request.membership_id}
                                            className="hover:bg-blue-50/30 transition-colors"
                                        >
                                            {/* Candidate */}
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="w-10 h-10 ring-2 ring-blue-100 flex-shrink-0">
                                                        <AvatarImage
                                                            src={photoUrl}
                                                            alt={getName(
                                                                request,
                                                            )}
                                                        />
                                                        <AvatarFallback className="bg-blue-500 text-white text-xs font-bold">
                                                            {getInitials(
                                                                request,
                                                            )}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 truncate">
                                                            {getName(request)}
                                                        </p>
                                                        <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                                                            <Mail className="w-3 h-3" />
                                                            {getEmail(request)}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 font-mono">
                                                            ID:{" "}
                                                            {getStudentId(
                                                                request,
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Course & Year */}
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5 text-gray-700">
                                                    <GraduationCap className="w-4 h-4 text-gray-400" />
                                                    <span className="font-medium">
                                                        {getCourseCode(
                                                            request,
                                                        )}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {getYearLevel(request)}
                                                </p>
                                            </td>

                                            {/* Position */}
                                            <td className="p-4">
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                                >
                                                    <Award className="w-3 h-3 mr-1" />
                                                    {getPosition(request)}
                                                </Badge>
                                            </td>

                                            {/* Partylist */}
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5 text-gray-700">
                                                    <Building2 className="w-4 h-4 text-purple-500" />
                                                    <span className="truncate">
                                                        {request.partylist_name ||
                                                            request.partylist
                                                                ?.name ||
                                                            "—"}
                                                    </span>
                                                </div>
                                                {request.election && (
                                                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                                        <CalendarDays className="w-3 h-3" />
                                                        {request.election.title}
                                                    </p>
                                                )}
                                            </td>

                                            {/* Requested At */}
                                            <td className="p-4">
                                                <p className="text-xs text-gray-600">
                                                    {new Date(
                                                        request.requested_at ||
                                                        request.created_at,
                                                    ).toLocaleDateString()}
                                                </p>
                                                <p className="text-[10px] text-gray-400">
                                                    {new Date(
                                                        request.requested_at ||
                                                        request.created_at,
                                                    ).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                            </td>

                                            {/* Status */}
                                            <td className="p-4">
                                                <Badge
                                                    className={`${status.color} border flex items-center gap-1 w-fit`}
                                                >
                                                    <StatusIcon className="w-3 h-3" />
                                                    {status.label}
                                                </Badge>
                                            </td>

                                            {/* Actions */}
                                            <td className="p-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    {request.status ===
                                                        "pending" ? (
                                                        <>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleProcess(
                                                                        request.membership_id,
                                                                        "reject",
                                                                    )
                                                                }
                                                                disabled={
                                                                    isLoading
                                                                }
                                                                className="border-red-200 text-red-600 hover:bg-red-50 rounded-lg h-8 px-3 text-xs"
                                                            >
                                                                {isLoading ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <XCircle className="w-3.5 h-3.5 mr-1" />
                                                                        Reject
                                                                    </>
                                                                )}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleProcess(
                                                                        request.membership_id,
                                                                        "approve",
                                                                    )
                                                                }
                                                                disabled={
                                                                    isLoading
                                                                }
                                                                className="bg-green-600 hover:bg-green-700 rounded-lg h-8 px-3 text-xs"
                                                            >
                                                                {isLoading ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                                                        Approve
                                                                    </>
                                                                )}
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">
                                                            No action needed
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer summary */}
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                        <span>
                            Showing{" "}
                            <strong className="text-gray-700">
                                {filteredRequests.length}
                            </strong>{" "}
                            of{" "}
                            <strong className="text-gray-700">
                                {requests.length}
                            </strong>{" "}
                            requests
                        </span>
                        {statusFilter !== "all" && (
                            <span>
                                Filtered by status:{" "}
                                <strong className="text-gray-700 capitalize">
                                    {statusFilter}
                                </strong>
                            </span>
                        )}
                    </div>
                </Card>
            )}

            {/* Info Card */}
            <Card className="bg-blue-50 border border-blue-100 rounded-2xl">
                <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Info className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-blue-900 mb-1">
                                About Membership Requests
                            </h4>
                            <ul className="text-sm text-blue-800 space-y-1">
                                <li>
                                    • Candidates from lower positions can
                                    request to join your partylist
                                </li>
                                <li>
                                    • Approving adds them to your partylist as
                                    a member
                                </li>
                                <li>
                                    • Rejecting removes the request — they can
                                    request again later
                                </li>
                                <li>
                                    • You'll receive a notification each time a
                                    candidate applies
                                </li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PartylistRequestManager;