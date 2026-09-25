<?php
// app/Http/Controllers/Api/Web/Auth/PasswordController.php

namespace App\Http\Controllers\Api\Web\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\HasApiResponse;
use App\Traits\HasAuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Carbon\Carbon;

class PasswordController extends Controller
{
    use HasApiResponse, HasAuditLog;

    /** Token lifetime in minutes */
    private const RESET_TOKEN_TTL_MINUTES = 60;

    /** Minimum seconds between reset requests for the same email */
    private const REQUEST_COOLDOWN_SECONDS = 60;

    /**
     * Change Password (for authenticated users)
     * POST /api/web/change-password
     */
    public function changePassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required',
            'new_password'     => 'required|min:8|different:current_password',
            'confirm_password' => 'required|same:new_password',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password_hash)) {
            return $this->errorResponse('Current password is incorrect', 400);
        }

        $user->password_hash = Hash::make($request->new_password);
        $user->save();

        $this->logAction(
            $user->user_id,
            'CHANGE_PASSWORD',
            'users',
            $user->user_id,
            null,
            null,
            $request->ip()
        );

        return $this->successResponse(null, 'Password changed successfully');
    }

    /**
     * Forgot Password — send reset link
     * POST /api/web/forgot-password
     */
    public function forgotPassword(Request $request)
    {
        // ============================================================
        // 1. Validate input
        // ============================================================
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users,email',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $email = strtolower(trim($request->email));
        $user  = User::where('email', $email)->first();

        if (!$user) {
            return $this->errorResponse('User not found', 404);
        }

        // ============================================================
        // 2. Cooldown — timezone-proof
        //    Only block if the previous record exists AND is within
        //    the cooldown window (comparing past timestamps only).
        // ============================================================
        $existing = DB::table('password_reset_tokens')
            ->where('email', $email)
            ->first();

        if ($existing && $existing->created_at) {
            try {
                $createdAt = Carbon::parse($existing->created_at);

                // ✅ Only enforce cooldown if createdAt is in the past
                if ($createdAt->lessThanOrEqualTo(now())) {
                    $secondsSince = (int) $createdAt->diffInSeconds(now());

                    if ($secondsSince < self::REQUEST_COOLDOWN_SECONDS) {
                        $wait = self::REQUEST_COOLDOWN_SECONDS - $secondsSince;

                        return $this->errorResponse(
                            "Please wait {$wait}s before requesting another reset link.",
                            429
                        );
                    }
                }
                // If createdAt is somehow in the future (timezone drift),
                // skip the cooldown entirely — don't lock the user out.
            } catch (\Exception $e) {
                Log::warning('Cooldown check failed: ' . $e->getMessage());
                // Fail open — allow the request if we can't parse the date
            }
        }

        // ============================================================
        // 3. Generate + hash the reset token
        // ============================================================
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

        // ============================================================
        // 4. Build the reset URL
        // ============================================================
        $frontendUrl = rtrim(env('FRONTEND_URL', 'http://localhost:5173'), '/');
        $resetUrl = $frontendUrl
            . '/reset-password?token=' . urlencode($plainToken)
            . '&email=' . urlencode($email);

        // ============================================================
        // 5. Send the email
        // ============================================================
        try {
            Mail::send('emails.password-reset', [
                'userName'   => trim($user->first_name . ' ' . $user->last_name),
                'resetUrl'   => $resetUrl,
                'ttlMinutes' => self::RESET_TOKEN_TTL_MINUTES,
            ], function ($message) use ($user) {
                $message->to($user->email)
                    ->subject('Password Reset Request — OCC Election System');
            });

            $this->logAction(
                $user->user_id,
                'FORGOT_PASSWORD_REQUESTED',
                'users',
                $user->user_id,
                null,
                ['email' => $email],
                $request->ip()
            );

            return $this->successResponse(
                ['debug_url' => app()->isLocal() ? $resetUrl : null],
                'Password reset link sent to your email.'
            );
        } catch (\Exception $e) {
            Log::error('Failed to send password reset email: ' . $e->getMessage());

            return $this->errorResponse(
                'Failed to send reset email. Please try again.',
                500
            );
        }
    }

    /**
     * Reset Password — verify token and set new password
     * POST /api/web/reset-password
     */
    public function resetPassword(Request $request)
    {
        // ============================================================
        // 1. Validate input
        // ============================================================
        $validator = Validator::make($request->all(), [
            'email'    => 'required|email|exists:users,email',
            'token'    => 'required|string',
            'password' => 'required|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $email = strtolower(trim($request->email));

        // ============================================================
        // 2. Find the reset record
        // ============================================================
        $record = DB::table('password_reset_tokens')
            ->where('email', $email)
            ->first();

        if (!$record) {
            return $this->errorResponse('Invalid or expired reset link.', 400);
        }

        // ============================================================
        // 3. Check expiry
        // ============================================================
        if ($record->expires_at) {
            try {
                $expiresAt = Carbon::parse($record->expires_at);
                if (now()->greaterThan($expiresAt)) {
                    DB::table('password_reset_tokens')
                        ->where('email', $email)
                        ->delete();

                    return $this->errorResponse(
                        'This reset link has expired. Please request a new one.',
                        400
                    );
                }
            } catch (\Exception $e) {
                Log::warning('Expiry parse failed: ' . $e->getMessage());
                // Fail safe — continue if we can't parse
            }
        }

        // ============================================================
        // 4. Verify the token hash
        // ============================================================
        $hashedInput = hash('sha256', $request->token);

        if (!hash_equals($record->token, $hashedInput)) {
            return $this->errorResponse('Invalid or expired reset link.', 400);
        }

        // ============================================================
        // 5. Update password + revoke sessions
        // ============================================================
        $user = User::where('email', $email)->first();

        if (!$user) {
            return $this->errorResponse('User not found', 404);
        }

        $user->password_hash = Hash::make($request->password);
        $user->save();

        // Invalidate the token
        DB::table('password_reset_tokens')
            ->where('email', $email)
            ->delete();

        // Revoke all active Sanctum tokens (force re-login everywhere)
        try {
            $user->tokens()->delete();
        } catch (\Exception $e) {
            Log::warning('Failed to revoke tokens after reset: ' . $e->getMessage());
        }

        $this->logAction(
            $user->user_id,
            'RESET_PASSWORD',
            'users',
            $user->user_id,
            null,
            null,
            $request->ip()
        );

        return $this->successResponse(
            null,
            'Password reset successfully. You can now log in.'
        );
    }
}