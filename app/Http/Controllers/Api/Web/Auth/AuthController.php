<?php
// app/Http/Controllers/Api/Web/Auth/AuthController.php

namespace App\Http\Controllers\Api\Web\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\AuditLog;
use App\Traits\HasApiResponse;
use App\Traits\HasAuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Mail\OtpMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    use HasApiResponse, HasAuditLog;

    public function register(RegisterRequest $request)
    {
        $user = User::create([
            'email' => $request->email,
            'password_hash' => Hash::make($request->password),
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'id_no' => $request->id_no,
            'course_id' => $request->course_id,
            'year_level' => $request->year_level,
            'role' => 'voter',
            'is_active' => true,
        ]);

        $this->logAction(
            $user->user_id,
            'REGISTER',
            'users',
            $user->user_id,
            null,
            $user->toArray(),
            $request->ip()
        );

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Registration successful',
            'token' => $token,
            'user' => $user
        ], 201);
    }

    public function login(LoginRequest $request)
    {
        $request->authenticate();

        $user = $request->user();

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Account is deactivated'
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'token' => $token,
            'user' => $user->load('course', 'section'),
            'role' => $user->role
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        $this->logAction(
            $user->user_id,
            'LOGOUT',
            'users',
            $user->user_id,
            null,
            null,
            $request->ip()
        );

        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully'
        ]);
    }

    public function me(Request $request)
    {
        Log::info('🔍 /me called', [
            'user_id' => $request->user()->user_id,
            'role' => $request->user()->role,
            'columns' => array_keys($request->user()->getAttributes()),
        ]);

        $user = $request->user()->load('course', 'section');

        return response()->json([
            'success' => true,
            'user' => $user,
        ]);
    }

    /**
     * ✅ NEW: Update the authenticated user's profile.
     * Only personal info fields can be updated — not role, email, or id_no.
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'birthdate'         => 'nullable|date|before:today',
            'present_address'   => 'nullable|string|max:255',
            'present_address_2' => 'nullable|string|max:255',
            'no_unit_load'      => 'nullable|integer|min:0|max:18',
            'cellphone'         => ['nullable', 'string', 'regex:/^[0-9]{11}$/'],
            'social_media'      => 'nullable|string|max:100',
            'year_level'        => 'nullable|integer|min:1|max:4',
        ], [
            'cellphone.regex'   => 'Cellphone number must be exactly 11 digits.',
            'no_unit_load.max'  => 'Unit load cannot exceed 18 units.',
            'no_unit_load.min'  => 'Unit load cannot be negative.',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $oldValue = $user->toArray();

        if ($request->has('birthdate')) {
            $user->birthdate = $request->birthdate;
        }
        if ($request->has('present_address')) {
            $user->present_address = $request->present_address;
        }
        if ($request->has('present_address_2')) {
            $user->present_address_2 = $request->present_address_2;
        }
        if ($request->has('no_unit_load')) {
            $user->no_unit_load = $request->no_unit_load;
        }
        if ($request->has('cellphone')) {
            $user->cellphone = $request->cellphone;
        }
        if ($request->has('social_media')) {
            $user->social_media = $request->social_media;
        }

        if ($request->has('year_level')) {
            $user->year_level = $request->year_level;
        }

        $user->save();

        $this->logAction(
            $user->user_id,
            'UPDATE_PROFILE',
            'users',
            $user->user_id,
            $oldValue,
            $user->fresh()->toArray(),
            $request->ip()
        );

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'user' => $user->fresh()->load('course', 'section'),
        ]);
    }

    public function verifyCredentials(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials'
            ], 401);
        }

        if (in_array($user->role, ['admin', 'comelec'])) {
            return response()->json([
                'success' => false,
                'message' => 'Admins and COMELEC members cannot log in on mobile. Please use the web application.'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'requires_2fa' => $user->two_factor_enabled ?? false,
            'two_factor_enabled' => $user->two_factor_enabled ?? false,
            'user_id' => $user->user_id,
            'has_face_registered' => !is_null($user->profile_photo) && $user->is_face_registered,
            'profile_photo' => $user->profile_photo,
        ]);
    }

    /**
     * Step 1 — verify credentials, then send OTP.
     * POST /api/web/login/request-otp
     */
    public function requestOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            $this->logAction(
                null,
                'LOGIN_FAILED',
                'users',
                null,
                null,
                ['email' => $request->email],
                $request->ip()
            );

            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials',
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Account is deactivated',
            ], 403);
        }

        // ✅ Throttle: block if last OTP was sent < 30 seconds ago
        if ($user->otp_last_sent_at && $user->otp_last_sent_at->diffInSeconds(now()) < 30) {
            $wait = 30 - $user->otp_last_sent_at->diffInSeconds(now());
            return response()->json([
                'success' => false,
                'message' => "Please wait {$wait}s before requesting a new code.",
            ], 429);
        }

        $code = $user->generateOtp(5);

        try {
            Mail::to($user->email)->send(
                new OtpMail(
                    $user->first_name . ' ' . $user->last_name,
                    $code,
                    5
                )
            );
        } catch (\Exception $e) {
            Log::error('OTP mail failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to send OTP email. Please try again.',
            ], 500);
        }

        $this->logAction(
            $user->user_id,
            'LOGIN_OTP_SENT',
            'users',
            $user->user_id,
            null,
            ['email' => $user->email],
            $request->ip()
        );

        return response()->json([
            'success'      => true,
            'message'      => 'OTP sent to your email.',
            'email'        => $user->email,
            'otp_required' => true,
            'expires_in'   => 300, // seconds
        ]);
    }

    /**
     * Step 2 — verify OTP and issue Sanctum token.
     * POST /api/web/login/verify-otp
     */
    public function verifyOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'otp'   => 'required|string|digits:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        if (!$user->hasValidOtp($request->otp)) {
            $this->logAction(
                $user->user_id,
                'LOGIN_OTP_FAILED',
                'users',
                $user->user_id,
                null,
                ['email' => $user->email],
                $request->ip()
            );

            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired OTP code.',
            ], 401);
        }

        // ✅ Success — clear OTP and issue token
        $user->clearOtp();
        $user->two_factor_enabled = true;
        $user->save();

        $token = $user->createToken('auth_token')->plainTextToken;

        $this->logAction(
            $user->user_id,
            'LOGIN_SUCCESS',
            'users',
            $user->user_id,
            null,
            ['email' => $user->email, 'method' => 'otp'],
            $request->ip()
        );

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'token'   => $token,
            'user'    => $user->load('course', 'section'),
            'role'    => $user->role,
        ]);
    }

    /**
     * Resend OTP (optional).
     * POST /api/web/login/resend-otp
     */
    public function resendOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users,email',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $user = User::where('email', $request->email)->first();

        if ($user->otp_last_sent_at && $user->otp_last_sent_at->diffInSeconds(now()) < 30) {
            $wait = 30 - $user->otp_last_sent_at->diffInSeconds(now());
            return response()->json([
                'success' => false,
                'message' => "Please wait {$wait}s before requesting a new code.",
            ], 429);
        }

        $code = $user->generateOtp(5);

        try {
            Mail::to($user->email)->send(
                new OtpMail(
                    $user->first_name . ' ' . $user->last_name,
                    $code,
                    5
                )
            );
        } catch (\Exception $e) {
            Log::error('OTP resend failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to send OTP email.',
            ], 500);
        }

        return response()->json([
            'success'    => true,
            'message'    => 'A new code has been sent.',
            'expires_in' => 300,
        ]);
    }
}
