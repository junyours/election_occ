// resources/js/Profile/ProfileSettings.tsx
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "../components/ui/tabs";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { useAuth } from "../contexts/AuthContext";
import { authAPI } from "../api/auth";
import {
    CheckCircle,
    AlertCircle,
    Loader2,
    Eye,
    EyeOff,
    User,
    Shield,
    Info,
    Sparkles,
    Lock,
    Mail,
    GraduationCap,
    IdCard,
    Calendar,
    Trophy,
    MapPin,
    Phone,
    Globe,
    BookOpen,
    Save,
    Pencil,
    X,
    Camera,
    Upload,
    Trash2,
    Crown,
} from "lucide-react";

interface PasswordData {
    current_password: string;
    new_password: string;
    confirm_password: string;
}

interface PersonalInfoData {
    birthdate: string;
    present_address: string;
    present_address_2: string;
    no_unit_load: string;
    cellphone: string;
    social_media: string;
    year_level: string;
}

const getImageUrl = (path?: string, cacheBust?: number): string | null => {
    if (!path) return null;
    if (path.startsWith("http")) {
        return cacheBust ? `${path}?t=${cacheBust}` : path;
    }
    const clean = path.startsWith("/") ? path : `/${path}`;
    const suffix = cacheBust ? `?t=${cacheBust}` : "";
    return `http://localhost:8000${clean}${suffix}`;
};

