// resources/js/components/CandidacyApplicationForm.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { candidacyAPI } from "../api/candidacy";
import { electionAPI } from "../api/elections";
import { partylistAPI, Partylist } from "../api/partylists";
import { useAuth } from "../contexts/AuthContext";
import occLogo from "../assets/occlogo.png";
import csgLogo from "../assets/csg.png";
import {
    Loader2,
    CheckCircle,
    AlertCircle,
    Upload,
    ShieldCheck,
    Camera,
    Landmark,
    Flag,
    Users,
    ScrollText,
    Eraser,
    Lock,
    Building2,
    UserPlus,
    Info,
} from "lucide-react";

interface Election {
    election_id: number;
    title: string;
    election_type: string;
    positions?: Array<{
        position_id: number;
        title: string;
        category?: string;
        order_in_ballot?: number;
    }>;
}

interface CandidacyApplicationFormProps {
    electionId?: number;
    electionTitle?: string;
    electionType?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

/**
 * Fields that MUST be present in the user's profile before they can
 * submit a candidacy application.
 */
const REQUIRED_PROFILE_KEYS: Array<{ key: string; label: string }> = [
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "id_no", label: "Student ID" },
    { key: "course", label: "Course" },
    { key: "year_level", label: "Year Level" },
    { key: "birthdate", label: "Birthdate" },
    { key: "present_address", label: "Present Address" },
    { key: "cellphone", label: "Cellphone" },
    { key: "no_unit_load", label: "Number of Unit Load" },
];

/**
 * Course code → department code mapping.
 * Used to auto-fill the "Department" field.
 */
const COURSE_TO_DEPARTMENT: Record<string, string> = {
    BSIT: "CIT",
    BEED: "TED",
    BSBA: "CBA",
};

/** A single underlined blank, styled like a line on a paper form. */
const FormLine: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    type?: string;
    disabled?: boolean;
    readOnly?: boolean;
    className?: string;
}> = ({
    value,
    onChange,
    placeholder,
    required,
    type = "text",
    disabled,
    readOnly,
    className = "",
}) => {
        const isLocked = disabled || readOnly;
        return (
            <div className="relative">
                <input
                    type={type}
                    value={value}
                    disabled={disabled}
                    readOnly={readOnly}
                    onChange={(e) => !isLocked && onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    className={`w-full min-w-0 border-0 border-b ${isLocked
                        ? "border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed pr-7"
                        : "border-gray-400 bg-transparent text-gray-900"
                        } px-1 py-1 text-sm placeholder:text-gray-300 focus:border-blue-600 focus:outline-none focus:ring-0 disabled:border-gray-200 disabled:text-gray-300 ${className}`}
                />
                {readOnly && (
                    <Lock className="absolute right-1 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                )}
            </div>
        );
    };

/** "Label: ____" row, matching the form's "Field: blank" pattern. */
const FieldRow: React.FC<{
    label: string;
    required?: boolean;
    children: React.ReactNode;
}> = ({ label, required, children }) => (
    <div className="flex items-end gap-2">
        <span className="whitespace-nowrap text-sm font-semibold text-gray-800">
            {label}
            {required ? " *" : ""}:
        </span>
        <div className="flex-1">{children}</div>
    </div>
);

/** Small colored icon badge + label, used to give each section its own identity. */
const SectionHeading: React.FC<{
    icon: React.ReactNode;
    color: string;
    children: React.ReactNode;
}> = ({ icon, color, children }) => (
    <div className="flex items-center gap-2">
        <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}
        >
            {icon}
        </span>
        <p className="text-sm font-semibold text-gray-900">{children}</p>
    </div>
);

/** A canvas the applicant can sign with a mouse, trackpad, or finger. */
const SignaturePad: React.FC<{
    value: string;
    onChange: (value: string) => void;
}> = ({ value, onChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const hasStroke = useRef(false);

    useEffect(() => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#1e3a8a";
    }, []);

    const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        isDrawing.current = true;
        const { x, y } = pointerPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current) return;
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        const { x, y } = pointerPos(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        hasStroke.current = true;
    };

    const end = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        if (hasStroke.current && canvasRef.current) {
            onChange(canvasRef.current.toDataURL("image/png"));
        }
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasStroke.current = false;
        onChange("");
    };

    return (
        <div className="flex flex-col items-center gap-1">
            <canvas
                ref={canvasRef}
                width={260}
                height={96}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerLeave={end}
                className="touch-none rounded-lg border-b-2 border-gray-800 bg-blue-50/50 [background-image:linear-gradient(transparent_0,transparent_calc(100%-2px),rgba(30,58,138,0.15)_calc(100%-2px))] cursor-crosshair"
            />
            <button
                type="button"
                onClick={clear}
                className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
            >
                <Eraser className="h-3 w-3" />
                Clear signature
            </button>
        </div>
    );
};

