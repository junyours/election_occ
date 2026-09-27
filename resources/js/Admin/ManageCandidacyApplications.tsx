// resources/js/pages/Admin/ManageCandidacyApplications.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { candidacyAPI, CandidacyApplication } from "../api/candidacy";
import { electionAPI } from "../api/elections";
import axiosBlob from "../api/axios";
import {
    Users,
    CheckCircle,
    XCircle,
    Loader2,
    RefreshCw,
    Eye,
    FileText,
    Download,
    UserCheck,
    Clock,
    AlertCircle,
    Search,
    Filter,
    Printer,
    X,
} from "lucide-react";

interface Election {
    election_id: number;
    title: string;
}

type DetailTab = "pdf" | "details";

const ManageCandidacyApplications: React.FC = () => {
    const [applications, setApplications] = useState<CandidacyApplication[]>(
        [],
    );
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedApp, setSelectedApp] = useState<CandidacyApplication | null>(
        null,
    );
    const [detailOpen, setDetailOpen] = useState(false);
    const [remarks, setRemarks] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>("pending");
    const [electionFilter, setElectionFilter] = useState<string>("all");
    const [elections, setElections] = useState<Election[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [error, setError] = useState("");
    const [detailTab, setDetailTab] = useState<DetailTab>("pdf");
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    useEffect(() => {
        fetchElections();
    }, []);

    useEffect(() => {
        fetchApplications();
    }, [statusFilter, electionFilter]);

    const fetchElections = async () => {
        try {
            const response = await electionAPI.getAll();
            setElections(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error("Failed to fetch elections:", error);
        }
    };

    const fetchApplications = async () => {
        setLoading(true);
        setError("");
        try {
            const params: any = {};
            if (statusFilter !== "all") params.status = statusFilter;
            if (electionFilter !== "all")
                params.election_id = parseInt(electionFilter);

            const response = await candidacyAPI.adminGetApplications(params);

            let applicationsData: CandidacyApplication[] = [];

            if (Array.isArray(response.data)) {
                applicationsData = response.data;
            } else if (response.data && typeof response.data === "object") {
                if (response.data.data && Array.isArray(response.data.data)) {
                    applicationsData = response.data.data;
                } else if (
                    response.data.data &&
                    response.data.data.data &&
                    Array.isArray(response.data.data.data)
                ) {
                    applicationsData = response.data.data.data;
                }
            }

            setApplications(applicationsData);
        } catch (error: any) {
            console.error("Failed to fetch applications:", error);
            setError(
                error.response?.data?.message || "Failed to load applications",
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchApplications();
    };

    const loadPlatformPdf = async (applicationId: number) => {
        setPdfLoading(true);
        if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
        }

        try {
            const token = localStorage.getItem("access_token");
            const API_URL =
                import.meta.env.VITE_API_URL ||
                "http://localhost:8000/api/web";

            // Cache-bust so the browser never serves a stale 304 with an
            // empty body.
            const res = await fetch(
                `${API_URL}/admin/candidacy/${applicationId}/platform-pdf?t=${Date.now()}`,
                {
                    cache: "no-store",
                    headers: {
                        Accept:
                            "application/pdf, application/octet-stream, */*",
                        ...(token
                            ? { Authorization: `Bearer ${token}` }
                            : {}),
                    },
                },
            );

            if (!res.ok) {
                let message = `Request failed (${res.status})`;
                try {
                    const text = await res.text();
                    try {
                        const json = JSON.parse(text);
                        message = json.message || json.error || message;
                    } catch {
                        /* not JSON */
                    }
                } catch {
                    /* ignore */
                }
                throw new Error(message);
            }

            const blob = await res.blob();

            // If the body is 0 bytes AND the status was 304-ish, refetch
            // without any cache. Otherwise, treat as genuine empty.
            if (blob.size === 0) {
                throw new Error(
                    "The server returned an empty PDF. Try closing and reopening this dialog.",
                );
            }

            // If it's actually JSON, surface the error
            if (blob.type.includes("json")) {
                const text = await blob.text();
                let message = "Failed to load platform PDF.";
                try {
                    const json = JSON.parse(text);
                    message = json.message || json.error || message;
                } catch {
                    /* ignore */
                }
                throw new Error(message);
            }

            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
        } catch (err: any) {
            console.error("Platform PDF load failed:", err);
            setError(err.message || "Failed to load platform PDF");
        } finally {
            setPdfLoading(false);
        }
    };

    const handleViewDetail = (app: CandidacyApplication) => {
        setSelectedApp(app);
        setRemarks("");
        setDetailTab("pdf");
        setDetailOpen(true);
        loadPlatformPdf(app.application_id);
    };

    const handleCloseDetail = () => {
        setDetailOpen(false);
        setSelectedApp(null);
        if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
        }
    };

    const handleDownloadPlatform = () => {
        if (!pdfUrl || !selectedApp) return;
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.download = `candidacy_platform_${selectedApp.application_id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const handleApprove = async () => {
        if (!selectedApp) return;
        setActionLoading(true);
        try {
            await candidacyAPI.adminApprove(
                selectedApp.application_id,
                remarks,
            );
            handleCloseDetail();
            fetchApplications();
        } catch (error: any) {
            setError(
                error.response?.data?.message ||
                "Failed to approve application",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedApp) return;
        setActionLoading(true);
        try {
            await candidacyAPI.adminReject(selectedApp.application_id, remarks);
            handleCloseDetail();
            fetchApplications();
        } catch (error: any) {
            setError(
                error.response?.data?.message || "Failed to reject application",
            );
        } finally {
            setActionLoading(false);
        }
    };

    const handleDownloadLetter = async (app: CandidacyApplication) => {
        try {
            const blob = await candidacyAPI.downloadRecommendationLetter(
                app.application_id,
            );

            if (!blob || !(blob instanceof Blob)) {
                throw new Error("Invalid file received");
            }

            if (blob.size === 0) {
                throw new Error("File is empty");
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `recommendation_letter_${app.user?.first_name}_${app.user?.last_name}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();

            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch (error: any) {
            console.error("Failed to download letter:", error);
            alert(
                error.message ||
                "Failed to download recommendation letter. Please try again.",
            );
        }
    };

    const getStatusBadge = (status: string) => {
        const config: Record<string, { label: string; color: string }> = {
            pending: {
                label: "Pending",
                color: "bg-yellow-100 text-yellow-800",
            },
            approved: {
                label: "Approved ✅",
                color: "bg-green-100 text-green-800",
            },
            rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
        };
        return config[status] || config.pending;
    };

    const filteredApplications = useMemo(() => {
        if (!searchTerm) return applications;
        const search = searchTerm.toLowerCase();
        return applications.filter((app) => {
            const name =
                `${app.user?.first_name || ""} ${app.user?.last_name || ""}`.toLowerCase();
            const studentId = app.user?.student_id?.toLowerCase() || "";
            return name.includes(search) || studentId.includes(search);
        });
    }, [applications, searchTerm]);

    if (loading && !applications.length) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Candidacy Applications
                    </h1>
                    <p className="text-gray-600">
                        Review and approve/reject candidacy applications from
                        students
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={refreshing}
                >
                    <RefreshCw
                        className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                    />
                    Refresh
                </Button>
            </div>

            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4 flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <span className="text-red-600">{error}</span>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label>Status</Label>
                            <select
                                className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value)
                                }
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                        <div>
                            <Label>Election</Label>
                            <select
                                className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={electionFilter}
                                onChange={(e) =>
                                    setElectionFilter(e.target.value)
                                }
                            >
                                <option value="all">All Elections</option>
                                {elections.map((e) => (
                                    <option
                                        key={e.election_id}
                                        value={e.election_id}
                                    >
                                        {e.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label>Search</Label>
                            <div className="relative mt-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search by name or student ID..."
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats pills */}
            <div className="flex flex-wrap items-center gap-3 py-1">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">
                        Total
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                        {applications.length}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-full">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-700">
                        Pending
                    </span>
                    <span className="text-sm font-bold text-yellow-800">
                        {
                            applications.filter(
                                (a) => a.admin_status === "pending",
                            ).length
                        }
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                    <UserCheck className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
                        Approved
                    </span>
                    <span className="text-sm font-bold text-green-800">
                        {
                            applications.filter(
                                (a) => a.admin_status === "approved",
                            ).length
                        }
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-full">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">
                        Rejected
                    </span>
                    <span className="text-sm font-bold text-red-800">
                        {
                            applications.filter(
                                (a) => a.admin_status === "rejected",
                            ).length
                        }
                    </span>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>
                        Applications ({filteredApplications.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredApplications.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No applications found</p>
                            <p className="text-sm mt-1">
                                Try adjusting your filters
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-3 text-left">
                                            Applicant
                                        </th>
                                        <th className="p-3 text-left">
                                            Student ID
                                        </th>
                                        <th className="p-3 text-left">
                                            Course
                                        </th>
                                        <th className="p-3 text-left">
                                            Election
                                        </th>
                                        <th className="p-3 text-left">
                                            Status
                                        </th>
                                        <th className="p-3 text-left">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredApplications.map((app) => {
                                        const adminStatus = getStatusBadge(
                                            app.admin_status,
                                        );
                                        return (
                                            <tr
                                                key={app.application_id}
                                                className="border-t hover:bg-gray-50"
                                            >
                                                <td className="p-3 font-medium">
                                                    {app.user?.first_name}{" "}
                                                    {app.user?.last_name}
                                                </td>
                                                <td className="p-3 font-mono text-xs">
                                                    {app.user?.student_id}
                                                </td>
                                                <td className="p-3">
                                                    {app.form_data?.course ||
                                                        "N/A"}
                                                </td>
                                                <td className="p-3">
                                                    {app.election?.title ||
                                                        "N/A"}
                                                </td>
                                                <td className="p-3">
                                                    <Badge
                                                        className={
                                                            adminStatus.color
                                                        }
                                                    >
                                                        {adminStatus.label}
                                                    </Badge>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex gap-2 flex-wrap">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleViewDetail(
                                                                    app,
                                                                )
                                                            }
                                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        >
                                                            <Eye className="w-4 h-4 mr-1" />
                                                            View
                                                        </Button>
                                                        {app.admin_status ===
                                                            "approved" &&
                                                            !app.letter_generated && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleDownloadLetter(
                                                                            app,
                                                                        )
                                                                    }
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ============================ */}
            {/* Detail / Review Dialog       */}
            {/* ============================ */}
            <Dialog
                open={detailOpen}
                onOpenChange={(open) => {
                    if (!open) handleCloseDetail();
                }}
            >
                <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden p-0 gap-0">
                    {/* Dialog header */}
                    <DialogHeader className="px-6 py-4 border-b bg-gray-50">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                                    {selectedApp?.user?.first_name?.[0]}
                                    {selectedApp?.user?.last_name?.[0]}
                                </div>
                                <div>
                                    <DialogTitle className="text-lg font-bold">
                                        {selectedApp?.user?.first_name}{" "}
                                        {selectedApp?.user?.last_name}
                                    </DialogTitle>
                                    <p className="text-sm text-gray-500">
                                        {selectedApp?.user?.student_id} ·{" "}
                                        {selectedApp?.election?.title}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedApp && (
                                    <Badge
                                        className={
                                            getStatusBadge(
                                                selectedApp.admin_status,
                                            ).color
                                        }
                                    >
                                        {
                                            getStatusBadge(
                                                selectedApp.admin_status,
                                            ).label
                                        }
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-2 mt-3">
                            <button
                                type="button"
                                onClick={() => setDetailTab("pdf")}
                                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${detailTab === "pdf"
                                    ? "bg-blue-600 text-white"
                                    : "text-gray-600 hover:bg-gray-100"
                                    }`}
                            >
                                <FileText className="w-3.5 h-3.5 inline mr-1.5" />
                                Platform PDF
                            </button>
                            <button
                                type="button"
                                onClick={() => setDetailTab("details")}
                                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${detailTab === "details"
                                    ? "bg-blue-600 text-white"
                                    : "text-gray-600 hover:bg-gray-100"
                                    }`}
                            >
                                <Users className="w-3.5 h-3.5 inline mr-1.5" />
                                Form Details
                            </button>

                            {/* PDF actions */}
                            <div className="ml-auto flex items-center gap-2">
                                {pdfUrl && (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleDownloadPlatform}
                                        >
                                            <Download className="w-4 h-4 mr-1" />
                                            Download
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                pdfUrl &&
                                                window.open(
                                                    pdfUrl,
                                                    "_blank",
                                                    "noopener,noreferrer",
                                                )
                                            }
                                        >
                                            <Printer className="w-4 h-4 mr-1" />
                                            Open
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Body */}
                    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-0 h-[70vh]">
                        {/* LEFT: PDF or Form details */}
                        <div className="border-r overflow-hidden bg-gray-100">
                            {detailTab === "pdf" ? (
                                <div className="w-full h-full relative">
                                    {pdfLoading ? (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                                            <p className="text-sm">
                                                Loading platform PDF…
                                            </p>
                                        </div>
                                    ) : pdfUrl ? (
                                        <iframe
                                            title="Candidacy Platform"
                                            src={pdfUrl}
                                            className="w-full h-full bg-white"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-500 px-6 text-center">
                                            <AlertCircle className="w-10 h-10 text-gray-300 mb-3" />
                                            <p className="text-sm">
                                                No platform PDF available for
                                                this application.
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                This can happen for older
                                                applications that were
                                                submitted before PDF
                                                generation was enabled.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full h-full overflow-y-auto p-6 bg-white">
                                    {selectedApp && (
                                        <FormDetails app={selectedApp} />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Review panel */}
                        <div className="flex flex-col h-full overflow-hidden bg-white">
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                                        <UserCheck className="w-4 h-4 text-blue-600" />
                                        Review Summary
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <InfoRow
                                            label="Position"
                                            value={
                                                selectedApp?.form_data
                                                    ?.selectedPosition
                                            }
                                        />
                                        <InfoRow
                                            label="Organization"
                                            value={
                                                selectedApp?.form_data
                                                    ?.positionCSG
                                                    ? "Central Student Government"
                                                    : selectedApp?.form_data
                                                        ?.positionSC
                                                        ? "Student Council"
                                                        : "—"
                                            }
                                        />
                                        <InfoRow
                                            label="Course"
                                            value={
                                                selectedApp?.form_data?.course
                                            }
                                        />
                                        <InfoRow
                                            label="Year Level"
                                            value={
                                                selectedApp?.form_data
                                                    ?.currentYear
                                            }
                                        />
                                        <InfoRow
                                            label="Submitted"
                                            value={
                                                selectedApp
                                                    ? new Date(
                                                        selectedApp.created_at,
                                                    ).toLocaleString()
                                                    : "—"
                                            }
                                        />
                                    </div>
                                </div>

                                {selectedApp?.admin_status === "pending" && (
                                    <div>
                                        <Label className="text-sm font-semibold">
                                            Remarks (Optional)
                                        </Label>
                                        <Textarea
                                            placeholder="Add remarks for the applicant..."
                                            value={remarks}
                                            onChange={(e) =>
                                                setRemarks(e.target.value)
                                            }
                                            rows={4}
                                            className="mt-1.5 resize-none"
                                        />
                                    </div>
                                )}

                                {selectedApp?.admin_remarks && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                                        <p className="text-xs font-semibold text-blue-800 mb-1">
                                            Previous Remarks
                                        </p>
                                        <p className="text-sm text-blue-700">
                                            {selectedApp.admin_remarks}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Action bar */}
                            <div className="border-t p-4 bg-gray-50">
                                {selectedApp?.admin_status === "pending" ? (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="destructive"
                                            className="flex-1"
                                            onClick={handleReject}
                                            disabled={actionLoading}
                                        >
                                            {actionLoading ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <XCircle className="w-4 h-4 mr-2" />
                                            )}
                                            Reject
                                        </Button>
                                        <Button
                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                            onClick={handleApprove}
                                            disabled={actionLoading}
                                        >
                                            {actionLoading ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <CheckCircle className="w-4 h-4 mr-2" />
                                            )}
                                            Approve
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex justify-end">
                                        <Button
                                            variant="outline"
                                            onClick={handleCloseDetail}
                                        >
                                            <X className="w-4 h-4 mr-2" />
                                            Close
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// ---------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------
const InfoRow: React.FC<{ label: string; value?: string | null }> = ({
    label,
    value,
}) => (
    <div className="flex justify-between items-start gap-3 py-1.5 border-b border-gray-100 last:border-0">
        <span className="text-gray-500">{label}</span>
        <span className="font-medium text-gray-800 text-right">
            {value || "—"}
        </span>
    </div>
);

const FormDetails: React.FC<{ app: CandidacyApplication }> = ({ app }) => {
    const f = app.form_data || {};
    return (
        <div className="space-y-6">
            <section>
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3">
                    Applicant Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <Field label="First Name" value={f.firstName} />
                    <Field label="Last Name" value={f.lastName} />
                    <Field label="Middle Initial" value={f.middleInitial} />
                    <Field label="Age" value={f.age} />
                    <Field label="Course" value={f.course} />
                    <Field label="Year Level" value={f.currentYear} />
                    <Field label="Student No." value={f.studentNo} />
                    <Field label="No. Unit Load" value={f.noUnitLoad} />
                    <Field label="Cellphone" value={f.cellphone} />
                    <Field label="Social Media" value={f.socialMedia} />
                    <Field
                        label="Present Address"
                        value={f.presentAddress}
                        span={2}
                    />
                    <Field
                        label="Present Address 2"
                        value={f.presentAddress2}
                        span={2}
                    />
                </div>
            </section>

            <section>
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3">
                    Position Applied For
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <Field
                        label="Organization"
                        value={
                            f.positionCSG
                                ? "Central Student Government"
                                : f.positionSC
                                    ? "Student Council"
                                    : "—"
                        }
                    />
                    <Field label="Position" value={f.selectedPosition} />
                </div>
            </section>

            <section>
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3">
                    Political Party
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <Field
                        label="Affiliation Type"
                        value={
                            f.partyIndependent
                                ? "Independent"
                                : f.partyCreate
                                    ? "New Partylist"
                                    : f.partyExisting
                                        ? "Existing Partylist"
                                        : "—"
                        }
                    />
                    <Field
                        label="Partylist Name"
                        value={
                            f.partyCreate
                                ? f.newPartyName
                                : f.partyExisting
                                    ? f.politicalParty
                                    : "—"
                        }
                    />
                </div>
            </section>

            <section>
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3">
                    Present Affiliations
                </h4>
                <div className="space-y-2 text-sm">
                    {[1, 2, 3].map((n) => {
                        const org = f[`aff${n}Org`];
                        const pos = f[`aff${n}Pos`];
                        const date = f[`aff${n}Date`];
                        if (!org && !pos && !date) return null;
                        return (
                            <div
                                key={n}
                                className="p-2 bg-gray-50 rounded-lg"
                            >
                                <p className="font-medium text-gray-800">
                                    {org || "—"}
                                </p>
                                <p className="text-gray-500 text-xs">
                                    {pos || "—"}
                                    {date ? ` · ${date}` : ""}
                                </p>
                            </div>
                        );
                    })}
                    {![1, 2, 3].some((n) => f[`aff${n}Org`]) && (
                        <p className="text-gray-400 italic">
                            No affiliations provided
                        </p>
                    )}
                </div>
            </section>

            <section>
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3">
                    Campaign Platform
                </h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                    {f.platform || "Not provided"}
                </p>
            </section>

            <section>
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3">
                    Qualifications
                </h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                    {f.qualifications || "Not provided"}
                </p>
            </section>
        </div>
    );
};

const Field: React.FC<{
    label: string;
    value?: string | number | null;
    span?: number;
}> = ({ label, value, span = 1 }) => (
    <div className={span === 2 ? "md:col-span-2" : ""}>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-medium text-gray-800">{value || "—"}</p>
    </div>
);

export default ManageCandidacyApplications;