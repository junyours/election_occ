<?php
// app/Http/Controllers/Api/Mobile/Auth/MobilePasswordController.php

namespace App\Http\Controllers\Api\Mobile\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Carbon\Carbon;

class MobilePasswordController extends Controller
{
    private const RESET_TOKEN_TTL_MINUTES = 60;
    private const REQUEST_COOLDOWN_SECONDS = 60;

    /**
     * Change Password
     * POST /api/mobile/change-password
     */
    public function changePassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required',
            'new_password'     => 'required|min:8|different:current_password',
            'confirm_password' => 'required|same:new_password',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password_hash)) {
            return response()->json([
                'success' => false,
                'message' => 'Current password is incorrect',
            ], 400);
        }

        $user->password_hash = Hash::make($request->new_password);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully',
        ]);
    }

    /**
     * Forgot Password
     * POST /api/mobile/forgot-password
     */
    public function forgotPassword(Request $request)
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

        $email = strtolower(trim($request->email));
        $user  = User::where('email', $email)->first();

        // Cooldown
        $existing = DB::table('password_reset_tokens')
            ->where('email', $email)
            ->first();

        if ($existing && $existing->created_at) {
            $secondsSince = now()->diffInSeconds(
                Carbon::parse($existing->created_at),
                false,
            );
            if ($secondsSince < self::REQUEST_COOLDOWN_SECONDS) {
                $wait = self::REQUEST_COOLDOWN_SECONDS - (int) $secondsSince;
                return response()->json([
                    'success' => false,
                    'message' => "Please wait {$wait}s before requesting another reset link.",
                ], 429);
            }
        }

        // Generate + hash
        $plainToken  = Str::random(64);
        $hashedToken = hash('sha256', $plainToken);
        $expiresAt   = now()->addMinutes(self::RESET_TOKEN_TTL_MINUTES);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $email],
            [
                'token'      => $hashedToken,
                'created_at' => now(),
                'expires_at' => $expiresAt,
            ]
        );

        // ✅ For mobile we use a deep link scheme
        $frontendUrl = rtrim(env('FRONTEND_URL', 'http://localhost:8000'), '/');
        $resetUrl = $frontendUrl
            . '/reset-password?token=' . urlencode($plainToken)
            . '&email=' . urlencode($email);

        try {
            Mail::send('emails.password-reset', [
                'userName'   => trim($user->first_name . ' ' . $user->last_name),
                'resetUrl'   => $resetUrl,
                'ttlMinutes' => self::RESET_TOKEN_TTL_MINUTES,
            ], function ($message) use ($user) {
                $message->to($user->email)
                    ->subject('Password Reset Request — OCC Election System');
            });

            return response()->json([
                'success' => true,
                'message' => 'Password reset link sent to your email.',
                'debug_url' => app()->isLocal() ? $resetUrl : null,
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile password reset email failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to send email. Please try again.',
            ], 500);
        }
    }

    /**
     * Reset Password
     * POST /api/mobile/reset-password
     */
    public function resetPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email'    => 'required|email|exists:users,email',
            'token'    => 'required|string',
            'password' => 'required|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $email = strtolower(trim($request->email));

        $record = DB::table('password_reset_tokens')
            ->where('email', $email)
            ->first();

        if (!$record) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired reset link.',
            ], 400);
        }

        // Expiry check
        if ($record->expires_at && now()->greaterThan(Carbon::parse($record->expires_at))) {
            DB::table('password_reset_tokens')->where('email', $email)->delete();
            return response()->json([
                'success' => false,
                'message' => 'This reset link has expired. Please request a new one.',
            ], 400);
        }

        // Token hash check
        $hashedInput = hash('sha256', $request->token);
        if (!hash_equals($record->token, $hashedInput)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired reset link.',
            ], 400);
        }

        $user = User::where('email', $email)->first();
        $user->password_hash = Hash::make($request->password);
        $user->save();

        // Invalidate token
        DB::table('password_reset_tokens')->where('email', $email)->delete();

        // Revoke active tokens (all sessions/devices)
        try {
            $user->tokens()->delete();
        } catch (\Exception $e) {
            Log::warning('Failed to revoke tokens: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Password reset successfully. You can now log in.',
        ]);
    }
}
