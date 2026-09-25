import axios from "./axios";
import {
    ApiResponse,
    User,
    PasswordChangeData,
    ForgotPasswordData,
    ResetPasswordData,
} from "../types";

export interface LoginResponse {
    success: boolean;
    message?: string;
    token: string;
    user: User;
    role?: string;
}

export interface RequestOtpResponse {
    success: boolean;
    message?: string;
    email?: string;
    otp_required?: boolean;
    expires_in?: number;
}

export interface VerifyOtpResponse {
    success: boolean;
    message?: string;
    token?: string;
    user?: User;
    role?: string;
}

export const authAPI = {
    login: (
        email: string,
        password: string,
    ): Promise<{ data: LoginResponse }> =>
        axios.post("/login", { email, password }),

    logout: (): Promise<{ data: { success: boolean } }> =>
        axios.post("/logout"),

    getMe: (): Promise<{ data: User }> => axios.get("/me"),

    // ✅ NEW: Update profile
    updateProfile: (
        data: Partial<User>,
    ): Promise<{ data: { success: boolean; message: string; user: User } }> =>
        axios.put("/profile", data),

    changePassword: (
        passwordData: PasswordChangeData,
    ): Promise<ApiResponse<void>> =>
        axios.post("/change-password", passwordData),

    forgotPassword: (
        data: ForgotPasswordData,
    ): Promise<ApiResponse<{ message: string; debug_url?: string | null }>> =>
        axios.post("/forgot-password", data),

    resetPassword: (
        data: ResetPasswordData,
    ): Promise<ApiResponse<{ message: string }>> =>
        axios.post("/reset-password", data),

    detectFace: (
        formData: FormData,
    ): Promise<
        ApiResponse<{
            success: boolean;
            face_detected: boolean;
            accepted: boolean;
            message: string;
            face_quality?: number;
        }>
    > =>
        axios.post("/detect-face", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),

    // Profile photo upload/remove
    uploadProfilePhoto: (
        formData: FormData,
    ): Promise<{ data: { success: boolean; message: string; profile_photo: string; user: User } }> =>
        axios.post("/update-profile-photo", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),

    deleteProfilePhoto: (): Promise<{ data: { success: boolean; message: string; user: User } }> =>
        axios.delete("/profile-photo"),

    // Add these methods to authAPI
    requestOtp: (
        email: string,
        password: string,
    ): Promise<{ data: RequestOtpResponse }> =>
        axios.post("/login/request-otp", { email, password }),

    verifyOtp: (
        email: string,
        otp: string,
    ): Promise<{ data: VerifyOtpResponse }> =>
        axios.post("/login/verify-otp", { email, otp }),

    resendOtp: (
        email: string,
    ): Promise<{ data: RequestOtpResponse }> =>
        axios.post("/login/resend-otp", { email }),
};
