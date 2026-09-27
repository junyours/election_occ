import React, { useEffect, useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";
import { authAPI } from "../api/auth";
import {
    AlertCircle,
    CheckCircle,
    Loader2,
    MailCheck,
    RefreshCw,
    Shield,
} from "lucide-react";

interface OtpModalProps {
    isOpen: boolean;
    email: string;
    onClose: () => void;
    onVerified: (token: string, user: any, role?: string) => void;
}

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

const OtpModal: React.FC<OtpModalProps> = ({
    isOpen,
    email,
    onClose,
    onVerified,
}) => {
    const [digits, setDigits] = useState<string[]>(
        Array(OTP_LENGTH).fill(""),
    );
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
    const [expiresIn, setExpiresIn] = useState(300);
    const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setDigits(Array(OTP_LENGTH).fill(""));
            setError("");
            setCooldown(RESEND_COOLDOWN);
            setExpiresIn(300);
            setTimeout(() => inputsRef.current[0]?.focus(), 120);
        }
    }, [isOpen]);

    // Resend cooldown timer
    useEffect(() => {
        if (!isOpen) return;
        if (cooldown <= 0) return;
        const t = setInterval(() => setCooldown((c) => c - 1), 1000);
        return () => clearInterval(t);
    }, [isOpen, cooldown]);

    // OTP expiry timer
    useEffect(() => {
        if (!isOpen) return;
        if (expiresIn <= 0) return;
        const t = setInterval(() => setExpiresIn((s) => s - 1), 1000);
        return () => clearInterval(t);
    }, [isOpen, expiresIn]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${r.toString().padStart(2, "0")}`;
    };

    const handleChange = (index: number, value: string) => {
        // Allow paste of entire code
        const cleaned = value.replace(/\D/g, "");
        if (cleaned.length > 1) {
            const arr = cleaned.slice(0, OTP_LENGTH).split("");
            const next = [...digits];
            arr.forEach((d, i) => {
                if (index + i < OTP_LENGTH) next[index + i] = d;
            });
            setDigits(next);
            const nextIndex = Math.min(index + arr.length, OTP_LENGTH - 1);
            inputsRef.current[nextIndex]?.focus();
            return;
        }

        const next = [...digits];
        next[index] = cleaned;
        setDigits(next);

        if (cleaned && index < OTP_LENGTH - 1) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (
        index: number,
        e: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (e.key === "Backspace" && !digits[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
        if (e.key === "ArrowLeft" && index > 0)
            inputsRef.current[index - 1]?.focus();
        if (e.key === "ArrowRight" && index < OTP_LENGTH - 1)
            inputsRef.current[index + 1]?.focus();
        if (e.key === "Enter") handleVerify();
    };

    const handleVerify = async () => {
        const code = digits.join("");
        if (code.length !== OTP_LENGTH) {
            setError("Please enter the full 6-digit code.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await authAPI.verifyOtp(email, code);
            const data = res.data;
            if (data.success && data.token && data.user) {
                onVerified(data.token, data.user, data.role);
            } else {
                setError(data.message || "Invalid OTP");
            }
        } catch (err: any) {
            setError(
                err.response?.data?.message || "Verification failed",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (cooldown > 0) return;
        setResending(true);
        setError("");
        try {
            const res = await authAPI.resendOtp(email);
            if (res.data.success) {
                setCooldown(RESEND_COOLDOWN);
                setExpiresIn(300);
                setDigits(Array(OTP_LENGTH).fill(""));
                setTimeout(() => inputsRef.current[0]?.focus(), 100);
            } else {
                setError(res.data.message || "Failed to resend OTP");
            }
        } catch (err: any) {
            setError(
                err.response?.data?.message ||
                    "Failed to resend code",
            );
        } finally {
            setResending(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl">
                <div className="bg-blue-600 px-6 py-6 text-center">
                    <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Shield className="w-7 h-7 text-white" />
                    </div>
                    <DialogTitle className="text-xl font-bold text-white">
                        Verify Your Identity
                    </DialogTitle>
                    <DialogDescription className="text-blue-100 text-sm mt-1">
                        A 6-digit code has been sent to
                    </DialogDescription>
                    <p className="text-white font-semibold text-sm mt-0.5">
                        {email}
                    </p>
                </div>

                <div className="p-6">
                    <div className="flex items-center justify-center gap-2 mb-4 text-sm text-gray-500">
                        <MailCheck className="w-4 h-4" />
                        <span>
                            Code expires in{" "}
                            <span className="font-bold text-blue-600">
                                {formatTime(expiresIn)}
                            </span>
                        </span>
                    </div>

                    {error && (
                        <Alert
                            variant="destructive"
                            className="rounded-xl mb-4"
                        >
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* OTP inputs */}
                    <div className="flex justify-center gap-2 mb-5">
                        {digits.map((d, i) => (
                            <input
                                key={i}
                                ref={(el) => {
                                    inputsRef.current[i] = el;
                                }}
                                type="text"
                                inputMode="numeric"
                                maxLength={OTP_LENGTH}
                                value={d}
                                onChange={(e) =>
                                    handleChange(i, e.target.value)
                                }
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                                disabled={loading}
                            />
                        ))}
                    </div>

                    <Button
                        onClick={handleVerify}
                        disabled={loading || digits.some((d) => !d)}
                        className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl py-6"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Verify & Login
                            </>
                        )}
                    </Button>

                    <div className="text-center mt-4">
                        <p className="text-sm text-gray-500 mb-2">
                            Didn't receive the code?
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleResend}
                            disabled={cooldown > 0 || resending}
                            className="rounded-xl"
                        >
                            {resending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            {cooldown > 0
                                ? `Resend in ${cooldown}s`
                                : "Resend Code"}
                        </Button>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full text-center text-xs text-gray-400 mt-5 hover:text-gray-600"
                    >
                        Use a different account
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default OtpModal;