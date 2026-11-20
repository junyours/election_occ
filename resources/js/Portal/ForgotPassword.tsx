// resources/js/pages/Portal/ForgotPassword.tsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
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
    Mail,
    Loader2,
    CheckCircle,
    AlertCircle,
    ArrowLeft,
    KeyRound,
} from "lucide-react";
import occLogo from "../assets/occlogo.png";

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [debugUrl, setDebugUrl] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");
        setDebugUrl(null);

        if (!email.trim()) {
            setError("Please enter your email address");
            setLoading(false);
            return;
        }

        try {
            const response = await authAPI.forgotPassword({ email });
            const message =
                response.data?.message ||
                "Password reset link sent to your email. Please check your inbox.";
            setSuccess(message);

            // ✅ In dev, backend may return a debug link
            const debug = (response.data as any)?.debug_url;
            if (debug) setDebugUrl(debug);

            setEmail("");
        } catch (err: any) {
            const status = err.response?.status;
            const message =
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                "Failed to send reset link. Please try again.";

            if (status === 429) {
                setError(message); // e.g. "Please wait 42s..."
            } else {
                setError(message);
            }
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
                        <KeyRound className="w-5 h-5" />
                        Forgot Password?
                    </CardTitle>
                    <p className="text-blue-100 mt-2 text-sm">
                        Enter your email and we'll send you a link to reset your
                        password.
                    </p>
                </CardHeader>

                <CardContent className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {success && (
                            <Alert className="bg-green-50 border-green-200 rounded-xl">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-700">
                                    <p className="font-semibold">{success}</p>
                                    <p className="text-sm mt-1">
                                        Didn't receive it? Check your spam
                                        folder.
                                    </p>
                                    {debugUrl && (
                                        <div className="mt-2 pt-2 border-t border-green-200">
                                            <p className="text-xs font-semibold mb-1">
                                                🔧 Dev mode — direct link:
                                            </p>
                                            <a
                                                href={debugUrl}
                                                className="text-xs text-blue-600 underline break-all"
                                            >
                                                {debugUrl}
                                            </a>
                                        </div>
                                    )}
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

                        <div className="space-y-2">
                            <Label
                                htmlFor="email"
                                className="text-gray-700 font-medium"
                            >
                                Email Address
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="student@occ.edu.ph"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setError("");
                                    }}
                                    className="pl-10 rounded-xl border-2 focus:border-blue-500"
                                    required
                                    disabled={loading}
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl py-6 text-base font-semibold"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Sending reset link...
                                </>
                            ) : (
                                <>
                                    <Mail className="w-4 h-4 mr-2" />
                                    Send Reset Link
                                </>
                            )}
                        </Button>

                        <div className="text-center text-sm">
                            <Link
                                to="/"
                                className="text-blue-600 hover:underline inline-flex items-center"
                            >
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                Back to Login
                            </Link>
                        </div>
                    </form>

                    <div className="mt-6 pt-6 border-t text-center">
                        <p className="text-xs text-gray-500">
                            Need help? Contact the COMELEC office at{" "}
                            <a
                                href="mailto:comelec@occ.edu.ph"
                                className="text-blue-600 hover:underline"
                            >
                                comelec@occ.edu.ph
                            </a>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ForgotPassword;