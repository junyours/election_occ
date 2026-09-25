// resources/js/pages/Admin/VoterManagement.tsx
import React, { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
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
    Trash2,
    ChevronLeft,
    ChevronRight,
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
    role: string; // ✅ ADDED role field
    course:
    | string
    | { course_code: string; course_name: string; course_id: number }
    | null;
    year_level: number;
    has_voted?: boolean;
}

const VoterManagement: React.FC = () => {
    const [courses, setCourses] = useState<Course[]>([]);

    const [voters, setVoters] = useState<Voter[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedCourse, setSelectedCourse] = useState<string>("all");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalVoters, setTotalVoters] = useState(0);

    const [voterToRemove, setVoterToRemove] = useState<Voter | null>(null);
    const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
    const [removing, setRemoving] = useState(false);

    useEffect(() => {
        fetchCourses();
    }, []);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(t);
    }, [searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCourse]);

    useEffect(() => {
        fetchVoters();
    }, [currentPage, perPage, debouncedSearch, selectedCourse]);

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
            // ✅ New signature — no election id
            const response = await adminAPI.getVoters({
                page: currentPage,
                per_page: perPage,
                search: debouncedSearch || undefined,
                course: selectedCourse !== "all" ? selectedCourse : undefined,
            });

            const payload = response.data?.data || response.data;
            const votersData = payload?.voters || [];
            setVoters(votersData);
            setTotalVoters(payload?.total_voters || votersData.length);
            setCurrentPage(payload?.current_page ?? 1);
            setTotalPages(payload?.last_page ?? 1);
        } catch (err: any) {
            console.error("Failed to fetch voters:", err);
            setError(err.response?.data?.message || "Failed to load voters");
            setVoters([]);
            setTotalVoters(0);
            setTotalPages(1);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

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

    // ✅ Role badge helper
    const getRoleBadge = (role: string): { label: string; color: string } => {
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

    const handleRemoveVoter = async () => {
        if (!voterToRemove) return;
        setRemoving(true);
        try {
            // ✅ New signature — just userId
            await adminAPI.removeVoter(voterToRemove.user_id);
            setRemoveDialogOpen(false);
            setVoterToRemove(null);
            fetchVoters();
        } catch (err: any) {
            alert(err.response?.data?.message || "Failed to remove voter");
        } finally {
            setRemoving(false);
        }
    };

    const clearFilters = () => {
        setSearchTerm("");
        setSelectedCourse("all");
    };

    const exportToCSV = () => {
        if (voters.length === 0) return;

        const headers = [
            "Student ID",
            "Name",
            "Email",
            "Role",
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

        if (total <= 5) {
            for (let i = 1; i <= total; i++) pages.push(i);
        } else if (current <= 3) {
            for (let i = 1; i <= 5; i++) pages.push(i);
        } else if (current >= total - 2) {
            for (let i = total - 4; i <= total; i++) pages.push(i);
        } else {
            for (let i = current - 2; i <= current + 2; i++) pages.push(i);
        }
        return pages;
    };

    if (loading && voters.length === 0) {
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
                        Voter Management
                    </h1>
                    <p className="text-gray-600">
                        View, filter, and manage all registered voters
                    </p>
                </div>
                <div className="flex space-x-2">
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

            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4 flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <span className="text-red-600">{error}</span>
                    </CardContent>
                </Card>
            )}

            {/* Stats pills */}
            <div className="flex flex-wrap items-center gap-3 py-1">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">
                        Total Active Voters
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                        {totalVoters}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">
                        Showing
                    </span>
                    <span className="text-sm font-bold text-blue-800">
                        {voters.length}
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

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Filter className="w-5 h-5 text-gray-500" />
                            <h3 className="font-semibold text-gray-700">
                                Filters
                            </h3>
                            {(searchTerm || selectedCourse !== "all") && (
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        </div>
                    </div>
                </CardContent>
            </Card>

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
                                                    {getCourseDisplay(voter)}
                                                </td>
                                                <td className="p-3">
                                                    {voter.year_level
                                                        ? `Year ${voter.year_level}`
                                                        : "-"}
                                                </td>
                                                <td className="p-3">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => {
                                                            setVoterToRemove(
                                                                voter,
                                                            );
                                                            setRemoveDialogOpen(
                                                                true,
                                                            );
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={7}
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
                            <span className="text-sm text-gray-500">
                                Show:
                            </span>
                            <select
                                value={perPage}
                                onChange={(e) => {
                                    setPerPage(parseInt(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                                        onClick={() =>
                                            setCurrentPage(pageNum)
                                        }
                                        className={`min-w-[36px] rounded-xl ${currentPage === pageNum
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

            {/* Remove voter dialog */}
            <AlertDialog
                open={removeDialogOpen}
                onOpenChange={setRemoveDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate Voter</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to deactivate{" "}
                            <span className="font-semibold">
                                {voterToRemove
                                    ? getFullName(voterToRemove)
                                    : ""}
                            </span>
                            ? They will no longer be eligible to vote.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveVoter}
                            disabled={removing}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {removing ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Trash2 className="w-4 h-4 mr-2" />
                            )}
                            Deactivate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default VoterManagement;