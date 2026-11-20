// resources/js/pages/Admin/VoterManagement.tsx
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Alert, AlertDescription } from "../components/ui/alert";
import { CardHeader } from "../components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { adminAPI } from "../api/admin";
import { courseAPI } from "../api/courses";
import { RefreshButton } from "../components/common/RefreshButton";
import {
    Users,
    Search,
    Loader2,
    Download,
    AlertCircle,
    Filter,
    School,
    ChevronLeft,
    ChevronRight,
    Upload,
    FileSpreadsheet,
    CheckCircle,
    X,
    XCircle,
    Download as DownloadIcon,
    ChevronDown,
    ChevronUp,
    UserCheck,
    UserX,
} from "lucide-react";

interface Course {
    course_id: number;
    course_code: string;
    course_name: string;
}

interface Voter {
    user_id: number;
    id_no: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    is_active: boolean;
    course:
        | string
        | { course_code: string; course_name: string; course_id: number }
        | null;
    year_level: number;
    has_voted?: boolean;
}

interface ImportProgress {
    status: "running" | "completed" | "failed";
    processed: number;
    total: number;
    imported: number;
    updated: number;
    deactivated: number;
    failed: number;
    percent: number;
    message: string;
}

interface ImportResult {
    imported_count: number;
    updated_count: number;
    deactivated_count: number;
    skipped_count: number;
    skipped_rows: string[];
}

type StatusFilter = "all" | "active" | "inactive" | "voted" | "not_voted";

const ACCEPTED_EXTENSIONS = [".xlsx", ".csv", ".xls"];
const MAX_SIZE_MB = 20;
const POLL_INTERVAL_MS = 1500;

