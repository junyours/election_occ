// resources/js/pages/Admin/ElectionRecords.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
    Loader2,
    RefreshCw,
    Eye,
    Calendar,
    Users,
    Vote,
    TrendingUp,
    FolderOpen,
    ChevronLeft,
    ChevronRight,
    FileSpreadsheet,
    FileJson,
    X,
    AlertCircle,
    CheckCircle,
} from "lucide-react";
import {
    electionRecordsAPI,
    ElectionRecord,
    YearlyStats,
    ElectionRecordDetail,
} from "../api/electionRecords";
import { format } from "date-fns";

const ElectionRecords: React.FC = () => {
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [selectedElection, setSelectedElection] =
        useState<ElectionRecordDetail | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [exporting, setExporting] = useState<number | "year" | null>(null);
    const [exportError, setExportError] = useState("");
    const [exportSuccess, setExportSuccess] = useState("");
    const itemsPerPage = 10;
    const queryClient = useQueryClient();

    // ---------- queries (same as before) ----------
    const yearsQuery = useQuery({
        queryKey: ["records-years"],
        queryFn: async () => {
            const response = await electionRecordsAPI.getYears();
            const raw =
                response.data && "data" in (response.data as any)
                    ? (response.data as any).data
                    : response.data;
            const arr = Array.isArray(raw) ? raw : [];
            return arr
                .map((y) => (typeof y === "string" ? parseInt(y, 10) : y))
                .filter((y): y is number => Number.isFinite(y));
        },
    });

    const statsQuery = useQuery({
        queryKey: ["records-stats"],
        queryFn: async () => {
            const response = await electionRecordsAPI.getYearlyStats();
            const raw =
                response.data && "data" in (response.data as any)
                    ? (response.data as any).data
                    : response.data;
            return Array.isArray(raw) ? raw : [];
        },
    });

    const recordsQuery = useQuery({
        queryKey: ["records-year", selectedYear],
        queryFn: async () => {
            if (!selectedYear) return null;
            const response =
                await electionRecordsAPI.getYearRecords(selectedYear);
            const raw =
                response.data && "data" in (response.data as any)
                    ? (response.data as any).data
                    : response.data;
            return raw ?? null;
        },
        enabled: !!selectedYear,
    });

    const detailQuery = useQuery({
        queryKey: ["records-election", selectedElection?.election_id],
        queryFn: async () => {
            if (!selectedElection) return null;
            const response = await electionRecordsAPI.getElectionDetail(
                selectedElection.election_id,
            );
            const raw =
                response.data && "data" in (response.data as any)
                    ? (response.data as any).data
                    : response.data;
            return raw ?? null;
        },
        enabled: !!selectedElection,
        retry: 1,
    });

    useEffect(() => {
        if (yearsQuery.data && yearsQuery.data.length > 0 && !selectedYear) {
            setSelectedYear(yearsQuery.data[0]);
        }
    }, [yearsQuery.data, selectedYear]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedYear]);

    useEffect(() => {
        if (!exportSuccess && !exportError) return;
        const t = setTimeout(() => {
            setExportSuccess("");
            setExportError("");
        }, 5000);
        return () => clearTimeout(t);
    }, [exportSuccess, exportError]);

    // ---------- helpers ----------
    const getStatusBadge = (status: string) => {
        const config: Record<string, { label: string; color: string }> = {
            upcoming: {
                label: "Upcoming",
                color: "bg-yellow-100 text-yellow-800",
            },
            ongoing: {
                label: "Ongoing",
                color: "bg-green-100 text-green-800",
            },
            ended: { label: "Ended", color: "bg-gray-100 text-gray-800" },
        };
        return config[status] || config.ended;
    };

    /**
     * ✅ The definitive download handler.
     *    - Validates the blob is real (not an error payload)
     *    - Triggers the browser download synchronously
     */
    const downloadBlob = useCallback((blob: Blob, filename: string) => {
        if (!(blob instanceof Blob) || blob.size === 0) {
            throw new Error("Empty file received from server");
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();

        // Clean up on the next tick so Chrome/Firefox have committed the click
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 200);
    }, []);

    /**
     * ✅ Read a blob as text and pull out any error message the backend
     *    might have embedded (JSON or HTML).
     */
    const extractBlobError = async (blob: Blob): Promise<string> => {
        try {
            const text = await blob.text();
            try {
                const json = JSON.parse(text);
                return (
                    json.message ||
                    json.error ||
                    `HTTP error (${json.status || "unknown"})`
                );
            } catch {
                // Not JSON — probably HTML or raw text
                const stripped = text.replace(/<[^>]*>/g, "").trim();
                return stripped.slice(0, 200) || "Unknown server error";
            }
        } catch {
            return "Unknown server error";
        }
    };

    /**
     * ✅ Validate a download response before saving it.
     *    Throws a user-friendly error if it's actually an error body.
     */
    const validateBlob = async (
        blob: Blob,
        expectFormat: "csv" | "pdf",
    ): Promise<void> => {
        if (!(blob instanceof Blob)) {
            throw new Error("Server did not return a file");
        }
        if (blob.size === 0) {
            throw new Error("Server returned an empty file");
        }

        const type = (blob.type || "").toLowerCase();

        // If the server lied and returned JSON/HTML, surface the error.
        if (type.includes("json") || type.includes("html")) {
            throw new Error(await extractBlobError(blob));
        }

        // Optional: sanity-check the format matches what we requested
        if (expectFormat === "pdf") {
            const head = await blob.slice(0, 4).text();
            if (!head.startsWith("%PDF")) {
                throw new Error(
                    "Server did not return a valid PDF. Try again or contact support.",
                );
            }
        }
    };

    // ---------- actions ----------
    const handleViewDetail = (election: ElectionRecord) => {
        setSelectedElection({
            ...election,
            positions: [],
            voters_list: [],
            partylists: [],
            timeline: [],
        } as ElectionRecordDetail);
        setDetailOpen(true);
    };

    const handleCloseDetail = () => {
        setDetailOpen(false);
        setSelectedElection(null);
    };

    const handleExportYear = async (format: "csv" | "pdf") => {
        if (!selectedYear) return;
        setExporting("year");
        setExportError("");
        setExportSuccess("");

        try {
            const blob = await electionRecordsAPI.exportYearRecords(
                selectedYear,
                format,
            );

            await validateBlob(blob, format);

            const filename = `election_records_${selectedYear}.${format}`;
            downloadBlob(blob, filename);
            setExportSuccess(`✓ ${filename} downloaded`);
        } catch (error: any) {
            console.error("Year export failed:", error);
            const msg =
                error?.response?.data?.message ||
                error?.message ||
                "Failed to export year records";
            setExportError(msg);
        } finally {
            setExporting(null);
        }
    };

    const handleExportElection = async (
        electionId: number,
        format: "csv" | "pdf",
        title = "election",
    ) => {
        setExporting(electionId);
        setExportError("");
        setExportSuccess("");

        try {
            const blob = await electionRecordsAPI.exportElection(
                electionId,
                format,
            );

            await validateBlob(blob, format);

            const safeTitle = String(title)
                .replace(/[^a-z0-9_-]+/gi, "_")
                .replace(/^_+|_+$/g, "")
                .substring(0, 40) || "election";

            const filename = `${safeTitle}_${electionId}.${format}`;
            downloadBlob(blob, filename);
            setExportSuccess(`✓ ${filename} downloaded`);
        } catch (error: any) {
            console.error("Election export failed:", error);
            const msg =
                error?.response?.data?.message ||
                error?.message ||
                "Failed to export election";
            setExportError(msg);
        } finally {
            setExporting(null);
        }
    };

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["records-years"] });
        queryClient.invalidateQueries({ queryKey: ["records-stats"] });
        if (selectedYear) {
            queryClient.invalidateQueries({
                queryKey: ["records-year", selectedYear],
            });
        }
        if (selectedElection) {
            queryClient.invalidateQueries({
                queryKey: ["records-election", selectedElection.election_id],
            });
        }
    };

    // ---------- pagination ----------
    const getPaginationData = () => {
        if (!recordsQuery.data?.elections)
            return { paginated: [], totalPages: 0 };
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return {
            paginated: recordsQuery.data.elections.slice(start, end),
            totalPages: Math.ceil(
                recordsQuery.data.elections.length / itemsPerPage,
            ),
        };
    };

    const { paginated, totalPages } = getPaginationData();

    const isLoading =
        yearsQuery.isLoading || statsQuery.isLoading || recordsQuery.isLoading;

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Election Records
                    </h1>
                    <p className="text-gray-600">
                        View and manage historical election records
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleRefresh}>
                        <RefreshCw
                            className={`w-4 h-4 mr-2 ${
                                yearsQuery.isFetching ||
                                statsQuery.isFetching ||
                                recordsQuery.isFetching
                                    ? "animate-spin"
                                    : ""
                            }`}
                        />
                        Refresh
                    </Button>
                    {selectedYear && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => handleExportYear("csv")}
                                disabled={exporting === "year"}
                            >
                                {exporting === "year" ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                                )}
                                Export CSV
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleExportYear("pdf")}
                                disabled={exporting === "year"}
                            >
                                {exporting === "year" ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <FileJson className="w-4 h-4 mr-2" />
                                )}
                                Export PDF
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Toasts */}
            {exportSuccess && (
                <Alert className="bg-green-50 border-green-200 rounded-xl">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                        {exportSuccess}
                    </AlertDescription>
                </Alert>
            )}
            {exportError && (
                <Alert variant="destructive" className="rounded-xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{exportError}</AlertDescription>
                </Alert>
            )}

            {/* Year Selector */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Select Year
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {yearsQuery.data?.map((year) => (
                            <Button
                                key={year}
                                variant={
                                    selectedYear === year
                                        ? "default"
                                        : "outline"
                                }
                                className={
                                    selectedYear === year
                                        ? "bg-blue-600"
                                        : ""
                                }
                                onClick={() => setSelectedYear(year)}
                            >
                                {year}
                            </Button>
                        ))}
                        {yearsQuery.data?.length === 0 && (
                            <p className="text-gray-500">No records found</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Stats */}
            {statsQuery.data && selectedYear && (
                <div className="flex flex-wrap items-center gap-3 py-1">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
                        <FolderOpen className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-600">
                            Elections
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                            {recordsQuery.data?.total_elections || 0}
                        </span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                        <Users className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                            Voters
                        </span>
                        <span className="text-sm font-bold text-green-800">
                            {recordsQuery.data?.total_voters || 0}
                        </span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-full">
                        <Vote className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-700">
                            Votes Cast
                        </span>
                        <span className="text-sm font-bold text-purple-800">
                            {recordsQuery.data?.total_votes_cast || 0}
                        </span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
                        <TrendingUp className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-700">
                            Avg Turnout
                        </span>
                        <span className="text-sm font-bold text-amber-800">
                            {recordsQuery.data?.avg_turnout || 0}%
                        </span>
                    </div>
                </div>
            )}

            {/* Yearly Stats */}
            {statsQuery.data && statsQuery.data.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Yearly Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-3 text-left">Year</th>
                                        <th className="p-3 text-left">
                                            Elections
                                        </th>
                                        <th className="p-3 text-left">CSG</th>
                                        <th className="p-3 text-left">SBO</th>
                                        <th className="p-3 text-left">
                                            Total Voters
                                        </th>
                                        <th className="p-3 text-left">
                                            Votes Cast
                                        </th>
                                        <th className="p-3 text-left">
                                            Avg Turnout
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {statsQuery.data.map((stat: YearlyStats) => (
                                        <tr
                                            key={stat.year}
                                            className="border-t hover:bg-gray-50 cursor-pointer"
                                            onClick={() =>
                                                setSelectedYear(stat.year)
                                            }
                                        >
                                            <td className="p-3 font-semibold">
                                                {stat.year}
                                            </td>
                                            <td className="p-3">
                                                {stat.elections_count}
                                            </td>
                                            <td className="p-3">
                                                {stat.csg_count}
                                            </td>
                                            <td className="p-3">
                                                {stat.sbo_count}
                                            </td>
                                            <td className="p-3">
                                                {stat.total_voters}
                                            </td>
                                            <td className="p-3">
                                                {stat.total_votes_cast}
                                            </td>
                                            <td className="p-3 font-semibold text-green-600">
                                                {stat.avg_turnout}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Elections Table */}
            {recordsQuery.data && recordsQuery.data.elections && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>
                                Elections ({recordsQuery.data.elections.length})
                            </span>
                            <span className="text-sm font-normal text-gray-500">
                                Showing {paginated.length} of{" "}
                                {recordsQuery.data.elections.length}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-3 text-left">Title</th>
                                        <th className="p-3 text-left">Type</th>
                                        <th className="p-3 text-left">
                                            Status
                                        </th>
                                        <th className="p-3 text-left">
                                            Candidates
                                        </th>
                                        <th className="p-3 text-left">
                                            Voters
                                        </th>
                                        <th className="p-3 text-left">
                                            Turnout
                                        </th>
                                        <th className="p-3 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((election: ElectionRecord) => {
                                        const status = getStatusBadge(
                                            election.status,
                                        );
                                        const isExporting =
                                            exporting === election.election_id;

                                        return (
                                            <tr
                                                key={election.election_id}
                                                className="border-t hover:bg-gray-50"
                                            >
                                                <td className="p-3 font-medium">
                                                    {election.title}
                                                    {election.course && (
                                                        <span className="text-xs text-gray-500 block">
                                                            {
                                                                election.course
                                                                    .course_code
                                                            }
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <Badge variant="outline">
                                                        {election.election_type}
                                                    </Badge>
                                                </td>
                                                <td className="p-3">
                                                    <Badge
                                                        className={status.color}
                                                    >
                                                        {status.label}
                                                    </Badge>
                                                </td>
                                                <td className="p-3">
                                                    {election.candidates_count}
                                                </td>
                                                <td className="p-3">
                                                    {election.voters_voted} /{" "}
                                                    {election.voters_total}
                                                </td>
                                                <td className="p-3 font-semibold">
                                                    {
                                                        election.turnout_percentage
                                                    }
                                                    %
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() =>
                                                                handleViewDetail(
                                                                    election,
                                                                )
                                                            }
                                                            className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            View
                                                        </button>

                                                        {election.has_results && (
                                                            <>
                                                                <button
                                                                    onClick={() =>
                                                                        handleExportElection(
                                                                            election.election_id,
                                                                            "csv",
                                                                            election.title,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        isExporting
                                                                    }
                                                                    className="text-sm font-bold text-green-600 hover:text-green-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    {isExporting ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                                                    )}
                                                                    CSV
                                                                </button>

                                                                <button
                                                                    onClick={() =>
                                                                        handleExportElection(
                                                                            election.election_id,
                                                                            "pdf",
                                                                            election.title,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        isExporting
                                                                    }
                                                                    className="text-sm font-bold text-red-600 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    {isExporting ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <FileJson className="w-3.5 h-3.5" />
                                                                    )}
                                                                    PDF
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {paginated.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="p-8 text-center text-gray-500"
                                            >
                                                No elections found for this year
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-between items-center mt-4 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.max(1, p - 1),
                                        )
                                    }
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" />
                                    Previous
                                </Button>
                                <span className="text-sm text-gray-500">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.min(totalPages, p + 1),
                                        )
                                    }
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Detail modal */}
            {detailOpen && selectedElection && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                    onClick={handleCloseDetail}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center rounded-t-2xl z-10">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold truncate">
                                    {selectedElection.title}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    {selectedElection.election_type} •{" "}
                                    {selectedElection.year || "—"}
                                </p>
                            </div>
                            <button
                                onClick={handleCloseDetail}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {detailQuery.isLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                </div>
                            ) : detailQuery.isError ? (
                                <Alert
                                    variant="destructive"
                                    className="rounded-xl"
                                >
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {(detailQuery.error as any)?.response
                                            ?.data?.message ||
                                            (detailQuery.error as any)
                                                ?.message ||
                                            "Failed to load election details"}
                                    </AlertDescription>
                                </Alert>
                            ) : detailQuery.data ? (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="text-sm text-gray-500">
                                                Type
                                            </p>
                                            <p className="font-semibold">
                                                {detailQuery.data.election_type}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">
                                                Status
                                            </p>
                                            <Badge
                                                className={
                                                    getStatusBadge(
                                                        detailQuery.data.status,
                                                    ).color
                                                }
                                            >
                                                {
                                                    getStatusBadge(
                                                        detailQuery.data.status,
                                                    ).label
                                                }
                                            </Badge>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">
                                                Start Date
                                            </p>
                                            <p className="font-semibold">
                                                {detailQuery.data.voting_start
                                                    ? format(
                                                          new Date(
                                                              detailQuery.data
                                                                  .voting_start,
                                                          ),
                                                          "MMM dd, yyyy",
                                                      )
                                                    : "—"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">
                                                End Date
                                            </p>
                                            <p className="font-semibold">
                                                {detailQuery.data.voting_end
                                                    ? format(
                                                          new Date(
                                                              detailQuery.data
                                                                  .voting_end,
                                                          ),
                                                          "MMM dd, yyyy",
                                                      )
                                                    : "—"}
                                            </p>
                                        </div>
                                    </div>

                                    {detailQuery.data.positions &&
                                    detailQuery.data.positions.length > 0 ? (
                                        detailQuery.data.positions.map(
                                            (position: any) => (
                                                <div key={position.position_id}>
                                                    <h4 className="text-lg font-semibold border-b pb-2 mb-3">
                                                        {position.title}
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {position.candidates &&
                                                        position.candidates
                                                            .length > 0 ? (
                                                            position.candidates.map(
                                                                (
                                                                    candidate: any,
                                                                ) => (
                                                                    <div
                                                                        key={
                                                                            candidate.candidate_id
                                                                        }
                                                                        className={`flex justify-between items-center p-3 rounded-lg ${
                                                                            candidate.winner
                                                                                ? "bg-green-50 border border-green-200"
                                                                                : "bg-gray-50"
                                                                        }`}
                                                                    >
                                                                        <div className="flex-1 min-w-0">
                                                                            <span className="font-medium">
                                                                                {candidate.first_name ||
                                                                                    "Unknown"}{" "}
                                                                                {candidate.last_name ||
                                                                                    ""}
                                                                            </span>
                                                                            <span className="text-sm text-gray-500 ml-3">
                                                                                {candidate.partylist_name ||
                                                                                    "Independent"}
                                                                            </span>
                                                                            {candidate.winner && (
                                                                                <Badge className="ml-2 bg-green-500 text-white">
                                                                                    🏆
                                                                                    Winner
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-3 flex-shrink-0">
                                                                            <span className="font-bold">
                                                                                {
                                                                                    candidate.votes
                                                                                }{" "}
                                                                                votes
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ),
                                                            )
                                                        ) : (
                                                            <p className="text-sm text-gray-500 text-center py-2">
                                                                No candidates
                                                                for this position
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ),
                                        )
                                    ) : (
                                        <p className="text-sm text-gray-500 text-center py-4">
                                            No positions found for this election
                                        </p>
                                    )}

                                    {detailQuery.data.timeline &&
                                        detailQuery.data.timeline.length >
                                            0 && (
                                            <div>
                                                <h4 className="text-lg font-semibold border-b pb-2 mb-3">
                                                    Timeline
                                                </h4>
                                                <div className="space-y-2">
                                                    {detailQuery.data.timeline.map(
                                                        (
                                                            event: any,
                                                            index: number,
                                                        ) => (
                                                            <div
                                                                key={index}
                                                                className="flex items-start gap-3"
                                                            >
                                                                <div className="w-24 text-sm text-gray-500 flex-shrink-0">
                                                                    {event.date
                                                                        ? format(
                                                                              new Date(
                                                                                  event.date,
                                                                              ),
                                                                              "MMM dd, yyyy",
                                                                          )
                                                                        : "—"}
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium">
                                                                        {
                                                                            event.event
                                                                        }
                                                                    </p>
                                                                    <p className="text-sm text-gray-500">
                                                                        {
                                                                            event.description
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    <div className="flex flex-wrap gap-2 justify-end border-t pt-4">
                                        <Button
                                            variant="outline"
                                            onClick={handleCloseDetail}
                                        >
                                            Close
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                handleExportElection(
                                                    detailQuery.data!
                                                        .election_id,
                                                    "csv",
                                                    detailQuery.data!.title,
                                                )
                                            }
                                            disabled={
                                                exporting ===
                                                detailQuery.data!.election_id
                                            }
                                        >
                                            {exporting ===
                                            detailQuery.data!.election_id ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                            )}
                                            Export CSV
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                handleExportElection(
                                                    detailQuery.data!
                                                        .election_id,
                                                    "pdf",
                                                    detailQuery.data!.title,
                                                )
                                            }
                                            disabled={
                                                exporting ===
                                                detailQuery.data!.election_id
                                            }
                                        >
                                            {exporting ===
                                            detailQuery.data!.election_id ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                                <FileJson className="w-4 h-4 mr-2" />
                                            )}
                                            Export PDF
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-gray-500 text-center py-4">
                                    No data available
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ElectionRecords;