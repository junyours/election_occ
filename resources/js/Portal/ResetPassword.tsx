// resources/js/pages/Portal/ResetPassword.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert, AlertDescription } from "../components/ui/alert";
import { authAPI } from "../api/auth";
import {
    Lock,
    Eye,
    EyeOff,
    Loader2,
    CheckCircle,
    AlertCircle,
    ArrowLeft,
    Shield,
    Check,
    X,
} from "lucide-react";
import occLogo from "../assets/occlogo.png";

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [token, setToken] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [countdown, setCountdown] = useState(3);

    // Parse URL params on mount
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tokenParam = params.get("token");
        const emailParam = params.get("email");

        if (tokenParam && emailParam) {
            setToken(tokenParam);
            setEmail(emailParam);
        } else {
            setError(
                "This reset link is invalid or incomplete. Please request a new password reset email.",
            );
        }
    }, [location]);

    // Live password strength requirements
    const passwordChecks = useMemo(
        () => ({
            length: password.length >= 8,
            hasNumber: /\d/.test(password),
            hasLetter: /[a-zA-Z]/.test(password),
        }),
        [password],
    );

    const allChecksPass =
        passwordChecks.length &&
        passwordChecks.hasNumber &&
        passwordChecks.hasLetter;

    const passwordsMatch =
        password.length > 0 && password === confirmPassword;

    // Success countdown → redirect to portal
    useEffect(() => {
        if (!success) return;
        if (countdown <= 0) {
            navigate("/");
            return;
        }
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [success, countdown, navigate]);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setError("");

        // Client-side guards
        if (!token || !email) {
            setError("Missing reset token or email. Please request a new link.");
            return;
        }
        if (!allChecksPass) {
            setError(
                "Password must be at least 8 characters and contain both letters and numbers.",
            );
            return;
        }
        if (!passwordsMatch) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        setSuccess("");

        try {
            const response = await authAPI.resetPassword({
                email,
                token,
                password,
                password_confirmation: confirmPassword,
            });

            const message =
                response.data?.message ||
                "Password reset successfully! Redirecting to login...";

            setSuccess(message);
            setPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            const message =
                err.response?.data?.message ||
                err.response?.data?.error ||
                "Failed to reset password. Please try again.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-blue-50 py-12 px-4">
            <Card className="max-w-md w-full shadow-xl rounded-2xl overflow-hidden border-0">
                <CardHeader className="text-center bg-blue-600 text-white">
                    <div className="mx-auto w-16 h-16 rounded-full overflow-hidden shadow-md mb-4 ring-4 ring-white/30">
                        <img
                            src={occLogo}
                            alt="OCC Logo"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <CardTitle className="text-2xl text-white flex items-center justify-center gap-2">
                        <Shield className="w-5 h-5" />
                        Reset Password
                    </CardTitle>
                    <p className="text-blue-100 mt-2 text-sm">
                        Choose a new strong password for your account.
                    </p>
                </CardHeader>

                <CardContent className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {success && (
                            <Alert className="bg-green-50 border-green-200 rounded-xl">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-700">
                                    <p className="font-semibold">
                                        {success}
                                    </p>
                                    <p className="text-sm mt-1">
                                        Redirecting to login in {countdown}s...
                                    </p>
                                </AlertDescription>
                            </Alert>
                        )}

                        {error && (
                            <Alert
                                variant="destructive"
                                className="rounded-xl"
                            >
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* Email (read-only display) */}
                        {email && (
                            <div className="space-y-2">
                                <Label className="text-gray-700 font-medium">
                                    Email
                                </Label>
                                <Input
                                    type="email"
                                    value={email}
                                    disabled
                                    className="rounded-xl bg-gray-50 border-gray-200 cursor-not-allowed"
                                />
                            </div>
                        )}

                        {/* New password */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="password"
                                className="text-gray-700 font-medium"
                            >
                                New Password
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    className="pl-10 pr-10 rounded-xl border-2 focus:border-blue-500"
                                    required
                                    disabled={loading || !!success}
                                    placeholder="Enter new password"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>

                            {/* Live requirements checklist */}
                            {password.length > 0 && (
                                <div className="space-y-1 mt-2">
                                    <PasswordCheck
                                        label="At least 8 characters"
                                        passed={passwordChecks.length}
                                    />
                                    <PasswordCheck
                                        label="Contains a letter"
                                        passed={passwordChecks.hasLetter}
                                    />
                                    <PasswordCheck
                                        label="Contains a number"
                                        passed={passwordChecks.hasNumber}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Confirm password */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="confirm_password"
                                className="text-gray-700 font-medium"
                            >
                                Confirm New Password
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    id="confirm_password"
                                    type={
                                        showConfirmPassword
                                            ? "text"
                                            : "password"
                                    }
                                    value={confirmPassword}
                                    onChange={(e) =>
                                        setConfirmPassword(e.target.value)
                                    }
                                    className={`pl-10 pr-10 rounded-xl border-2 ${confirmPassword.length > 0
                                            ? passwordsMatch
                                                ? "border-green-400 focus:border-green-500"
                                                : "border-red-300 focus:border-red-500"
                                            : "focus:border-blue-500"
                                        }`}
                                    required
                                    disabled={loading || !!success}
                                    placeholder="Confirm new password"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowConfirmPassword(
                                            !showConfirmPassword,
                                        )
                                    }
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                            {confirmPassword.length > 0 && (
                                <p
                                    className={`text-xs flex items-center gap-1 ${passwordsMatch
                                            ? "text-green-600"
                                            : "text-red-500"
                                        }`}
                                >
                                    {passwordsMatch ? (
                                        <>
                                            <Check className="w-3 h-3" />{" "}
                                            Passwords match
                                        </>
                                    ) : (
                                        <>
                                            <X className="w-3 h-3" /> Passwords
                                            do not match
                                        </>
                                    )}
                                </p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl py-6 text-base font-semibold"
                            disabled={
                                loading ||
                                !!success ||
                                !token ||
                                !allChecksPass ||
                                !passwordsMatch
                            }
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Resetting password...
                                </>
                            ) : success ? (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Password Reset!
                                </>
                            ) : (
                                <>
                                    <Shield className="w-4 h-4 mr-2" />
                                    Reset Password
                                </>
                            )}
                        </Button>

                        <div className="text-center text-sm pt-2">
                            <Link
                                to="/"
                                className="text-blue-600 hover:underline inline-flex items-center"
                            >
                                <ArrowLeft className="w-4 h-4 mr-1" /> Back to
                                Login
                            </Link>
                        </div>
                    </form>

                    <div className="mt-6 pt-6 border-t text-center">
                        <p className="text-xs text-gray-500">
                            Link expired?{" "}
                            <Link
                                to="/forgot-password"
                                className="text-blue-600 hover:underline font-medium"
                            >
                                Request a new one
                            </Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

/** Small helper for the password requirement checklist */
const PasswordCheck: React.FC<{ label: string; passed: boolean }> = ({
    label,
    passed,
}) => (
    <div
        className={`flex items-center gap-1.5 text-xs ${passed ? "text-green-600" : "text-gray-400"
            }`}
    >
        {passed ? (
            <Check className="w-3 h-3" />
        ) : (
            <X className="w-3 h-3" />
        )}
        <span>{label}</span>
    </div>
);

export default ResetPassword;