const VoterManagement: React.FC = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [voters, setVoters] = useState<Voter[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedCourse, setSelectedCourse] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalVoters, setTotalVoters] = useState(0);
    const [activeCount, setActiveCount] = useState(0);
    const [inactiveCount, setInactiveCount] = useState(0);

    const [voterToToggle, setVoterToToggle] = useState<Voter | null>(null);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    // Import panel
    const [importExpanded, setImportExpanded] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importError, setImportError] = useState("");
    const [importProgress, setImportProgress] = useState<ImportProgress | null>(
        null,
    );
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [importPolling, setImportPolling] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const unmountedRef = useRef(false);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(t);
    }, [searchTerm]);

    useEffect(() => setCurrentPage(1), [selectedCourse, statusFilter]);

    useEffect(() => {
        fetchVoters();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, perPage, debouncedSearch, selectedCourse, statusFilter]);

    useEffect(() => {
        unmountedRef.current = false;
        fetchCourses();
        return () => {
            unmountedRef.current = true;
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
    }, []);

    // ✅ Resume an import that is already running (page refresh, second tab,
    // or another admin started it)
    useEffect(() => {
        (async () => {
            try {
                const res = await adminAPI.getActiveImport();
                const d = res.data?.data ?? res.data;
                if (d?.active && d.import_id) {
                    setImportExpanded(true);
                    setImportPolling(true);
                    if (d.progress) setImportProgress(d.progress);
                    pollProgress(d.import_id);
                }
            } catch (e) {
                console.error("Active import check failed:", e);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchCourses = async () => {
        try {
            const response = await courseAPI.getAll();
            setCourses(response.data || []);
        } catch (error) {
            console.error("Failed to fetch courses:", error);
        }
    };

    const fetchVoters = async () => {
        setLoading(true);
        setRefreshing(true);
        setError("");
        try {
            const response = await adminAPI.getVoters({
                page: currentPage,
                per_page: perPage,
                search: debouncedSearch || undefined,
                course: selectedCourse !== "all" ? selectedCourse : undefined,
                status: statusFilter !== "all" ? statusFilter : undefined,
            });
            const payload = response.data?.data || response.data;
            const votersData = payload?.voters || [];
            setVoters(votersData);
            setTotalVoters(payload?.total_voters || votersData.length);
            setActiveCount(payload?.active_count ?? 0);
            setInactiveCount(payload?.inactive_count ?? 0);
            setCurrentPage(payload?.current_page ?? 1);
            setTotalPages(payload?.last_page ?? 1);
        } catch (err: any) {
            console.error("Failed to fetch voters:", err);
            setError(err.response?.data?.message || "Failed to load voters");
            setVoters([]);
            setTotalVoters(0);
            setActiveCount(0);
            setInactiveCount(0);
            setTotalPages(1);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // ------------------------------------------------------------
    // Import handlers
    // ------------------------------------------------------------
    const validateFile = (file: File): string | null => {
        const name = file.name.toLowerCase();
        if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
            return "Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file.";
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            return `File is too large. Maximum size is ${MAX_SIZE_MB}MB.`;
        }
        return null;
    };

    const applyFile = (file: File | null | undefined) => {
        // ✅ Block selecting a new file while an import is running
        if (importPolling) return;
        if (!file) return;
        const err = validateFile(file);
        if (err) {
            setImportError(err);
            setImportFile(null);
            return;
        }
        setImportFile(file);
        setImportError("");
        setImportResult(null);
        setImportProgress(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        applyFile(e.target.files?.[0]);
        e.target.value = "";
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        applyFile(e.dataTransfer.files?.[0]);
    };

    const pollProgress = async (id: string) => {
        if (unmountedRef.current) return;
        try {
            const res = await adminAPI.getImportProgress(id);
            const payload = res.data?.data ?? res.data;
            const progress = payload?.progress as ImportProgress | undefined;
            let result = payload?.result as ImportResult | undefined;

            if (progress) setImportProgress(progress);

            if (progress?.status === "completed") {
                // Fall back to the progress counters if the result cache is missing
                result = result ?? {
                    imported_count: progress.imported ?? 0,
                    updated_count: progress.updated ?? 0,
                    deactivated_count: progress.deactivated ?? 0,
                    skipped_count: progress.failed ?? 0,
                    skipped_rows: [],
                };
                setImportResult(result);
                setImportPolling(false);
                setImportFile(null);
                fetchVoters();
                return;
            }

            if (progress?.status === "failed") {
                setImportPolling(false);
                setImportError(progress.message || "Import failed");
                return;
            }

            pollTimerRef.current = setTimeout(
                () => pollProgress(id),
                POLL_INTERVAL_MS,
            );
        } catch (err: any) {
            console.error("Poll failed:", err);
            setImportPolling(false);
            setImportError(
                err.response?.data?.message || "Lost track of the import",
            );
        }
    };

    const handleStartImport = async () => {
        // ✅ Hard guard against double-click / re-entry
        if (importPolling) return;

        if (!importFile) {
            setImportError("Please select a file first.");
            return;
        }
        setImportError("");
        setImportResult(null);
        setImportProgress(null);
        setImportPolling(true);

        try {
            const formData = new FormData();
            formData.append("file", importFile);

            const res = await adminAPI.importVoters(formData);
            const id = res.data?.import_id ?? res.data?.data?.import_id;
            if (!id) throw new Error("Server did not return an import id");

            // Show the bar right away
            setImportProgress({
                status: "running",
                processed: 0,
                total: 0,
                imported: 0,
                updated: 0,
                deactivated: 0,
                failed: 0,
                percent: 0,
                message: "Queued, waiting to start…",
            });

            pollProgress(id);
        } catch (err: any) {
            console.error("Import start failed:", err);

            // ✅ Server says another import is already running → attach to it
            if (err.response?.status === 409) {
                const activeId = err.response.data?.import_id;
                setImportError(
                    err.response.data?.message ||
                        "An import is already running.",
                );
                if (activeId) {
                    setImportPolling(true);
                    pollProgress(activeId);
                } else {
                    setImportPolling(false);
                }
                return;
            }

            setImportError(
                err.response?.data?.message ||
                    err.message ||
                    "Failed to queue import",
            );
            setImportPolling(false);
        }
    };

    const clearImport = () => {
        if (importPolling) return;
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        setImportFile(null);
        setImportError("");
        setImportProgress(null);
        setImportResult(null);
        setImportPolling(false);
    };

    const downloadTemplate = () => {
        const headers = [
            "ID Number",
            "Last Name",
            "First Name",
            "Middle Name",
            "Email",
            "Department",
        ];
        const sampleRows = [
            "2024-1-06462,ABA,MAGEL,ACOSTA,ABAMAGEL33@GMAIL.COM,CBA",
            "2024-1-06332,ABALDE,IAN MARK,JAMIS,occ.abalde.ianmark@gmail.com,CIT",
            "2025-1-07618,ABEJO,KENT JUSHUA,FRIAS,occ.abejo.kentjushua08@gmail.com,TED",
        ];
        const csv = [headers.join(","), ...sampleRows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "voter_import_template.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    // ------------------------------------------------------------
    // Voter display helpers
    // ------------------------------------------------------------
    const getCourseDisplay = (voter: Voter): string => {
        if (!voter.course) return "N/A";
        if (typeof voter.course === "object" && voter.course.course_code)
            return voter.course.course_code;
        if (typeof voter.course === "string") return voter.course;
        return "N/A";
    };

    const getFullName = (voter: Voter): string => {
        const last = (voter.last_name || "").trim();
        const first = (voter.first_name || "").trim();
        if (!last && !first) return "-";
        if (!last) return first;
        if (!first) return last;
        return `${last}, ${first}`;
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case "admin":
                return {
                    label: "Admin",
                    color: "bg-purple-100 text-purple-700 border border-purple-200",
                };
            case "comelec":
                return {
                    label: "COMELEC",
                    color: "bg-blue-100 text-blue-700 border border-blue-200",
                };
            case "candidate":
                return {
                    label: "Candidate",
                    color: "bg-green-100 text-green-700 border border-green-200",
                };
            default:
                return {
                    label: "Voter",
                    color: "bg-gray-100 text-gray-700 border border-gray-200",
                };
        }
    };

    const handleToggleVoterStatus = async () => {
        if (!voterToToggle) return;
        setUpdatingStatus(true);
        try {
            await adminAPI.setVoterStatus(
                voterToToggle.user_id,
                !voterToToggle.is_active,
            );
            setStatusDialogOpen(false);
            setVoterToToggle(null);
            fetchVoters();
        } catch (err: any) {
            alert(
                err.response?.data?.message || "Failed to update voter status",
            );
        } finally {
            setUpdatingStatus(false);
        }
    };

    const clearFilters = () => {
        setSearchTerm("");
        setSelectedCourse("all");
        setStatusFilter("all");
    };

    const exportToCSV = () => {
        if (voters.length === 0) return;
        const headers = [
            "Student ID",
            "Name",
            "Email",
            "Role",
            "Status",
            "Course",
            "Year Level",
        ];
        const csvRows = [
            headers.join(","),
            ...voters.map((v) =>
                [
                    `"${v.id_no || ""}"`,
                    `"${getFullName(v)}"`,
                    `"${v.email || ""}"`,
                    `"${v.role || "voter"}"`,
                    `"${v.is_active ? "Active" : "Inactive"}"`,
                    `"${getCourseDisplay(v)}"`,
                    `"${v.year_level || ""}"`,
                ].join(","),
            ),
        ];
        const blob = new Blob([csvRows.join("\n")], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `voters_page${currentPage}_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getVisiblePages = (): number[] => {
        const pages: number[] = [];
        const total = totalPages;
        const current = currentPage;
        if (total <= 5) for (let i = 1; i <= total; i++) pages.push(i);
        else if (current <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
        else if (current >= total - 2)
            for (let i = total - 4; i <= total; i++) pages.push(i);
        else for (let i = current - 2; i <= current + 2; i++) pages.push(i);
        return pages;
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return (
        <div className="space-y-6">
            {/* HEADER — with always-visible Import button */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Voter Management
                    </h1>
                    <p className="text-gray-600">
                        View, filter, import, and manage all registered voters
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {/* ✅ IMPORT BUTTON — always visible */}
                    <Button
                        onClick={() => {
                            setImportExpanded(true);
                            // Scroll into view after expand
                            setTimeout(() => {
                                document
                                    .getElementById("import-panel")
                                    ?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start",
                                    });
                            }, 50);
                        }}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {importPolling ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4 mr-2" />
                        )}
                        {importPolling
                            ? `Importing… ${importProgress?.percent ?? 0}%`
                            : "Import Voters"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={exportToCSV}
                        disabled={voters.length === 0}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                    <RefreshButton
                        onClick={fetchVoters}
                        isLoading={refreshing}
                    />
                </div>
            </div>

            {/* IMPORT PANEL (collapsible) */}
            <Card
                id="import-panel"
                className="border-0 shadow-lg rounded-xl overflow-hidden"
            >
                <button
                    type="button"
                    onClick={() => setImportExpanded((v) => !v)}
                    className="w-full bg-blue-600 hover:bg-blue-700 transition-colors px-6 py-4 flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                            <Upload className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-lg font-bold text-white">
                                Import Voters
                            </h2>
                            <p className="text-xs text-blue-100">
                                Bulk upload voters from an Excel or CSV file
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-white">
                        {importPolling && (
                            <Badge className="bg-yellow-400 text-yellow-900 border-0">
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Importing
                            </Badge>
                        )}
                        {importExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                        ) : (
                            <ChevronDown className="w-5 h-5" />
                        )}
                    </div>
                </button>

                {importPolling && !importExpanded && (
                    <div className="px-6 py-2 bg-blue-50">
                        <div className="w-full bg-white rounded-full h-2 border border-gray-200 overflow-hidden">
                            <div
                                className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                                style={{
                                    width: `${importProgress?.percent ?? 0}%`,
                                }}
                            />
                        </div>
                    </div>
                )}

                {importExpanded && (
                    <CardContent className="p-6 space-y-4">
                        {/* Warning about the sync behavior */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <div className="flex items-start gap-2 text-sm text-amber-800">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <p>
                                    <strong>Full sync:</strong> every voter in
                                    the system that is not in this upload will
                                    be marked <strong>inactive</strong>. Voters
                                    that appear in this upload will be marked{" "}
                                    <strong>active</strong>.
                                </p>
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <FileSpreadsheet className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 text-sm text-blue-800">
                                    <p className="font-semibold mb-1">
                                        Required columns
                                    </p>
                                    <p className="text-blue-700">
                                        <code className="bg-white px-1 rounded text-xs">
                                            ID Number, Last Name, First Name,
                                            Middle Name, Email, Department
                                        </code>
                                    </p>
                                    <p className="text-blue-700 mt-1">
                                        Department codes:{" "}
                                        <Badge className="bg-blue-100 text-blue-700 border-0 mx-1">
                                            CIT
                                        </Badge>
                                        <Badge className="bg-green-100 text-green-700 border-0 mx-1">
                                            CBA
                                        </Badge>
                                        <Badge className="bg-purple-100 text-purple-700 border-0 mx-1">
                                            TED
                                        </Badge>
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={downloadTemplate}
                                        className="mt-3 border-blue-300 text-blue-700 hover:bg-blue-100"
                                    >
                                        <DownloadIcon className="w-4 h-4 mr-2" />
                                        Download Template
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Progress */}
                        {importProgress && (
                            <div
                                className={`rounded-xl border p-4 ${
                                    importProgress.status === "failed"
                                        ? "bg-red-50 border-red-200"
                                        : importProgress.status === "completed"
                                          ? "bg-green-50 border-green-200"
                                          : "bg-yellow-50 border-yellow-200"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {importProgress.status ===
                                            "running" && (
                                            <Loader2 className="w-4 h-4 text-yellow-600 animate-spin" />
                                        )}
                                        {importProgress.status ===
                                            "completed" && (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                        )}
                                        {importProgress.status === "failed" && (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                        )}
                                        <span
                                            className={`text-sm font-semibold ${
                                                importProgress.status ===
                                                "failed"
                                                    ? "text-red-800"
                                                    : importProgress.status ===
                                                        "completed"
                                                      ? "text-green-800"
                                                      : "text-yellow-800"
                                            }`}
                                        >
                                            {importProgress.message}
                                        </span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-700">
                                        {importProgress.percent ?? 0}%
                                    </span>
                                </div>

                                <div className="w-full bg-white rounded-full h-3 overflow-hidden border border-gray-200">
                                    <div
                                        className={`h-3 rounded-full transition-all duration-500 ${
                                            importProgress.status === "failed"
                                                ? "bg-red-500"
                                                : importProgress.status ===
                                                    "completed"
                                                  ? "bg-green-500"
                                                  : "bg-blue-500"
                                        }`}
                                        style={{
                                            width: `${importProgress.percent ?? 0}%`,
                                        }}
                                    />
                                </div>

                                {importProgress.status === "running" &&
                                    importProgress.total > 0 && (
                                        <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-600 mt-2">
                                            <span>
                                                {importProgress.processed} of{" "}
                                                {importProgress.total} rows
                                            </span>
                                            <span>
                                                {importProgress.imported} new,{" "}
                                                {importProgress.updated}{" "}
                                                updated,{" "}
                                                {importProgress.deactivated ??
                                                    0}{" "}
                                                deactivated,{" "}
                                                {importProgress.failed} skipped
                                            </span>
                                        </div>
                                    )}
                            </div>
                        )}

                        {/* Final result */}
                        {importResult && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    <p className="font-semibold text-green-800">
                                        Import complete
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge className="bg-blue-100 text-blue-700 border-0">
                                        {importResult.imported_count} new
                                    </Badge>
                                    <Badge className="bg-yellow-100 text-yellow-700 border-0">
                                        {importResult.updated_count} updated
                                    </Badge>
                                    <Badge className="bg-orange-100 text-orange-700 border-0">
                                        {importResult.deactivated_count}{" "}
                                        deactivated
                                    </Badge>
                                    <Badge className="bg-red-100 text-red-700 border-0">
                                        {importResult.skipped_count} skipped
                                    </Badge>
                                </div>
                                {importResult.skipped_rows?.length > 0 && (
                                    <details className="mt-3 text-sm">
                                        <summary className="cursor-pointer text-gray-700 font-medium">
                                            View skipped rows (
                                            {importResult.skipped_rows.length})
                                        </summary>
                                        <div className="mt-2 max-h-40 overflow-y-auto bg-white rounded p-2 border">
                                            {importResult.skipped_rows.map(
                                                (msg, i) => (
                                                    <p
                                                        key={i}
                                                        className="text-xs text-gray-600 py-0.5 border-b last:border-0"
                                                    >
                                                        {msg}
                                                    </p>
                                                ),
                                            )}
                                        </div>
                                    </details>
                                )}
                            </div>
                        )}

                        {importError && (
                            <Alert variant="destructive" className="rounded-xl">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    {importError}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Drop zone */}
                        {!importPolling && !importResult && (
                            <div
                                onDragEnter={handleDragEnter}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                role="button"
                                tabIndex={0}
                                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                                    isDragging
                                        ? "border-blue-500 bg-blue-50 scale-[1.01]"
                                        : "border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50"
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={ACCEPTED_EXTENSIONS.join(",")}
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <FileSpreadsheet
                                    className={`w-10 h-10 mx-auto mb-2 ${
                                        isDragging
                                            ? "text-blue-500"
                                            : "text-gray-400"
                                    }`}
                                />
                                {isDragging ? (
                                    <p className="text-blue-600 font-semibold">
                                        Drop file to upload
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-gray-700 font-medium">
                                            Drag and drop your file here
                                        </p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            or{" "}
                                            <span className="text-blue-600 font-semibold underline">
                                                click to browse
                                            </span>
                                        </p>
                                        <p className="text-xs text-gray-400 mt-2">
                                            Supported: .xlsx, .xls, .csv — up to{" "}
                                            {MAX_SIZE_MB}MB
                                        </p>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Selected file chip */}
                        {importFile && !importPolling && (
                            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 text-sm truncate">
                                        {importFile.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {formatSize(importFile.size)} • ready to
                                        import
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setImportFile(null)}
                                    className="p-1.5 rounded-lg hover:bg-green-100 text-gray-500 hover:text-red-500"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                            <Button
                                onClick={handleStartImport}
                                disabled={!importFile || importPolling}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {importPolling ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Importing…
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Start Import
                                    </>
                                )}
                            </Button>
                            {(importFile ||
                                importProgress ||
                                importResult ||
                                importError) && (
                                <Button
                                    variant="outline"
                                    onClick={clearImport}
                                    disabled={importPolling}
                                    className="rounded-xl"
                                >
                                    Clear
                                </Button>
                            )}
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* ERROR */}
            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4 flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <span className="text-red-600">{error}</span>
                    </CardContent>
                </Card>
            )}

            {/* STATS */}
            <div className="flex flex-wrap items-center gap-3 py-1">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">
                        Total
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                        {totalVoters}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                    <UserCheck className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
                        Active
                    </span>
                    <span className="text-sm font-bold text-green-800">
                        {activeCount}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-full">
                    <UserX className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">
                        Inactive
                    </span>
                    <span className="text-sm font-bold text-red-800">
                        {inactiveCount}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-full">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-600">
                        Page
                    </span>
                    <span className="text-sm font-bold text-gray-700">
                        {currentPage} / {totalPages}
                    </span>
                </div>
            </div>

            {/* FILTERS */}
            <Card>
                <CardContent className="p-4">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Filter className="w-5 h-5 text-gray-500" />
                            <h3 className="font-semibold text-gray-700">
                                Filters
                            </h3>
                            {(searchTerm ||
                                selectedCourse !== "all" ||
                                statusFilter !== "all") && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    Clear all filters
                                </Button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    placeholder="Search by name, ID, email..."
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
                                    className="pl-10"
                                />
                            </div>
                            <div className="relative">
                                <School className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <select
                                    className="w-full pl-10 pr-8 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                                    value={selectedCourse}
                                    onChange={(e) =>
                                        setSelectedCourse(e.target.value)
                                    }
                                >
                                    <option value="all">All Courses</option>
                                    {courses.map((course) => (
                                        <option
                                            key={course.course_id}
                                            value={course.course_code}
                                        >
                                            {course.course_code}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <select
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    value={statusFilter}
                                    onChange={(e) =>
                                        setStatusFilter(
                                            e.target.value as StatusFilter,
                                        )
                                    }
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active only</option>
                                    <option value="inactive">
                                        Inactive only
                                    </option>
                                    <option value="voted">Voted</option>
                                    <option value="not_voted">Not voted</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* VOTER LIST */}
            <Card>
                <CardHeader>
                    <CardTitle>Voter List ({totalVoters} total)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-3 text-left">
                                        Student ID
                                    </th>
                                    <th className="p-3 text-left">Name</th>
                                    <th className="p-3 text-left">Email</th>
                                    <th className="p-3 text-left">Role</th>
                                    <th className="p-3 text-left">Status</th>
                                    <th className="p-3 text-left">Course</th>
                                    <th className="p-3 text-left">Year</th>
                                    <th className="p-3 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {voters.length > 0 ? (
                                    voters.map((voter) => {
                                        const roleBadge = getRoleBadge(
                                            voter.role,
                                        );
                                        return (
                                            <tr
                                                key={voter.user_id}
                                                className="border-t hover:bg-gray-50"
                                            >
                                                <td className="p-3 font-mono">
                                                    {voter.id_no || "-"}
                                                </td>
                                                <td className="p-3 font-medium">
                                                    {getFullName(voter)}
                                                </td>
                                                <td className="p-3">
                                                    {voter.email || "-"}
                                                </td>
                                                <td className="p-3">
                                                    <Badge
                                                        className={
                                                            roleBadge.color
                                                        }
                                                    >
                                                        {roleBadge.label}
                                                    </Badge>
                                                </td>
                                                <td className="p-3">
                                                    {voter.is_active ? (
                                                        <Badge className="bg-green-100 text-green-700 border border-green-200">
                                                            <UserCheck className="w-3 h-3 mr-1" />
                                                            Active
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-red-100 text-red-700 border border-red-200">
                                                            <UserX className="w-3 h-3 mr-1" />
                                                            Inactive
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    {getCourseDisplay(voter)}
                                                </td>
                                                <td className="p-3">
                                                    {voter.year_level
                                                        ? `Year ${voter.year_level}`
                                                        : "-"}
                                                </td>
                                                <td className="p-3">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className={
                                                            voter.is_active
                                                                ? "text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50"
                                                                : "text-green-600 border-green-200 hover:text-green-700 hover:bg-green-50"
                                                        }
                                                        onClick={() => {
                                                            setVoterToToggle(
                                                                voter,
                                                            );
                                                            setStatusDialogOpen(
                                                                true,
                                                            );
                                                        }}
                                                    >
                                                        {voter.is_active
                                                            ? "Set Inactive"
                                                            : "Set Active"}
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={8}
                                            className="p-8 text-center text-gray-500"
                                        >
                                            {loading ? (
                                                <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
                                            ) : (
                                                <>
                                                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                                    <p>
                                                        No voters found matching
                                                        your filters
                                                    </p>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Show:</span>
                            <select
                                value={perPage}
                                onChange={(e) => {
                                    setPerPage(parseInt(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-3 py-1.5 border rounded-lg text-sm bg-white"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span className="text-sm text-gray-500 ml-2">
                                {(currentPage - 1) * perPage + 1}–
                                {Math.min(currentPage * perPage, totalVoters)}{" "}
                                of {totalVoters}
                            </span>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.max(1, p - 1),
                                        )
                                    }
                                    disabled={currentPage === 1}
                                    className="rounded-xl"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>

                                {getVisiblePages().map((pageNum) => (
                                    <Button
                                        key={pageNum}
                                        variant={
                                            currentPage === pageNum
                                                ? "default"
                                                : "outline"
                                        }
                                        size="sm"
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`min-w-[36px] rounded-xl ${
                                            currentPage === pageNum
                                                ? "bg-blue-600"
                                                : ""
                                        }`}
                                    >
                                        {pageNum}
                                    </Button>
                                ))}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.min(totalPages, p + 1),
                                        )
                                    }
                                    disabled={currentPage === totalPages}
                                    className="rounded-xl"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Activate / deactivate voter dialog */}
            <AlertDialog
                open={statusDialogOpen}
                onOpenChange={setStatusDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {voterToToggle?.is_active
                                ? "Set Voter Inactive"
                                : "Set Voter Active"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to set{" "}
                            <span className="font-semibold">
                                {voterToToggle
                                    ? getFullName(voterToToggle)
                                    : ""}
                            </span>{" "}
                            as {voterToToggle?.is_active ? "inactive" : "active"}
                            ?{" "}
                            {voterToToggle?.is_active
                                ? "They will no longer be eligible to vote."
                                : "They will be eligible to vote again."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleToggleVoterStatus}
                            disabled={updatingStatus}
                            className={
                                voterToToggle?.is_active
                                    ? "bg-red-600 hover:bg-red-700"
                                    : "bg-green-600 hover:bg-green-700"
                            }
                        >
                            {updatingStatus && (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            )}
                            {voterToToggle?.is_active
                                ? "Set Inactive"
                                : "Set Active"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default VoterManagement;