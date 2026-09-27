// resources/js/pages/Admin/ImportVoters.tsx
import React, { useState, useRef, useCallback } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { adminAPI } from "../api/admin";
import {
    Upload,
    Download,
    FileSpreadsheet,
    CheckCircle,
    AlertCircle,
    Loader2,
    Info,
    Users,
    UserPlus,
    RefreshCw,
    XCircle,
    Clock,
    X,
} from "lucide-react";

interface ImportResult {
    message?: string;
    imported_count?: number;
    updated_count?: number;
    skipped_rows?: string[];
    errors?: Array<{ errors: Record<string, string[]> }>;
    queued?: boolean;
}

const ACCEPTED_EXTENSIONS = [".xlsx", ".csv", ".xls"];
const ACCEPTED_MIME =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";
const MAX_SIZE_MB = 20;

const ImportVoters: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState("");
    const [isDragging, setIsDragging] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);

    // ---------------- File validation ----------------
    const validateFile = (f: File): string | null => {
        const name = f.name.toLowerCase();
        const hasValidExt = ACCEPTED_EXTENSIONS.some((ext) =>
            name.endsWith(ext),
        );
        if (!hasValidExt) {
            return "Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file.";
        }
        if (f.size > MAX_SIZE_MB * 1024 * 1024) {
            return `File is too large. Maximum size is ${MAX_SIZE_MB}MB.`;
        }
        return null;
    };

    const applyFile = (f: File | null | undefined) => {
        if (!f) return;
        const err = validateFile(f);
        if (err) {
            setError(err);
            setFile(null);
            return;
        }
        setFile(f);
        setError("");
        setResult(null);
    };

    // ---------------- Click-to-browse ----------------
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        applyFile(selected);
        // Reset so picking the same file twice still fires onChange
        e.target.value = "";
    };

    // ---------------- Drag & drop ----------------
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer?.items?.length) {
            setIsDragging(true);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        // Required — without preventDefault, onDrop never fires.
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "copy";
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Use a counter so leaving a child element doesn't kill the drag state.
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDragging(false);

        const dropped = e.dataTransfer?.files?.[0];
        if (dropped) {
            applyFile(dropped);
        }
    }, []);

    // ---------------- Import ----------------
    const handleImport = async () => {
        if (!file) {
            setError("Please select a file to upload.");
            return;
        }

        setUploading(true);
        setError("");
        setResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await adminAPI.importVoters(formData);
            setResult(response.data);
        } catch (err: any) {
            console.error("Import error:", err);
            setError(
                err.response?.data?.message || "Failed to queue import",
            );
        } finally {
            setUploading(false);
        }
    };

    const clearFile = () => {
        setFile(null);
        setError("");
        setResult(null);
        if (inputRef.current) inputRef.current.value = "";
    };

    const downloadTemplate = (): void => {
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
            "2023-1-05521,ABEJO,EITH CLAIRE,BULALAHOS,eithclaire5276@gmail.com,TED",
            "2026-1-08563,ABAYON,MAE ANN,,occ.abayon.maeann2354@gmail.com,CBA",
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

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const isQueued = result?.queued === true;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Import Voters
                </h1>
                <p className="text-gray-600">
                    Bulk import voters from the registrar's Excel or CSV file
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-blue-600" />
                        Import Instructions
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                        <li>Download the template below (registrar format)</li>
                        <li>
                            Columns must be:{" "}
                            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                                ID Number, Last Name, First Name, Middle Name,
                                Email, Department
                            </code>
                        </li>
                        <li>
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
                        </li>
                        <li>
                            Middle Name may be blank (empty, "N/A", "NULL", or
                            "-" accepted)
                        </li>
                        <li>
                            Year Level is left blank — students set it in their
                            profile
                        </li>
                        <li>
                            Voters are added to the global user list. No
                            election needs to be selected.
                        </li>
                    </ol>
                    <Button
                        variant="outline"
                        onClick={downloadTemplate}
                        className="gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Download Template
                    </Button>
                </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800 space-y-1">
                            <p className="font-semibold">
                                How voter eligibility works now
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                                <li>
                                    Imports create or update user accounts —
                                    no registry required
                                </li>
                                <li>
                                    <strong>CSG elections</strong> — all active
                                    voters are eligible automatically
                                </li>
                                <li>
                                    <strong>SBO elections</strong> — only
                                    voters from the matching course are
                                    eligible
                                </li>
                                <li>
                                    You'll receive a notification when the
                                    import finishes
                                </li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Upload File</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* ============ DROP ZONE ============ */}
                    <div
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                inputRef.current?.click();
                            }
                        }}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${isDragging
                            ? "border-blue-500 bg-blue-50 scale-[1.01]"
                            : "border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50"
                            }`}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            accept={`${ACCEPTED_EXTENSIONS.join(",")},${ACCEPTED_MIME}`}
                            onChange={handleFileChange}
                            className="hidden"
                            id="voter-import-file"
                        />

                        <FileSpreadsheet
                            className={`w-12 h-12 mx-auto mb-3 transition-colors ${isDragging ? "text-blue-500" : "text-gray-400"
                                }`}
                        />
                        {isDragging ? (
                            <>
                                <p className="text-blue-600 font-semibold text-base">
                                    Drop file to upload
                                </p>
                                <p className="text-sm text-blue-500 mt-1">
                                    Release to attach the file
                                </p>
                            </>
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

                    {/* ============ SELECTED FILE CHIP ============ */}
                    {file && (
                        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm truncate">
                                    {file.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {formatSize(file.size)} • ready to import
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearFile();
                                }}
                                className="p-1.5 rounded-lg hover:bg-green-100 text-gray-500 hover:text-red-500 transition-colors"
                                aria-label="Remove selected file"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* ============ ERROR ============ */}
                    {error && (
                        <Alert variant="destructive" className="rounded-xl">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* ============ SUCCESS ============ */}
                    {result && isQueued && (
                        <Alert className="bg-blue-50 border-blue-200 rounded-xl">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
                                <p className="font-semibold mb-1">
                                    Import queued!
                                </p>
                                <p>
                                    {result.message ||
                                        "Your file is being processed in the background. You will receive a notification when it completes."}
                                </p>
                            </AlertDescription>
                        </Alert>
                    )}

                    {result && !isQueued && (
                        <Alert className="bg-green-50 border-green-200 rounded-xl">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-600">
                                <p className="font-semibold mb-2">
                                    {result.message ||
                                        "Import completed successfully."}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {result.imported_count !== undefined && (
                                        <Badge className="bg-blue-100 text-blue-700 border-0">
                                            <UserPlus className="w-3 h-3 mr-1" />
                                            {result.imported_count} new user(s)
                                        </Badge>
                                    )}
                                    {result.updated_count !== undefined && (
                                        <Badge className="bg-yellow-100 text-yellow-700 border-0">
                                            <RefreshCw className="w-3 h-3 mr-1" />
                                            {result.updated_count} updated
                                        </Badge>
                                    )}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* ============ ACTIONS ============ */}
                    <div className="flex gap-3">
                        <Button
                            onClick={handleImport}
                            disabled={!file || uploading}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Queue Import
                                </>
                            )}
                        </Button>
                        {file && !uploading && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={clearFile}
                                className="rounded-xl"
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ============ SKIPPED ROWS ============ */}
            {result?.skipped_rows && result.skipped_rows.length > 0 && (
                <Card className="border-yellow-200 bg-yellow-50">
                    <CardHeader>
                        <CardTitle className="text-yellow-700 flex items-center gap-2">
                            <XCircle className="w-5 h-5" />
                            Skipped Rows ({result.skipped_rows.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {result.skipped_rows.map((rowError, index) => (
                                <div
                                    key={index}
                                    className="text-sm p-2 bg-white rounded border border-yellow-200"
                                >
                                    <p className="font-mono text-yellow-800">
                                        {rowError}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default ImportVoters;