// resources/js/pages/Admin/ManageSections.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
    Card,
    CardContent,
    CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { Alert, AlertDescription } from "../components/ui/alert";
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
import { RefreshButton } from "../components/common/RefreshButton";
import { courseAPI } from "../api/courses";
import {
    School,
    Plus,
    Search,
    Filter,
    Loader2,
    CheckCircle,
    AlertCircle,
    Pencil,
    Trash2,
    Hash,
    LayoutGrid,
    List,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

interface Course {
    course_id: number;
    course_code: string;
    course_name: string;
    department?: string;
    is_active: boolean;
}

interface CourseSection {
    section_id: number;
    course_id: number;
    section_code: string;
    section_name: string;
    year_level: number;
    is_active: boolean;
    course?: Course;
}

type ViewMode = "list" | "grid";

interface FormData {
    course_id: string;
    section_code: string;
    section_name: string;
    year_level: string;
    is_active: boolean;
}

const ManageSections: React.FC = () => {
    const [courses, setCourses] = useState<Course[]>([]);
    const [sections, setSections] = useState<CourseSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [courseFilter, setCourseFilter] = useState<string>("all");
    const [yearFilter, setYearFilter] = useState<string>("all");
    const [viewMode, setViewMode] = useState<ViewMode>("list");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage] = useState(15);

    // Dialog
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSection, setEditingSection] =
        useState<CourseSection | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Delete confirm
    const [sectionToDelete, setSectionToDelete] =
        useState<CourseSection | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [formData, setFormData] = useState<FormData>({
        course_id: "",
        section_code: "",
        section_name: "",
        year_level: "1",
        is_active: true,
    });

    // ============================================================
    // LOAD DATA
    // ============================================================
    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async (): Promise<void> => {
        setLoading(true);
        setError("");
        try {
            const [coursesRes, sectionsRes] = await Promise.all([
                courseAPI.getAllCoursesAdmin(),
                courseAPI.getAllSections(),
            ]);

            const coursesData = coursesRes.data || [];
            const sectionsData = sectionsRes.data || [];

            setCourses(Array.isArray(coursesData) ? coursesData : []);
            setSections(Array.isArray(sectionsData) ? sectionsData : []);
        } catch (err: any) {
            console.error("Failed to load sections:", err);
            setError(
                err.response?.data?.message ||
                "Failed to load sections. Please try again.",
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = async (): Promise<void> => {
        setRefreshing(true);
        await fetchAll();
    };

    // ============================================================
    // FILTER + PAGINATE
    // ============================================================
    const filteredSections = useMemo(() => {
        let filtered = [...sections];

        if (courseFilter !== "all") {
            filtered = filtered.filter(
                (s) => s.course_id === parseInt(courseFilter),
            );
        }

        if (yearFilter !== "all") {
            filtered = filtered.filter(
                (s) => s.year_level === parseInt(yearFilter),
            );
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter((s) => {
                const courseCode =
                    s.course?.course_code?.toLowerCase() || "";
                const courseName =
                    s.course?.course_name?.toLowerCase() || "";
                return (
                    s.section_code.toLowerCase().includes(term) ||
                    s.section_name.toLowerCase().includes(term) ||
                    courseCode.includes(term) ||
                    courseName.includes(term)
                );
            });
        }

        return filtered.sort((a, b) => {
            const courseA = a.course?.course_code || "";
            const courseB = b.course?.course_code || "";
            if (courseA !== courseB) return courseA.localeCompare(courseB);
            if (a.year_level !== b.year_level)
                return a.year_level - b.year_level;
            return a.section_code.localeCompare(b.section_code);
        });
    }, [sections, courseFilter, yearFilter, searchTerm]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredSections.length / perPage),
    );
    const safePage = Math.min(currentPage, totalPages);
    const paginatedSections = filteredSections.slice(
        (safePage - 1) * perPage,
        safePage * perPage,
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [courseFilter, yearFilter, searchTerm]);

    // ============================================================
    // DIALOG HANDLERS
    // ============================================================
    const openCreateDialog = (): void => {
        setEditingSection(null);
        setFormData({
            course_id: courses[0]?.course_id?.toString() || "",
            section_code: "",
            section_name: "",
            year_level: "1",
            is_active: true,
        });
        setError("");
        setIsDialogOpen(true);
    };

    const openEditDialog = (section: CourseSection): void => {
        setEditingSection(section);
        setFormData({
            course_id: section.course_id.toString(),
            section_code: section.section_code,
            section_name: section.section_name,
            year_level: section.year_level.toString(),
            is_active: section.is_active,
        });
        setError("");
        setIsDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!formData.course_id) {
            setError("Please select a course");
            return;
        }
        if (!formData.section_code.trim()) {
            setError("Section code is required");
            return;
        }
        if (!formData.year_level) {
            setError("Year level is required");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                course_id: parseInt(formData.course_id),
                section_code: formData.section_code.trim().toUpperCase(),
                section_name:
                    formData.section_name.trim() ||
                    `Section ${formData.section_code.trim().toUpperCase()}`,
                year_level: parseInt(formData.year_level),
                is_active: formData.is_active,
            };

            if (editingSection) {
                await courseAPI.updateSection(
                    editingSection.section_id,
                    payload,
                );
                setSuccess("Section updated successfully");
            } else {
                await courseAPI.createSection(payload);
                setSuccess("Section created successfully");
            }

            setTimeout(() => setSuccess(""), 3000);
            setIsDialogOpen(false);
            await fetchAll();
        } catch (err: any) {
            console.error("Failed to save section:", err);
            setError(
                err.response?.data?.message ||
                "Failed to save section. Please try again.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (): Promise<void> => {
        if (!sectionToDelete) return;
        setDeleting(true);
        setError("");
        try {
            await courseAPI.deleteSection(sectionToDelete.section_id);
            setSuccess("Section deleted successfully");
            setTimeout(() => setSuccess(""), 3000);
            setSectionToDelete(null);
            await fetchAll();
        } catch (err: any) {
            console.error("Failed to delete section:", err);
            setError(
                err.response?.data?.message ||
                "Failed to delete section. Please try again.",
            );
        } finally {
            setDeleting(false);
        }
    };

    // ============================================================
    // STATS
    // ============================================================
    const stats = useMemo(() => {
        return {
            total: sections.length,
            active: sections.filter((s) => s.is_active).length,
            inactive: sections.filter((s) => !s.is_active).length,
            courses: courses.length,
        };
    }, [sections, courses]);

    // ============================================================
    // RENDER HELPERS
    // ============================================================
    const getCourseColor = (courseCode?: string): string => {
        if (!courseCode) return "bg-gray-100 text-gray-700";
        const map: Record<string, string> = {
            BSIT: "bg-blue-100 text-blue-700",
            BSBA: "bg-green-100 text-green-700",
            BEED: "bg-purple-100 text-purple-700",
        };
        return map[courseCode] || "bg-gray-100 text-gray-700";
    };

    if (loading) {
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
                        Manage Course Sections
                    </h1>
                    <p className="text-gray-600">
                        Add, edit, and remove course sections used across the
                        system
                    </p>
                </div>
                <div className="flex space-x-2">
                    <RefreshButton
                        onClick={handleRefresh}
                        isLoading={refreshing}
                    />
                    <Dialog
                        open={isDialogOpen}
                        onOpenChange={setIsDialogOpen}
                    >
                        <DialogTrigger asChild>
                            <Button
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={openCreateDialog}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Section
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg rounded-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-xl flex items-center gap-2">
                                    <School className="w-5 h-5 text-blue-600" />
                                    {editingSection
                                        ? "Edit Section"
                                        : "Create New Section"}
                                </DialogTitle>
                            </DialogHeader>

                            <form
                                onSubmit={handleSubmit}
                                className="space-y-4 mt-2"
                            >
                                {error && (
                                    <Alert
                                        variant="destructive"
                                        className="rounded-xl"
                                    >
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            {error}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-2">
                                    <Label>Course *</Label>
                                    <Select
                                        value={formData.course_id}
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                course_id: value,
                                            })
                                        }
                                    >
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue placeholder="Select a course" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {courses.map((course) => (
                                                <SelectItem
                                                    key={course.course_id}
                                                    value={course.course_id.toString()}
                                                >
                                                    {course.course_code} —{" "}
                                                    {course.course_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Section Code *</Label>
                                        <Input
                                            value={formData.section_code}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    section_code:
                                                        e.target.value.toUpperCase(),
                                                })
                                            }
                                            placeholder="e.g., A"
                                            maxLength={10}
                                            className="rounded-xl"
                                            required
                                        />
                                        <p className="text-xs text-gray-400">
                                            Short identifier (A, B, C…)
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Year Level *</Label>
                                        <Select
                                            value={formData.year_level}
                                            onValueChange={(value) =>
                                                setFormData({
                                                    ...formData,
                                                    year_level: value,
                                                })
                                            }
                                        >
                                            <SelectTrigger className="rounded-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">
                                                    1st Year
                                                </SelectItem>
                                                <SelectItem value="2">
                                                    2nd Year
                                                </SelectItem>
                                                <SelectItem value="3">
                                                    3rd Year
                                                </SelectItem>
                                                <SelectItem value="4">
                                                    4th Year
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Section Name</Label>
                                    <Input
                                        value={formData.section_name}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                section_name: e.target.value,
                                            })
                                        }
                                        placeholder="e.g., Section A (optional)"
                                        className="rounded-xl"
                                    />
                                    <p className="text-xs text-gray-400">
                                        Leave blank to auto-generate from the
                                        section code
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select
                                        value={
                                            formData.is_active
                                                ? "active"
                                                : "inactive"
                                        }
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                is_active:
                                                    value === "active",
                                            })
                                        }
                                    >
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">
                                                Active
                                            </SelectItem>
                                            <SelectItem value="inactive">
                                                Inactive
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            setIsDialogOpen(false)
                                        }
                                        className="rounded-xl"
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="bg-blue-600 hover:bg-blue-700 rounded-xl"
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                        )}
                                        {editingSection
                                            ? "Update Section"
                                            : "Create Section"}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Success/Error banners */}
            {success && (
                <Alert className="bg-green-50 border-green-200 rounded-xl">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                        {success}
                    </AlertDescription>
                </Alert>
            )}
            {error && !isDialogOpen && (
                <Alert variant="destructive" className="rounded-xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Stats pills */}
            <div className="flex flex-wrap items-center gap-3 py-1">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
                    <School className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">
                        Total Sections
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                        {stats.total}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
                        Active
                    </span>
                    <span className="text-sm font-bold text-green-800">
                        {stats.active}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-full">
                    <AlertCircle className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-600">
                        Inactive
                    </span>
                    <span className="text-sm font-bold text-gray-700">
                        {stats.inactive}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-full">
                    <Hash className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">
                        Courses
                    </span>
                    <span className="text-sm font-bold text-purple-800">
                        {stats.courses}
                    </span>
                </div>
            </div>

            {/* Filters */}
            <Card className="border-0 shadow-lg rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b">
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-blue-600" />
                        Search & Filters
                    </CardTitle>
                </div>
                <CardContent className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative md:col-span-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                placeholder="Search sections…"
                                value={searchTerm}
                                onChange={(e) =>
                                    setSearchTerm(e.target.value)
                                }
                                className="pl-10 rounded-xl bg-gray-50 border-gray-200"
                            />
                        </div>
                        <div>
                            <Select
                                value={courseFilter}
                                onValueChange={setCourseFilter}
                            >
                                <SelectTrigger className="rounded-xl bg-gray-50 border-gray-200">
                                    <SelectValue placeholder="All Courses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Courses
                                    </SelectItem>
                                    {courses.map((course) => (
                                        <SelectItem
                                            key={course.course_id}
                                            value={course.course_id.toString()}
                                        >
                                            {course.course_code}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Select
                                value={yearFilter}
                                onValueChange={setYearFilter}
                            >
                                <SelectTrigger className="rounded-xl bg-gray-50 border-gray-200">
                                    <SelectValue placeholder="All Years" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Years
                                    </SelectItem>
                                    <SelectItem value="1">
                                        1st Year
                                    </SelectItem>
                                    <SelectItem value="2">
                                        2nd Year
                                    </SelectItem>
                                    <SelectItem value="3">
                                        3rd Year
                                    </SelectItem>
                                    <SelectItem value="4">
                                        4th Year
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-100">
                        <span className="text-sm text-gray-500">
                            Showing {paginatedSections.length} of{" "}
                            {filteredSections.length} sections
                        </span>
                        <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                            <button
                                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 ${viewMode === "list"
                                        ? "bg-blue-600 text-white"
                                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                                    }`}
                                onClick={() => setViewMode("list")}
                            >
                                <List className="w-4 h-4" />
                                List
                            </button>
                            <button
                                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 ${viewMode === "grid"
                                        ? "bg-blue-600 text-white"
                                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                                    }`}
                                onClick={() => setViewMode("grid")}
                            >
                                <LayoutGrid className="w-4 h-4" />
                                Grid
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* List / Grid */}
            {filteredSections.length === 0 ? (
                <Card className="rounded-xl border-0 shadow-lg">
                    <CardContent className="text-center py-16">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <School className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                            No Sections Found
                        </h3>
                        <p className="text-gray-500 mb-4">
                            {sections.length === 0
                                ? "No sections have been created yet."
                                : "No sections match your filters."}
                        </p>
                        {sections.length === 0 && (
                            <Button
                                className="bg-blue-600 hover:bg-blue-700 rounded-xl"
                                onClick={openCreateDialog}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Your First Section
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : viewMode === "list" ? (
                <Card className="border-0 shadow-lg rounded-xl overflow-hidden">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="text-left p-4 text-sm font-semibold text-gray-700">
                                            Course
                                        </th>
                                        <th className="text-left p-4 text-sm font-semibold text-gray-700">
                                            Year
                                        </th>
                                        <th className="text-left p-4 text-sm font-semibold text-gray-700">
                                            Section
                                        </th>
                                        <th className="text-left p-4 text-sm font-semibold text-gray-700">
                                            Status
                                        </th>
                                        <th className="text-right p-4 text-sm font-semibold text-gray-700">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedSections.map((section) => (
                                        <tr
                                            key={section.section_id}
                                            className="hover:bg-blue-50/40 transition-colors"
                                        >
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        className={getCourseColor(
                                                            section.course
                                                                ?.course_code,
                                                        )}
                                                    >
                                                        {section.course
                                                            ?.course_code ||
                                                            "—"}
                                                    </Badge>
                                                    <span className="text-xs text-gray-500 hidden md:inline">
                                                        {section.course
                                                            ?.course_name ||
                                                            ""}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-medium text-gray-700">
                                                    Year {section.year_level}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                                                        {section.section_code}
                                                    </div>
                                                    <span className="text-sm text-gray-600">
                                                        {section.section_name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {section.is_active ? (
                                                    <Badge className="bg-green-100 text-green-700">
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-gray-100 text-gray-600">
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        onClick={() =>
                                                            openEditDialog(
                                                                section,
                                                            )
                                                        }
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() =>
                                                            setSectionToDelete(
                                                                section,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedSections.map((section) => (
                        <Card
                            key={section.section_id}
                            className="border-0 shadow-lg rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                        >
                            <div className="h-1.5 bg-blue-500" />
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center font-bold text-lg">
                                            {section.section_code}
                                        </div>
                                        <div>
                                            <Badge
                                                className={getCourseColor(
                                                    section.course
                                                        ?.course_code,
                                                )}
                                            >
                                                {section.course
                                                    ?.course_code || "—"}
                                            </Badge>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Year {section.year_level}
                                            </p>
                                        </div>
                                    </div>
                                    {section.is_active ? (
                                        <Badge className="bg-green-100 text-green-700">
                                            Active
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-gray-100 text-gray-600">
                                            Inactive
                                        </Badge>
                                    )}
                                </div>

                                <p className="text-sm font-semibold text-gray-900 mb-4">
                                    {section.section_name}
                                </p>

                                <div className="flex items-center justify-end gap-1 pt-3 border-t border-gray-100">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        onClick={() =>
                                            openEditDialog(section)
                                        }
                                    >
                                        <Pencil className="w-3.5 h-3.5 mr-1" />
                                        Edit
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() =>
                                            setSectionToDelete(section)
                                        }
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                                        Delete
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <Card className="border-0 shadow-lg rounded-xl overflow-hidden">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center flex-wrap gap-4">
                            <div className="text-sm text-gray-500">
                                Page {safePage} of {totalPages}
                            </div>
                            <div className="flex space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.max(1, p - 1),
                                        )
                                    }
                                    disabled={safePage === 1}
                                    className="rounded-xl"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.min(totalPages, p + 1),
                                        )
                                    }
                                    disabled={safePage === totalPages}
                                    className="rounded-xl"
                                >
                                    Next
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Delete Confirmation */}
            <AlertDialog
                open={!!sectionToDelete}
                onOpenChange={(open) => {
                    if (!open) {
                        setSectionToDelete(null);
                        setError("");
                    }
                }}
            >
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            Delete Section?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete{" "}
                            <strong>
                                {sectionToDelete?.course?.course_code} — Year{" "}
                                {sectionToDelete?.year_level} Section{" "}
                                {sectionToDelete?.section_code}
                            </strong>
                            ? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {/* ✅ Inline backend error (if any) */}
                    {error && (
                        <Alert variant="destructive" className="rounded-xl mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel
                            className="rounded-xl"
                            disabled={deleting}
                            onClick={() => setError("")}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700 rounded-xl"
                        >
                            {deleting ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4 mr-2" />
                            )}
                            Delete Section
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ManageSections;