const MAX_PHOTO_SIZE_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const ProfileSettings: React.FC = () => {
    const { user, updateUser } = useAuth();

    // ✅ Role flags
    const isAdmin = user?.role === "admin";
    const isComelec = user?.role === "comelec";
    const isCandidate = user?.role === "candidate";
    const isVoter = user?.role === "voter";
    const isStaff = isAdmin || isComelec;

    const [activeTab, setActiveTab] = useState("profile");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    // Password state
    const [passwordData, setPasswordData] = useState<PasswordData>({
        current_password: "",
        new_password: "",
        confirm_password: "",
    });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Personal info state
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [infoLoading, setInfoLoading] = useState(false);
    const [infoSuccess, setInfoSuccess] = useState("");
    const [infoError, setInfoError] = useState("");
    const [personalInfo, setPersonalInfo] = useState<PersonalInfoData>({
        birthdate: "",
        present_address: "",
        present_address_2: "",
        no_unit_load: "",
        cellphone: "",
        social_media: "",
        year_level: "",
    });

    // Profile photo state
    const [photoUploading, setPhotoUploading] = useState(false);
    const [photoError, setPhotoError] = useState("");
    const [photoSuccess, setPhotoSuccess] = useState("");
    const [photoRefreshKey, setPhotoRefreshKey] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync personal info when user changes
    useEffect(() => {
        if (user) {
            setPersonalInfo({
                birthdate: user.birthdate || "",
                present_address: user.present_address || "",
                present_address_2: user.present_address_2 || "",
                no_unit_load: user.no_unit_load ? String(user.no_unit_load) : "",
                cellphone: user.cellphone || "",
                social_media: user.social_media || "",
                year_level: user.year_level ? String(user.year_level) : "",
            });
        }
    }, [user]);

    // ============================================================
    // PASSWORD
    // ============================================================
    const handlePasswordChange = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

        if (passwordData.new_password !== passwordData.confirm_password) {
            setError("New passwords do not match");
            setLoading(false);
            return;
        }

        if (passwordData.new_password.length < 8) {
            setError("Password must be at least 8 characters");
            setLoading(false);
            return;
        }

        try {
            await authAPI.changePassword(passwordData);
            setSuccess("Password changed successfully!");
            setPasswordData({
                current_password: "",
                new_password: "",
                confirm_password: "",
            });
            setTimeout(() => setSuccess(""), 3000);
        } catch (err: any) {
            setError(
                err.response?.data?.message || "Failed to change password",
            );
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // PERSONAL INFO SAVE
    // ============================================================
    const handleSavePersonalInfo = async (): Promise<void> => {
        setInfoLoading(true);
        setInfoError("");
        setInfoSuccess("");

        if (personalInfo.cellphone && personalInfo.cellphone.length !== 11) {
            setInfoError("Cellphone number must be exactly 11 digits.");
            setInfoLoading(false);
            return;
        }

        if (
            personalInfo.no_unit_load &&
            parseInt(personalInfo.no_unit_load) > 18
        ) {
            setInfoError("Unit load cannot exceed 18 units.");
            setInfoLoading(false);
            return;
        }

        try {
            // ✅ Only send fields that apply to the role
            const payload: any = {
                birthdate: personalInfo.birthdate || null,
                present_address: personalInfo.present_address || null,
                present_address_2: personalInfo.present_address_2 || null,
                cellphone: personalInfo.cellphone || null,
                social_media: personalInfo.social_media || null,
            };

            // Students only
            if (!isStaff) {
                payload.no_unit_load = personalInfo.no_unit_load
                    ? parseInt(personalInfo.no_unit_load)
                    : null;
                payload.year_level = personalInfo.year_level
                    ? parseInt(personalInfo.year_level)
                    : null;
            }

            const response = await authAPI.updateProfile(payload);

            if (response.data?.user) {
                updateUser(response.data.user);
            }

            setInfoSuccess("Personal information updated successfully!");
            setIsEditingInfo(false);
            setTimeout(() => setInfoSuccess(""), 3000);
        } catch (err: any) {
            setInfoError(
                err.response?.data?.message ||
                "Failed to update personal information",
            );
        } finally {
            setInfoLoading(false);
        }
    };

    const handleCancelEdit = (): void => {
        if (user) {
            setPersonalInfo({
                birthdate: user.birthdate || "",
                present_address: user.present_address || "",
                present_address_2: user.present_address_2 || "",
                no_unit_load: user.no_unit_load ? String(user.no_unit_load) : "",
                cellphone: user.cellphone || "",
                social_media: user.social_media || "",
                year_level: user.year_level ? String(user.year_level) : "",
            });
        }
        setIsEditingInfo(false);
        setInfoError("");
    };

    // ============================================================
    // PROFILE PHOTO
    // ============================================================
    const validatePhoto = (file: File): string | null => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
            return "Please upload a JPEG, PNG, or WebP image.";
        }
        if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
            return `Image must be smaller than ${MAX_PHOTO_SIZE_MB}MB.`;
        }
        return null;
    };

    const handlePhotoUpload = async (file: File): Promise<void> => {
        setPhotoError("");
        setPhotoSuccess("");

        const validationError = validatePhoto(file);
        if (validationError) {
            setPhotoError(validationError);
            return;
        }

        setPhotoUploading(true);

        try {
            const formData = new FormData();
            formData.append("photo", file);

            const response = await authAPI.uploadProfilePhoto(formData);

            if (!response.data?.success) {
                throw new Error(response.data?.message || "Upload failed");
            }

            if (response.data.user) {
                updateUser(response.data.user);
            }

            setPhotoRefreshKey(Date.now());
            setPhotoSuccess("Profile photo updated successfully!");
            setTimeout(() => setPhotoSuccess(""), 3000);
        } catch (err: any) {
            setPhotoError(
                err.response?.data?.message ||
                err.message ||
                "Failed to upload profile photo",
            );
        } finally {
            setPhotoUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleFileInputChange = (
        e: React.ChangeEvent<HTMLInputElement>,
    ): void => {
        const file = e.target.files?.[0];
        if (file) handlePhotoUpload(file);
    };

    const handleDragOver = (e: React.DragEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handlePhotoUpload(file);
    };

    const handleRemovePhoto = async (): Promise<void> => {
        if (!window.confirm("Remove your profile photo?")) return;

        setPhotoError("");
        setPhotoSuccess("");
        setPhotoUploading(true);

        try {
            const response = await authAPI.deleteProfilePhoto();
            if (response.data?.user) {
                updateUser(response.data.user);
            }
            setPhotoRefreshKey(Date.now());
            setPhotoSuccess("Profile photo removed.");
            setTimeout(() => setPhotoSuccess(""), 3000);
        } catch (err: any) {
            setPhotoError(
                err.response?.data?.message ||
                "Failed to remove profile photo",
            );
        } finally {
            setPhotoUploading(false);
        }
    };

    // ============================================================
    // DISPLAY HELPERS
    // ============================================================
    const getInitials = (): string => {
        if (!user) return "U";
        return `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase();
    };

    const getCourseDisplay = (): string => {
        if (
            user?.course &&
            typeof user.course === "object" &&
            "course_code" in user.course
        ) {
            return `${user.course.course_code} - ${user.course.course_name}`;
        }
        if (typeof user?.course === "string") return user.course;
        return "Not assigned";
    };

    const getRoleBadge = (): { label: string; color: string; bg: string; icon: React.ElementType } => {
        switch (user?.role) {
            case "admin":
                return {
                    label: "Administrator",
                    color: "bg-purple-600",
                    bg: "bg-purple-100 text-purple-700",
                    icon: Crown,
                };
            case "comelec":
                return {
                    label: "COMELEC Officer",
                    color: "bg-blue-600",
                    bg: "bg-blue-100 text-blue-700",
                    icon: Shield,
                };
            case "candidate":
                return {
                    label: "Candidate",
                    color: "bg-green-600",
                    bg: "bg-green-100 text-green-700",
                    icon: Trophy,
                };
            default:
                return {
                    label: "Student Voter",
                    color: "bg-gray-600",
                    bg: "bg-gray-100 text-gray-700",
                    icon: User,
                };
        }
    };

    const roleInfo = getRoleBadge();
    const RoleIcon = roleInfo.icon;
    const profilePhoto = getImageUrl(user?.profile_photo, photoRefreshKey);
    const hasProfilePhoto = !!user?.profile_photo;

    // ✅ Header subtitle per role
    const headerSubtitle = isAdmin
        ? "Manage your administrator account"
        : isComelec
            ? "Manage your COMELEC account"
            : isCandidate
                ? "Manage your candidate account"
                : "Manage your account and security preferences";

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="relative rounded-2xl overflow-hidden bg-blue-600 shadow-xl mb-8">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="relative px-6 py-8">
                    <div className="flex items-center gap-2 mb-2">
                        {isAdmin ? (
                            <Crown className="w-5 h-5 text-yellow-300" />
                        ) : (
                            <Sparkles className="w-5 h-5 text-yellow-300" />
                        )}
                        <span className="text-white/80 text-sm font-medium">
                            {isAdmin
                                ? "Administrator Settings"
                                : "Account Settings"}
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold text-white">
                        Profile Settings
                    </h1>
                    <p className="text-blue-100 mt-1">{headerSubtitle}</p>
                </div>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="space-y-6"
            >
                <TabsList className="bg-gray-100 p-1 rounded-xl">
                    <TabsTrigger
                        value="profile"
                        className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                    >
                        <User className="w-4 h-4 mr-2" /> Profile
                    </TabsTrigger>
                    <TabsTrigger
                        value="security"
                        className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                    >
                        <Lock className="w-4 h-4 mr-2" /> Security
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-6">
                    {/* ============================================================ */}
                    {/* PROFILE PHOTO CARD */}
                    {/* ============================================================ */}
                    <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b">
                            <CardTitle className="flex items-center gap-2">
                                <Camera className="w-5 h-5 text-blue-600" />
                                Profile Picture
                            </CardTitle>
                        </div>
                        <CardContent className="p-6">
                            {photoSuccess && (
                                <Alert className="bg-green-50 border-green-200 rounded-xl mb-4">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <AlertDescription className="text-green-600">
                                        {photoSuccess}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {photoError && (
                                <Alert
                                    variant="destructive"
                                    className="rounded-xl mb-4"
                                >
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {photoError}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="relative group">
                                    <Avatar className="w-32 h-32 ring-4 ring-blue-100 shadow-xl">
                                        <AvatarImage
                                            src={profilePhoto || undefined}
                                        />
                                        <AvatarFallback className="bg-blue-600 text-white text-4xl font-bold">
                                            {getInitials()}
                                        </AvatarFallback>
                                    </Avatar>
                                    {photoUploading && (
                                        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                                        </div>
                                    )}
                                    {hasProfilePhoto && !photoUploading && (
                                        <button
                                            type="button"
                                            onClick={handleRemovePhoto}
                                            className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg border-2 border-white transition-colors"
                                            title="Remove photo"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                <div
                                    className={`flex-1 w-full rounded-xl border-2 border-dashed transition-colors p-5 ${isDragging
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-300 bg-gray-50"
                                        }`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleFileInputChange}
                                        className="hidden"
                                        id="profile-photo-input"
                                    />

                                    <label
                                        htmlFor="profile-photo-input"
                                        className={`flex flex-col items-center justify-center cursor-pointer text-center ${photoUploading
                                            ? "opacity-50 pointer-events-none"
                                            : ""
                                            }`}
                                    >
                                        <Upload className="w-8 h-8 text-blue-600 mb-2" />
                                        <p className="text-sm font-semibold text-gray-700">
                                            {isDragging
                                                ? "Drop to upload"
                                                : hasProfilePhoto
                                                    ? "Replace your photo"
                                                    : "Upload a profile photo"}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Drag & drop, or click to browse
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            JPEG, PNG or WebP — max{" "}
                                            {MAX_PHOTO_SIZE_MB}MB
                                        </p>
                                    </label>

                                    <div className="flex gap-2 justify-center mt-3">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                            disabled={photoUploading}
                                            className="rounded-xl bg-blue-600 hover:bg-blue-700"
                                        >
                                            {photoUploading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <Camera className="w-4 h-4 mr-2" />
                                                    Choose File
                                                </>
                                            )}
                                        </Button>
                                        {hasProfilePhoto && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={handleRemovePhoto}
                                                disabled={photoUploading}
                                                className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Remove
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <p className="text-xs text-blue-700 flex items-start gap-2">
                                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>
                                        {isStaff
                                            ? "Your profile photo is visible to voters, candidates, and other staff members throughout the system. Choose a professional image where your face is clearly visible."
                                            : "Your profile photo is shown to voters on candidate lists, partylist pages, and the campaign timeline. Choose an image where your face is clearly visible."}
                                    </span>
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ============================================================ */}
                    {/* ACCOUNT OVERVIEW — shared across all roles */}
                    {/* ============================================================ */}
                    <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-600" />{" "}
                                {isStaff
                                    ? "Account Information"
                                    : "Personal Information"}
                            </CardTitle>
                            {!isEditingInfo ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditingInfo(true)}
                                    className="rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50"
                                >
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Edit
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelEdit}
                                        disabled={infoLoading}
                                        className="rounded-xl"
                                    >
                                        <X className="w-4 h-4 mr-1" />
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSavePersonalInfo}
                                        disabled={infoLoading}
                                        className="rounded-xl bg-blue-600 hover:bg-blue-700"
                                    >
                                        {infoLoading ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4 mr-2" />
                                        )}
                                        Save
                                    </Button>
                                </div>
                            )}
                        </div>
                        <CardContent className="p-6">
                            {infoSuccess && (
                                <Alert className="bg-green-50 border-green-200 rounded-xl mb-4">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <AlertDescription className="text-green-600">
                                        {infoSuccess}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {infoError && (
                                <Alert
                                    variant="destructive"
                                    className="rounded-xl mb-4"
                                >
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        {infoError}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Locked fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                        <User className="w-4 h-4" />
                                        <span>First Name</span>
                                    </div>
                                    <p className="text-gray-900 font-medium">
                                        {user?.first_name}
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                        <User className="w-4 h-4" />
                                        <span>Last Name</span>
                                    </div>
                                    <p className="text-gray-900 font-medium">
                                        {user?.last_name}
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                        <Mail className="w-4 h-4" />
                                        <span>Email Address</span>
                                    </div>
                                    <p className="text-gray-900 font-medium">
                                        {user?.email}
                                    </p>
                                </div>

                                {/* Role badge */}
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                        <Shield className="w-4 h-4" />
                                        <span>Role</span>
                                    </div>
                                    <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.bg}`}
                                    >
                                        <RoleIcon className="w-3 h-3" />
                                        {roleInfo.label}
                                    </span>
                                </div>

                                {/* ✅ Student-specific fields — only for non-staff */}
                                {!isStaff && (
                                    <>
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                                <IdCard className="w-4 h-4" />
                                                <span>Student ID</span>
                                            </div>
                                            <p className="text-gray-900 font-medium">
                                                {user?.id_no || "—"}
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                                <GraduationCap className="w-4 h-4" />
                                                <span>Course</span>
                                            </div>
                                            <p className="text-gray-900 font-medium">
                                                {getCourseDisplay()}
                                            </p>
                                        </div>
                                    </>
                                )}

                                {/* ✅ Staff-specific fields */}
                                {isStaff && (
                                    <>
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                                <Crown className="w-4 h-4" />
                                                <span>Access Level</span>
                                            </div>
                                            <p className="text-gray-900 font-medium">
                                                {isAdmin
                                                    ? "Full System Access"
                                                    : "Election Operations"}
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 rounded-xl p-4">
                                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                                <Trophy className="w-4 h-4" />
                                                <span>Account Status</span>
                                            </div>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                                <CheckCircle className="w-3 h-3" />{" "}
                                                Active
                                            </span>
                                        </div>
                                    </>
                                )}

                                {/* Voter/candidate status */}
                                {!isStaff && (
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                            <Trophy className="w-4 h-4" />
                                            <span>Account Status</span>
                                        </div>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                            <CheckCircle className="w-3 h-3" />{" "}
                                            Active
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Editable personal info */}
                            <div className="border-t pt-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                                    <Pencil className="w-4 h-4 text-blue-600" />
                                    {isStaff
                                        ? "Contact Information"
                                        : "Additional Personal Information"}
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Birthdate */}
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 font-medium flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-blue-500" />
                                            Birthdate
                                        </Label>
                                        {isEditingInfo ? (
                                            <Input
                                                type="date"
                                                value={
                                                    personalInfo.birthdate
                                                }
                                                onChange={(e) =>
                                                    setPersonalInfo({
                                                        ...personalInfo,
                                                        birthdate:
                                                            e.target.value,
                                                    })
                                                }
                                                max={
                                                    new Date()
                                                        .toISOString()
                                                        .split("T")[0]
                                                }
                                                className="rounded-xl border-2 focus:border-blue-500"
                                            />
                                        ) : (
                                            <div className="bg-gray-50 rounded-xl p-3 min-h-[42px] flex items-center">
                                                <p className="text-gray-900 font-medium">
                                                    {user?.birthdate
                                                        ? new Date(
                                                            user.birthdate,
                                                        ).toLocaleDateString(
                                                            "en-US",
                                                            {
                                                                year: "numeric",
                                                                month: "long",
                                                                day: "numeric",
                                                            },
                                                        )
                                                        : "Not set"}
                                                    {user?.age && (
                                                        <span className="ml-2 text-sm text-gray-500">
                                                            ({user.age} years
                                                            old)
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Year Level — students only */}
                                    {!isStaff && (
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-indigo-500" />
                                                Year Level
                                            </Label>
                                            {isEditingInfo ? (
                                                <Select
                                                    value={
                                                        personalInfo.year_level
                                                    }
                                                    onValueChange={(value) =>
                                                        setPersonalInfo({
                                                            ...personalInfo,
                                                            year_level: value,
                                                        })
                                                    }
                                                >
                                                    <SelectTrigger className="rounded-xl border-2 focus:border-blue-500">
                                                        <SelectValue placeholder="Select year level" />
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
                                            ) : (
                                                <div className="bg-gray-50 rounded-xl p-3 min-h-[42px] flex items-center">
                                                    <p className="text-gray-900 font-medium">
                                                        {user?.year_level
                                                            ? `Year ${user.year_level}`
                                                            : "Not set"}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Cellphone */}
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 font-medium flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-green-500" />
                                            Cellphone
                                        </Label>
                                        {isEditingInfo ? (
                                            <>
                                                <Input
                                                    type="tel"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    maxLength={11}
                                                    value={
                                                        personalInfo.cellphone
                                                    }
                                                    onChange={(e) => {
                                                        const digitsOnly =
                                                            e.target.value
                                                                .replace(
                                                                    /\D/g,
                                                                    "",
                                                                )
                                                                .slice(0, 11);
                                                        setPersonalInfo({
                                                            ...personalInfo,
                                                            cellphone:
                                                                digitsOnly,
                                                        });
                                                    }}
                                                    placeholder="09XXXXXXXXX"
                                                    className="rounded-xl border-2 focus:border-blue-500"
                                                />
                                                <p
                                                    className={`text-xs ${personalInfo.cellphone
                                                        .length === 11
                                                        ? "text-green-600"
                                                        : personalInfo
                                                            .cellphone
                                                            .length > 0
                                                            ? "text-red-500"
                                                            : "text-gray-500"
                                                        }`}
                                                >
                                                    {
                                                        personalInfo.cellphone
                                                            .length
                                                    }
                                                    /11 digits
                                                    {personalInfo.cellphone
                                                        .length > 0 &&
                                                        personalInfo.cellphone
                                                            .length < 11 &&
                                                        " — must be exactly 11 digits"}
                                                </p>
                                            </>
                                        ) : (
                                            <div className="bg-gray-50 rounded-xl p-3 min-h-[42px] flex items-center">
                                                <p className="text-gray-900 font-medium">
                                                    {user?.cellphone ||
                                                        "Not set"}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Social Media */}
                                    <div className="space-y-2">
                                        <Label className="text-gray-700 font-medium flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-purple-500" />
                                            Social Media Account
                                        </Label>
                                        {isEditingInfo ? (
                                            <Input
                                                type="text"
                                                value={
                                                    personalInfo.social_media
                                                }
                                                onChange={(e) =>
                                                    setPersonalInfo({
                                                        ...personalInfo,
                                                        social_media:
                                                            e.target.value,
                                                    })
                                                }
                                                placeholder="Facebook profile link"
                                                className="rounded-xl border-2 focus:border-blue-500"
                                            />
                                        ) : (
                                            <div className="bg-gray-50 rounded-xl p-3 min-h-[42px] flex items-center">
                                                <p className="text-gray-900 font-medium truncate">
                                                    {user?.social_media ||
                                                        "Not set"}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* No. Unit Load — students only */}
                                    {!isStaff && (
                                        <div className="space-y-2">
                                            <Label className="text-gray-700 font-medium flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-orange-500" />
                                                No. of Unit Load
                                            </Label>
                                            {isEditingInfo ? (
                                                <>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={18}
                                                        value={
                                                            personalInfo.no_unit_load
                                                        }
                                                        onChange={(e) => {
                                                            const raw =
                                                                e.target.value;
                                                            if (raw === "") {
                                                                setPersonalInfo({
                                                                    ...personalInfo,
                                                                    no_unit_load:
                                                                        "",
                                                                });
                                                                return;
                                                            }
                                                            const num =
                                                                parseInt(
                                                                    raw,
                                                                    10,
                                                                );
                                                            const clamped =
                                                                isNaN(num)
                                                                    ? ""
                                                                    : String(
                                                                        Math.min(
                                                                            Math.max(
                                                                                num,
                                                                                0,
                                                                            ),
                                                                            18,
                                                                        ),
                                                                    );
                                                            setPersonalInfo({
                                                                ...personalInfo,
                                                                no_unit_load:
                                                                    clamped,
                                                            });
                                                        }}
                                                        placeholder="Max 18 units"
                                                        className="rounded-xl border-2 focus:border-blue-500"
                                                    />
                                                    <p className="text-xs text-gray-500">
                                                        Maximum allowed: 18
                                                        units
                                                    </p>
                                                </>
                                            ) : (
                                                <div className="bg-gray-50 rounded-xl p-3 min-h-[42px] flex items-center">
                                                    <p className="text-gray-900 font-medium">
                                                        {user?.no_unit_load
                                                            ? `${user.no_unit_load} units`
                                                            : "Not set"}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Present Address */}
                                    <div className="space-y-2 md:col-span-2">
                                        <Label className="text-gray-700 font-medium flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-red-500" />
                                            Present Address
                                        </Label>
                                        {isEditingInfo ? (
                                            <div className="space-y-2">
                                                <Input
                                                    type="text"
                                                    value={
                                                        personalInfo.present_address
                                                    }
                                                    onChange={(e) =>
                                                        setPersonalInfo({
                                                            ...personalInfo,
                                                            present_address:
                                                                e.target.value,
                                                        })
                                                    }
                                                    placeholder="House No., Street, Barangay"
                                                    className="rounded-xl border-2 focus:border-blue-500"
                                                />
                                                <Input
                                                    type="text"
                                                    value={
                                                        personalInfo.present_address_2
                                                    }
                                                    onChange={(e) =>
                                                        setPersonalInfo({
                                                            ...personalInfo,
                                                            present_address_2:
                                                                e.target.value,
                                                        })
                                                    }
                                                    placeholder="City/Municipality, Province (optional)"
                                                    className="rounded-xl border-2 focus:border-blue-500"
                                                />
                                            </div>
                                        ) : (
                                            <div className="bg-gray-50 rounded-xl p-3 min-h-[42px] flex items-center">
                                                <p className="text-gray-900 font-medium">
                                                    {user?.present_address ? (
                                                        <>
                                                            {
                                                                user.present_address
                                                            }
                                                            {user.present_address_2 && (
                                                                <>
                                                                    {", "}
                                                                    {
                                                                        user.present_address_2
                                                                    }
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        "Not set"
                                                    )}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isEditingInfo && (
                                    <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
                                        <Info className="w-3 h-3" />
                                        {isStaff
                                            ? "These details are used for account recovery and audit records."
                                            : "These details will be used in your candidacy application."}
                                    </p>
                                )}
                            </div>

                            {/* Info box — role-aware */}
                            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <div className="flex items-start gap-3">
                                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-blue-800">
                                            About Profile Information
                                        </h4>
                                        <p className="text-sm text-blue-700">
                                            {isAdmin ? (
                                                <>
                                                    Your name and email are
                                                    managed by the system
                                                    administrator. Contact your
                                                    IT department if you need
                                                    to change them. You can
                                                    freely edit your birthdate,
                                                    address, and contact info
                                                    above.
                                                </>
                                            ) : isComelec ? (
                                                <>
                                                    Your name, email, and
                                                    student ID are managed by
                                                    the school administration.
                                                    Contact the registrar if
                                                    you need to change them.
                                                    You can freely edit your
                                                    birthdate, address, and
                                                    contact info above.
                                                </>
                                            ) : (
                                                <>
                                                    Your name, student ID,
                                                    email, and course are
                                                    managed by the school
                                                    administration. Contact the
                                                    registrar to update them.
                                                    You can freely edit your
                                                    birthdate, year level,
                                                    address, contact info, and
                                                    other personal details
                                                    above.
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security">
                    <Card className="border-0 shadow-xl rounded-2xl overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b">
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="w-5 h-5 text-blue-600" />{" "}
                                Change Password
                            </CardTitle>
                        </div>
                        <CardContent className="p-6">
                            <form
                                onSubmit={handlePasswordChange}
                                className="space-y-5"
                            >
                                {success && (
                                    <Alert className="bg-green-50 border-green-200 rounded-xl">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <AlertDescription className="text-green-600">
                                            {success}
                                        </AlertDescription>
                                    </Alert>
                                )}
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
                                    <Label
                                        htmlFor="current_password"
                                        className="text-gray-700 font-medium"
                                    >
                                        Current Password
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="current_password"
                                            type={
                                                showCurrentPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={
                                                passwordData.current_password
                                            }
                                            onChange={(e) =>
                                                setPasswordData({
                                                    ...passwordData,
                                                    current_password:
                                                        e.target.value,
                                                })
                                            }
                                            required
                                            className="pr-10 rounded-xl border-2 focus:border-blue-500"
                                            placeholder="Enter your current password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowCurrentPassword(
                                                    !showCurrentPassword,
                                                )
                                            }
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        >
                                            {showCurrentPassword ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label
                                        htmlFor="new_password"
                                        className="text-gray-700 font-medium"
                                    >
                                        New Password
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="new_password"
                                            type={
                                                showNewPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={passwordData.new_password}
                                            onChange={(e) =>
                                                setPasswordData({
                                                    ...passwordData,
                                                    new_password:
                                                        e.target.value,
                                                })
                                            }
                                            required
                                            className="pr-10 rounded-xl border-2 focus:border-blue-500"
                                            placeholder="Enter new password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowNewPassword(
                                                    !showNewPassword,
                                                )
                                            }
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        >
                                            {showNewPassword ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Password must be at least 8 characters
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label
                                        htmlFor="confirm_password"
                                        className="text-gray-700 font-medium"
                                    >
                                        Confirm New Password
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="confirm_password"
                                            type={
                                                showConfirmPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={
                                                passwordData.confirm_password
                                            }
                                            onChange={(e) =>
                                                setPasswordData({
                                                    ...passwordData,
                                                    confirm_password:
                                                        e.target.value,
                                                })
                                            }
                                            required
                                            className="pr-10 rounded-xl border-2 focus:border-blue-500"
                                            placeholder="Confirm new password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowConfirmPassword(
                                                    !showConfirmPassword,
                                                )
                                            }
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        >
                                            {showConfirmPassword ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="bg-blue-600 hover:bg-blue-700 rounded-xl px-8"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                                                Changing Password...
                                            </>
                                        ) : (
                                            "Update Password"
                                        )}
                                    </Button>
                                </div>
                            </form>

                            {/* ✅ Admin-specific security notice */}
                            {isAdmin && (
                                <Alert className="bg-purple-50 border-purple-200 rounded-xl mt-6">
                                    <Shield className="h-4 w-4 text-purple-600" />
                                    <AlertDescription className="text-purple-800">
                                        <strong className="font-semibold">
                                            Administrator Account Notice:
                                        </strong>{" "}
                                        As an administrator, your account has
                                        full system access. Use a strong,
                                        unique password and never share your
                                        credentials. All your actions are
                                        recorded in the audit log.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {isComelec && (
                                <Alert className="bg-blue-50 border-blue-200 rounded-xl mt-6">
                                    <Shield className="h-4 w-4 text-blue-600" />
                                    <AlertDescription className="text-blue-800">
                                        <strong className="font-semibold">
                                            COMELEC Account Notice:
                                        </strong>{" "}
                                        Your account manages election
                                        operations and candidate approvals.
                                        Keep your credentials secure — all
                                        actions are logged for transparency.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="mt-6 pt-6 border-t">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-blue-600" />{" "}
                                        Password Guidelines
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>{" "}
                                            Use at least 8 characters
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>{" "}
                                            Include uppercase and lowercase
                                            letters
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>{" "}
                                            Include numbers and special
                                            characters
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>{" "}
                                            Avoid common words or personal
                                            information
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>{" "}
                                            Don't reuse passwords from other
                                            accounts
                                        </li>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ProfileSettings;