const CandidacyApplicationForm: React.FC<CandidacyApplicationFormProps> = ({
    electionId,
    electionTitle,
    electionType,
    onSuccess,
    onCancel,
}) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [elections, setElections] = useState<Election[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [photoPreview, setPhotoPreview] = useState<string>("");

    const [availablePartylists, setAvailablePartylists] = useState<
        Partylist[]
    >([]);
    const [loadingPartylists, setLoadingPartylists] = useState(false);

    const [formData, setFormData] = useState({
        election_id: electionId?.toString() || "",
        schoolYear: "",
        lastName: "",
        firstName: "",
        middleInitial: "",
        selectedPosition: "",
        course: "",
        currentYear: "",
        age: "",
        studentNo: "",
        noUnitLoad: "",
        cellphone: "",
        socialMedia: "",
        presentAddress: "",
        presentAddress2: "",
        positionCSG: false,
        positionSC: false,
        department: "",

        // Political party modes
        partyIndependent: false,
        partyExisting: false,
        partyCreate: false,
        existing_partylist_id: "",
        newPartyName: "",
        newPartyDescription: "",

        platform: "",
        qualifications: "",
        aff1Org: "",
        aff1Pos: "",
        aff1Date: "",
        aff2Org: "",
        aff2Pos: "",
        aff2Date: "",
        aff3Org: "",
        aff3Pos: "",
        aff3Date: "",
        signedDay: "",
        signedMonth: "",
        signedYear: "",
        photo: "",
        signature: "",
    });

    // ✅ Determine the election type — use prop if provided, otherwise look it up
    const currentElectionType = useMemo(() => {
        if (electionType) return electionType;
        const found = elections.find(
            (e) => e.election_id.toString() === formData.election_id,
        );
        return found?.election_type || "";
    }, [electionType, elections, formData.election_id]);

    // ✅ Auto-fill user details when component mounts or user changes
    useEffect(() => {
        if (user) {
            const firstName = user.first_name || "";
            const lastName = user.last_name || "";

            let courseValue = "";
            if (user.course) {
                if (
                    typeof user.course === "object" &&
                    "course_code" in user.course
                ) {
                    courseValue = user.course.course_code || "";
                } else if (typeof user.course === "string") {
                    courseValue = user.course;
                }
            }

            // ✅ Derive department from course code
            const department = courseValue
                ? COURSE_TO_DEPARTMENT[courseValue.toUpperCase()] || ""
                : "";

            const yearLevel = user.year_level ? String(user.year_level) : "";

            setFormData((prev) => ({
                ...prev,
                firstName: prev.firstName || firstName,
                lastName: prev.lastName || lastName,
                studentNo: prev.studentNo || user.id_no || "",
                course: prev.course || courseValue,
                currentYear: prev.currentYear || yearLevel,
                age: prev.age || (user.age ? String(user.age) : ""),
                presentAddress:
                    prev.presentAddress || user.present_address || "",
                presentAddress2:
                    prev.presentAddress2 || user.present_address_2 || "",
                noUnitLoad:
                    prev.noUnitLoad ||
                    (user.no_unit_load ? String(user.no_unit_load) : ""),
                cellphone: prev.cellphone || user.cellphone || "",
                socialMedia: prev.socialMedia || user.social_media || "",
                department: prev.department || department,
            }));

            if (user.profile_photo) {
                const photoUrl = user.profile_photo.startsWith("http")
                    ? user.profile_photo
                    : `http://localhost:8000${user.profile_photo}`;
                setPhotoPreview(photoUrl);
                setFormData((prev) => ({
                    ...prev,
                    photo: user.profile_photo || "",
                }));
            }
        }
    }, [user]);

    // ✅ Auto-check the organization based on the election type
    useEffect(() => {
        if (!currentElectionType) return;
        if (currentElectionType === "CSG") {
            setFormData((prev) => ({
                ...prev,
                positionCSG: true,
                positionSC: false,
            }));
        } else if (currentElectionType === "SBO") {
            setFormData((prev) => ({
                ...prev,
                positionCSG: false,
                positionSC: true,
            }));
        }
    }, [currentElectionType]);

    useEffect(() => {
        if (!electionId) {
            fetchElections();
        }

        const today = new Date();
        setFormData((prev) => ({
            ...prev,
            signedDay: prev.signedDay || String(today.getDate()),
            signedMonth:
                prev.signedMonth ||
                today.toLocaleString("default", { month: "long" }),
            signedYear:
                prev.signedYear || String(today.getFullYear()).slice(-2),
        }));
    }, []);

    useEffect(() => {
        if (formData.election_id) {
            fetchPositions(formData.election_id);
            fetchPartylists(formData.election_id);
        }
    }, [formData.election_id]);

    const fetchElections = async () => {
        try {
            const response = await electionAPI.getAll();
            const data = Array.isArray(response.data) ? response.data : [];
            setElections(data);
        } catch (error) {
            console.error("Failed to fetch elections:", error);
        }
    };

    const fetchPositions = async (electionId: string) => {
        try {
            const response = await electionAPI.getById(electionId);
            const data = response.data;
            const positionsData =
                data?.positions || data?.data?.positions || [];
            const sorted = [...positionsData].sort(
                (a: any, b: any) =>
                    (a.order_in_ballot ?? 999) - (b.order_in_ballot ?? 999),
            );
            setPositions(sorted);
        } catch (error) {
            console.error("Failed to fetch positions:", error);
            setPositions([]);
        }
    };

    const fetchPartylists = async (electionId: string) => {
        setLoadingPartylists(true);
        try {
            const response = await partylistAPI.getByElection(electionId);
            let partylistsData: Partylist[] = [];
            if (response.data?.data) {
                partylistsData = response.data.data;
            } else if (Array.isArray(response.data)) {
                partylistsData = response.data;
            }
            setAvailablePartylists(partylistsData);
        } catch (error) {
            console.error("Failed to fetch partylists:", error);
            setAvailablePartylists([]);
        } finally {
            setLoadingPartylists(false);
        }
    };

    const handleChange = (field: string, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setError("");
    };

    // ✅ Organization checkbox is now read-only — no toggle handler.
    // Position still selects the specific title inside the checked org.

    const isHighestPositionSelected = useMemo(() => {
        if (!formData.selectedPosition || positions.length === 0) return false;
        const topPosition = positions[0];
        return topPosition?.title === formData.selectedPosition;
    }, [formData.selectedPosition, positions]);

    const handlePartyModeToggle = (
        mode: "Independent" | "Existing" | "Create",
    ) => {
        setFormData((prev) => {
            const next = {
                ...prev,
                partyIndependent: mode === "Independent",
                partyExisting: mode === "Existing",
                partyCreate: mode === "Create",
            };
            if (mode !== "Existing") next.existing_partylist_id = "";
            if (mode !== "Create") {
                next.newPartyName = "";
                next.newPartyDescription = "";
            }
            return next;
        });
        setError("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        console.log("🐛 Submit check:", {
            partyCreate: formData.partyCreate,
            newPartyName: formData.newPartyName,
            newPartyNameLength: formData.newPartyName?.length,
            typeofNewPartyName: typeof formData.newPartyName,
            isHighestPositionSelected,
        });

        if (!formData.election_id) {
            setError("Please select an election");
            return;
        }

        if (!formData.selectedPosition) {
            setError("Please select a position");
            return;
        }

        if (!formData.positionCSG && !formData.positionSC) {
            setError("Please select an organization");
            return;
        }

        if (!formData.lastName.trim() || !formData.firstName.trim()) {
            setError("Please provide your full name");
            return;
        }

        if (
            !formData.partyIndependent &&
            !formData.partyExisting &&
            !formData.partyCreate
        ) {
            setError("Please select a political party affiliation");
            return;
        }

        if (formData.partyExisting && !formData.existing_partylist_id) {
            setError("Please select an existing political party");
            return;
        }

        if (formData.partyCreate) {
            if (!isHighestPositionSelected) {
                setError(
                    "Only candidates running for the highest position can create a new political party.",
                );
                return;
            }
            if (!formData.newPartyName.trim()) {
                setError("Please enter a name for your new political party");
                return;
            }
        }

        if (!formData.platform.trim()) {
            setError("Please provide your campaign platform");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const payload: any = {
                ...formData,
                selected_partylist_id: formData.partyExisting
                    ? parseInt(formData.existing_partylist_id)
                    : null,
                create_new_party: formData.partyCreate,
                new_party_name: formData.partyCreate
                    ? formData.newPartyName
                    : null,
                new_party_description: formData.partyCreate
                    ? formData.newPartyDescription
                    : null,
            };

            await candidacyAPI.apply(
                parseInt(formData.election_id),
                payload,
            );
            setSuccess(
                "Application submitted successfully! You will be notified once it's reviewed.",
            );
            if (onSuccess) {
                setTimeout(onSuccess, 2000);
            }


        } catch (err: any) {
            setError(
                err.response?.data?.message ||
                "Failed to submit application. Please try again.",
            );
        } finally {
            setLoading(false);
        }
    };

    const underlineTrigger =
        "h-8 w-full rounded-none border-0 border-b border-gray-400 bg-transparent px-1 shadow-none focus:ring-0";

    const missingProfileKeys = user
        ? REQUIRED_PROFILE_KEYS.filter(({ key }) => {
            const value = (user as any)[key];
            if (value === null || value === undefined) return true;
            if (typeof value === "string" && value.trim() === "")
                return true;
            if (
                key === "course" &&
                typeof value === "object" &&
                !(value as any).course_code
            ) {
                return true;
            }
            return false;
        })
        : REQUIRED_PROFILE_KEYS;

    if (missingProfileKeys.length > 0) {
        return (
            <div className="mx-auto max-w-xl">
                <Alert variant="destructive" className="rounded-2xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        <p className="font-semibold mb-2">
                            Your profile is incomplete.
                        </p>
                        <p className="text-sm mb-2">
                            Please complete the following in your profile
                            before applying:
                        </p>
                        <ul className="list-disc pl-5 text-sm space-y-0.5">
                            {missingProfileKeys.map((f) => (
                                <li key={f.key}>{f.label}</li>
                            ))}
                        </ul>
                        <Button
                            onClick={() =>
                                (window.location.href = "/profile")
                            }
                            className="mt-4 bg-blue-600 hover:bg-blue-700 rounded-xl"
                        >
                            Go to Profile Settings
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-5">
            {success && (
                <Alert className="rounded-xl border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-600">
                        {success}
                    </AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive" className="rounded-xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {!electionId ? (
                <div className="space-y-2">
                    <Label>Select Election *</Label>
                    <Select
                        value={formData.election_id}
                        onValueChange={(value) =>
                            handleChange("election_id", value)
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select an election" />
                        </SelectTrigger>
                        <SelectContent>
                            {elections.map((election) => (
                                <SelectItem
                                    key={election.election_id}
                                    value={election.election_id.toString()}
                                >
                                    {election.title} ({election.election_type})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ) : (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Applying for</span>
                    <span className="font-semibold text-gray-900">
                        {electionTitle}
                    </span>
                    <Badge variant="secondary">{electionType}</Badge>
                </div>
            )}

            {/* ---- Official document ---- */}
            <div className="overflow-hidden rounded-2xl border border-blue-900/20 bg-white text-gray-900 shadow-xl">
                <div className="h-2 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700" />
                <div className="p-5 sm:p-8">
                    {/* Letterhead */}
                    <div className="mb-6 grid grid-cols-1 overflow-hidden rounded-xl border-2 border-blue-900 sm:grid-cols-[1fr_auto]">
                        <div className="flex items-center gap-3 border-b-2 border-blue-900 bg-gradient-to-br from-blue-50 to-white p-3 sm:border-b-0 sm:border-r-2">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden bg-white">
                                <img
                                    src={occLogo}
                                    alt="Opol Community College logo"
                                    className="h-full w-full object-contain p-1"
                                />
                            </div>
                            <div className="flex-1 text-center leading-tight">
                                <p className="text-xs font-semibold text-blue-900">
                                    Republic of the Philippines
                                </p>
                                <p className="text-base font-bold text-gray-900">
                                    Opol Community College
                                </p>
                                <p className="text-xs text-gray-600">
                                    Opol, Misamis Oriental
                                </p>
                            </div>
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
                                <img
                                    src={csgLogo}
                                    alt="Central Student Government seal"
                                    className="h-full w-full object-contain"
                                />
                            </div>
                        </div>
                        <div className="flex min-w-[220px] flex-col justify-center gap-2 bg-blue-900 p-3 text-center text-white">
                            <p className="text-sm font-bold tracking-wide">
                                APPLICATION FOR CANDIDACY
                            </p>
                            <div className="flex items-center justify-center gap-2 text-xs">
                                <span className="whitespace-nowrap font-semibold">
                                    SCHOOL YEAR
                                </span>
                                <input
                                    type="text"
                                    value={formData.schoolYear}
                                    onChange={(e) =>
                                        handleChange(
                                            "schoolYear",
                                            e.target.value,
                                        )
                                    }
                                    placeholder="2026-2027"
                                    className="w-24 border-0 border-b border-blue-300 bg-transparent px-1 py-0.5 text-center text-white placeholder:text-blue-300 focus:border-white focus:outline-none focus:ring-0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Name + photo */}
                    <div className="flex flex-col gap-6 sm:flex-row">
                        <div className="flex-1 space-y-4">
                            <div>
                                <span className="text-sm font-semibold">
                                    Name:
                                </span>
                                <div className="mt-1 grid grid-cols-3 gap-3">
                                    <div>
                                        <FormLine
                                            value={formData.lastName}
                                            onChange={(v) =>
                                                handleChange("lastName", v)
                                            }
                                            required
                                            readOnly
                                        />
                                        <p className="mt-0.5 text-center text-[11px] italic text-gray-500">
                                            Last Name
                                        </p>
                                    </div>
                                    <div>
                                        <FormLine
                                            value={formData.firstName}
                                            onChange={(v) =>
                                                handleChange("firstName", v)
                                            }
                                            required
                                            readOnly
                                        />
                                        <p className="mt-0.5 text-center text-[11px] italic text-gray-500">
                                            First Name
                                        </p>
                                    </div>
                                    <div>
                                        <FormLine
                                            value={formData.middleInitial}
                                            onChange={(v) =>
                                                handleChange("middleInitial", v)
                                            }
                                        />
                                        <p className="mt-0.5 text-center text-[11px] italic text-gray-500">
                                            M.I.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <FieldRow label="Age" required>
                                <FormLine
                                    type="number"
                                    value={formData.age}
                                    onChange={(v) => handleChange("age", v)}
                                    required
                                    readOnly
                                />
                            </FieldRow>
                            <FieldRow label="Course" required>
                                <FormLine
                                    value={formData.course}
                                    onChange={(v) => handleChange("course", v)}
                                    placeholder="e.g., BSIT"
                                    required
                                    readOnly
                                />
                            </FieldRow>
                            <FieldRow label="Present Address" required>
                                <FormLine
                                    value={formData.presentAddress}
                                    onChange={(v) =>
                                        handleChange("presentAddress", v)
                                    }
                                    required
                                    readOnly
                                />
                            </FieldRow>
                            <div className="pl-0 sm:pl-[9.5rem]">
                                <FormLine
                                    value={formData.presentAddress2}
                                    onChange={(v) =>
                                        handleChange("presentAddress2", v)
                                    }
                                    readOnly
                                />
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-1 self-start">
                            <div className="group flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-amber-400 bg-amber-50">
                                {photoPreview ? (
                                    <img
                                        src={photoPreview}
                                        alt="2x2 applicant photo"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="flex flex-col items-center gap-1 px-2 text-center text-xs text-amber-700">
                                        <Camera className="h-6 w-6 text-amber-500" />
                                        2 X 2 Photo
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] text-center text-gray-500 max-w-[9rem] leading-tight">
                                Photo from face registration
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-4">
                        <FieldRow label="Student No." required>
                            <FormLine
                                value={formData.studentNo}
                                onChange={(v) =>
                                    handleChange("studentNo", v)
                                }
                                required
                                readOnly
                            />
                        </FieldRow>

                        <FieldRow label="Current Year" required>
                            <FormLine
                                value={formData.currentYear}
                                onChange={(v) =>
                                    handleChange("currentYear", v)
                                }
                                placeholder="e.g., 1"
                                required
                                readOnly
                            />
                        </FieldRow>

                        <FieldRow label="No. Unit Load" required>
                            <FormLine
                                type="number"
                                value={formData.noUnitLoad}
                                onChange={(v) =>
                                    handleChange("noUnitLoad", v)
                                }
                                required
                                readOnly
                            />
                        </FieldRow>
                        <FieldRow label="Cellphone" required>
                            <FormLine
                                value={formData.cellphone}
                                onChange={(v) =>
                                    handleChange("cellphone", v)
                                }
                                placeholder="09XXXXXXXXX"
                                required
                                readOnly
                            />
                        </FieldRow>
                        <FieldRow label="Social Media Account">
                            <FormLine
                                value={formData.socialMedia}
                                onChange={(v) =>
                                    handleChange("socialMedia", v)
                                }
                                placeholder="Facebook profile link"
                                readOnly
                            />
                        </FieldRow>
                    </div>

                    {/* Position applied for — org auto-checked by election type */}
                    <div className="mt-6 space-y-3 rounded-xl bg-blue-50/60 p-4">
                        <SectionHeading
                            icon={
                                <Landmark className="h-3.5 w-3.5 text-blue-700" />
                            }
                            color="bg-blue-100"
                        >
                            Position applied for
                        </SectionHeading>

                        <p className="pl-4 text-xs text-gray-500 flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            The organization is auto-selected based on the
                            election type.
                        </p>

                        <label
                            className={`flex items-center gap-2 pl-4 ${currentElectionType === "CSG"
                                ? ""
                                : "opacity-60 cursor-not-allowed"
                                }`}
                        >
                            <Checkbox
                                checked={formData.positionCSG}
                                disabled
                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                            <span className="w-56 shrink-0 text-sm">
                                Central Student Government
                            </span>
                            {formData.positionCSG ? (
                                <div className="flex-1">
                                    <Select
                                        value={formData.selectedPosition}
                                        onValueChange={(value) =>
                                            handleChange(
                                                "selectedPosition",
                                                value,
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            className={underlineTrigger}
                                        >
                                            <SelectValue placeholder="Select a position" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {positions.map((position) => (
                                                <SelectItem
                                                    key={position.position_id}
                                                    value={position.title}
                                                >
                                                    {position.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="flex-1 border-b border-gray-400" />
                            )}
                        </label>

                        <label
                            className={`flex items-center gap-2 pl-4 ${currentElectionType === "SBO"
                                ? ""
                                : "opacity-60 cursor-not-allowed"
                                }`}
                        >
                            <Checkbox
                                checked={formData.positionSC}
                                disabled
                                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                            <span className="w-56 shrink-0 text-sm">
                                Student Council
                            </span>
                            {formData.positionSC ? (
                                <div className="flex-1">
                                    <Select
                                        value={formData.selectedPosition}
                                        onValueChange={(value) =>
                                            handleChange(
                                                "selectedPosition",
                                                value,
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            className={underlineTrigger}
                                        >
                                            <SelectValue placeholder="Select a position" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {positions.map((position) => (
                                                <SelectItem
                                                    key={position.position_id}
                                                    value={position.title}
                                                >
                                                    {position.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="flex-1 border-b border-gray-400" />
                            )}
                        </label>

                        {/* ✅ Department — auto-filled from course, read-only */}
                        <div className="flex items-end gap-2 pl-10">
                            <span className="whitespace-nowrap text-sm">
                                Department
                            </span>
                            <FormLine
                                value={formData.department}
                                onChange={(v) =>
                                    handleChange("department", v)
                                }
                                placeholder="Auto-filled"
                                readOnly
                            />
                        </div>
                    </div>

                    {/* Political party */}
                    <div className="mt-4 space-y-3 rounded-xl bg-blue-50/60 p-4">
                        <SectionHeading
                            icon={<Flag className="h-3.5 w-3.5 text-blue-700" />}
                            color="bg-blue-100"
                        >
                            Political Party Affiliation
                        </SectionHeading>

                        <p className="pl-4 text-xs text-gray-500 flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            Select only one option.
                        </p>

                        <label className="flex items-center gap-2 pl-4 cursor-pointer">
                            <Checkbox
                                checked={formData.partyIndependent}
                                onCheckedChange={() =>
                                    handlePartyModeToggle("Independent")
                                }
                            />
                            <span className="text-sm">Independent</span>
                        </label>

                        <div className="pl-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                    checked={formData.partyExisting}
                                    onCheckedChange={() =>
                                        handlePartyModeToggle("Existing")
                                    }
                                />
                                <span className="text-sm">
                                    Join an Existing Political Party
                                </span>
                            </label>

                            {formData.partyExisting && (
                                <div className="mt-2 ml-6">
                                    {loadingPartylists ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading partylists...
                                        </div>
                                    ) : availablePartylists.length === 0 ? (
                                        <p className="text-xs text-amber-600 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            No existing partylists for this
                                            election yet.
                                        </p>
                                    ) : (
                                        <Select
                                            value={
                                                formData.existing_partylist_id
                                            }
                                            onValueChange={(value) =>
                                                handleChange(
                                                    "existing_partylist_id",
                                                    value,
                                                )
                                            }
                                        >
                                            <SelectTrigger className="w-full max-w-sm rounded-xl">
                                                <SelectValue placeholder="Select a political party" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availablePartylists.map(
                                                    (party) => (
                                                        <SelectItem
                                                            key={
                                                                party.partylist_id
                                                            }
                                                            value={party.partylist_id.toString()}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Building2 className="w-3.5 h-3.5 text-purple-500" />
                                                                {party.name}
                                                            </div>
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="pl-4">
                            <label
                                className={`flex items-center gap-2 ${!isHighestPositionSelected
                                    ? "opacity-50 cursor-not-allowed"
                                    : "cursor-pointer"
                                    }`}
                            >
                                <Checkbox
                                    checked={formData.partyCreate}
                                    onCheckedChange={() =>
                                        isHighestPositionSelected &&
                                        handlePartyModeToggle("Create")
                                    }
                                    disabled={!isHighestPositionSelected}
                                />
                                <span className="text-sm flex items-center gap-1">
                                    <UserPlus className="w-3.5 h-3.5" />
                                    Create a New Political Party
                                </span>
                            </label>

                            {!isHighestPositionSelected && (
                                <p className="mt-1 ml-6 text-xs text-gray-500">
                                    Only candidates running for the{" "}
                                    <strong>
                                        {positions[0]?.title ||
                                            "highest position"}
                                    </strong>{" "}
                                    can create a new political party.
                                </p>
                            )}

                            {formData.partyCreate &&
                                isHighestPositionSelected && (
                                    <div className="mt-2 ml-6 space-y-2 max-w-sm">
                                        <div>
                                            <Label className="text-xs font-semibold">
                                                Party Name *
                                            </Label>
                                            <FormLine
                                                value={formData.newPartyName}
                                                onChange={(v) =>
                                                    handleChange(
                                                        "newPartyName",
                                                        v,
                                                    )
                                                }
                                                placeholder="e.g., Progressive Youth Party"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs font-semibold">
                                                Description (optional)
                                            </Label>
                                            <Textarea
                                                value={
                                                    formData.newPartyDescription
                                                }
                                                onChange={(e) =>
                                                    handleChange(
                                                        "newPartyDescription",
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Brief description of your party's platform"
                                                rows={2}
                                                className="resize-none text-sm"
                                            />
                                        </div>
                                    </div>
                                )}
                        </div>
                    </div>

                    {/* Present affiliation — with date input */}
                    <div className="mt-4 space-y-2 rounded-xl bg-blue-50/60 p-4">
                        <SectionHeading
                            icon={
                                <Users className="h-3.5 w-3.5 text-blue-700" />
                            }
                            color="bg-blue-100"
                        >
                            Present Affiliation
                        </SectionHeading>
                        <div className="grid grid-cols-[auto_1fr_1fr_1.2fr] gap-x-3 gap-y-2 text-sm">
                            <span />
                            <span className="text-xs font-semibold">
                                Organization
                            </span>
                            <span className="text-xs font-semibold">
                                Position
                            </span>
                            <span className="text-xs font-semibold">
                                Date of Membership
                            </span>
                            {[1, 2, 3].map((n) => (
                                <React.Fragment key={n}>
                                    <span className="self-end pb-1">{n}</span>
                                    <FormLine
                                        value={
                                            formData[
                                            `aff${n}Org` as keyof typeof formData
                                            ] as string
                                        }
                                        onChange={(v) =>
                                            handleChange(`aff${n}Org`, v)
                                        }
                                        placeholder="Organization name"
                                    />
                                    <FormLine
                                        value={
                                            formData[
                                            `aff${n}Pos` as keyof typeof formData
                                            ] as string
                                        }
                                        onChange={(v) =>
                                            handleChange(`aff${n}Pos`, v)
                                        }
                                        placeholder="Position held"
                                    />
                                    {/* ✅ Date of Membership — full date picker */}
                                    <div className="relative">
                                        <input
                                            type="date"
                                            value={
                                                formData[
                                                `aff${n}Date` as keyof typeof formData
                                                ] as string
                                            }
                                            onChange={(e) =>
                                                handleChange(
                                                    `aff${n}Date`,
                                                    e.target.value,
                                                )
                                            }
                                            max={
                                                new Date()
                                                    .toISOString()
                                                    .split("T")[0]
                                            }
                                            className="w-full min-w-0 border-0 border-b border-gray-400 bg-transparent px-1 py-1 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-0"
                                        />
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* Declaration */}
                    <div className="mt-4 space-y-2 rounded-xl bg-blue-50/60 p-4 text-sm">
                        <SectionHeading
                            icon={
                                <ShieldCheck className="h-3.5 w-3.5 text-blue-700" />
                            }
                            color="bg-blue-100"
                        >
                            Declaration
                        </SectionHeading>
                        <p>I further declare the following:</p>
                        <ul className="list-disc space-y-1 pl-6 text-gray-800">
                            <li>
                                I am a bona fide student of Opol Community
                                College.
                            </li>
                            <li>
                                I am willing to perform the duties and
                                responsibilities of the position I am applying
                                for.
                            </li>
                            <li>
                                All information provided in this application is
                                true and correct.
                            </li>
                        </ul>
                    </div>

                    {/* Signing line */}
                    <div className="mt-4 overflow-x-auto">
                        <div className="flex w-max min-w-full items-center gap-1.5 whitespace-nowrap text-sm">
                            <span>Signed on this</span>
                            <span className="shrink-0 border-b border-gray-400 px-1 text-center font-medium text-gray-900">
                                {formData.signedDay}
                            </span>
                            <span>day of</span>
                            <span className="shrink-0 border-b border-gray-400 px-1 text-center font-medium text-gray-900">
                                {formData.signedMonth}
                            </span>
                            <span>20</span>
                            <span className="shrink-0 border-b border-gray-400 px-1 text-center font-medium text-gray-900">
                                {formData.signedYear}
                            </span>
                            <span>
                                at Opol Community College, Opol, Misamis
                                Oriental.
                            </span>
                        </div>
                    </div>

                    <div className="mt-10 flex justify-end">
                        <div className="flex flex-col items-center gap-1">
                            <SignaturePad
                                value={formData.signature}
                                onChange={(v) =>
                                    handleChange("signature", v)
                                }
                            />
                            <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                                <ScrollText className="h-3 w-3" />
                                Signature of Applicant
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Platform & qualifications */}
            <div className="space-y-4 rounded-xl border p-5">
                <h3 className="text-sm font-semibold text-gray-900">
                    Campaign Platform & Qualifications
                </h3>
                <div className="space-y-2">
                    <Label>Campaign Platform *</Label>
                    <Textarea
                        value={formData.platform}
                        onChange={(e) =>
                            handleChange("platform", e.target.value)
                        }
                        placeholder="Describe your platform and goals..."
                        rows={4}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label>Qualifications & Achievements *</Label>
                    <Textarea
                        value={formData.qualifications}
                        onChange={(e) =>
                            handleChange("qualifications", e.target.value)
                        }
                        placeholder="List your qualifications, achievements, and experience..."
                        rows={4}
                        required
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
                {onCancel && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        className="rounded-xl"
                    >
                        Cancel
                    </Button>
                )}
                <Button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg"
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        <>
                            <Upload className="mr-2 h-4 w-4" />
                            Submit Application
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
};

export default CandidacyApplicationForm;