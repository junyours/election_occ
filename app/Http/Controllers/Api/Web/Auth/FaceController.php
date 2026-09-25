<?php
// app/Http/Controllers/Api/Web/Auth/FaceController.php

namespace App\Http\Controllers\Api\Web\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\AuditLog;
use App\Traits\HasApiResponse;
use App\Traits\HasAuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class FaceController extends Controller
{
    use HasApiResponse, HasAuditLog;

    // ============================================================
    // ADMIN: LIST USERS WITH FACE REGISTERED
    // ============================================================

    /**
     * Get users who have registered their face (embeddings stored).
     * GET /api/web/admin/face/users-with
     *
     * Note: `face_reference_photo` no longer exists — we only track
     * the boolean `is_face_registered` flag and the pose embeddings.
     */
    public function getUsersWithFace()
    {
        try {
            $users = User::with(['course', 'section'])
                ->where('is_face_registered', true)
                ->orderBy('last_name', 'asc')
                ->get()
                ->map(function ($user) {
                    return [
                        'user_id'              => $user->user_id,
                        'first_name'           => $user->first_name,
                        'last_name'            => $user->last_name,
                        'email'                => $user->email,
                        'id_no'           => $user->id_no,
                        'role'                 => $user->role,
                        'year_level'           => $user->year_level,
                        'profile_photo'        => $user->profile_photo,
                        'is_face_registered'   => (bool) $user->is_face_registered,
                        'face_registered_at'   => $user->face_registered_at?->toISOString(),
                        'face_version'         => $user->face_version,
                        'course'               => $user->course ? [
                            'course_id'   => $user->course->course_id,
                            'course_code' => $user->course->course_code,
                            'course_name' => $user->course->course_name,
                        ] : null,
                        'section'              => $user->section ? [
                            'section_id'   => $user->section->section_id,
                            'section_code' => $user->section->section_code,
                            'section_name' => $user->section->section_name,
                            'year_level'   => $user->section->year_level,
                        ] : null,
                    ];
                });

            return $this->successResponse($users, 'Users with face registration retrieved');
        } catch (\Exception $e) {
            Log::error('Failed to fetch users with face: ' . $e->getMessage());
            return $this->errorResponse('Failed to fetch users with face', 500);
        }
    }

    // ============================================================
    // ADMIN: LIST USERS WITHOUT FACE REGISTERED
    // ============================================================

    /**
     * Get users who have NOT registered their face yet.
     * GET /api/web/admin/face/users-without
     */
    public function getUsersWithoutFace()
    {
        try {
            $users = User::with(['course', 'section'])
                ->where(function ($q) {
                    $q->where('is_face_registered', false)
                        ->orWhereNull('is_face_registered');
                })
                ->whereIn('role', ['voter', 'candidate'])
                ->orderBy('last_name', 'asc')
                ->get()
                ->map(function ($user) {
                    return [
                        'user_id'            => $user->user_id,
                        'first_name'         => $user->first_name,
                        'last_name'          => $user->last_name,
                        'email'              => $user->email,
                        'id_no'         => $user->id_no,
                        'role'               => $user->role,
                        'year_level'         => $user->year_level,
                        'profile_photo'      => $user->profile_photo,
                        'is_face_registered' => false,
                        'course'             => $user->course ? [
                            'course_id'   => $user->course->course_id,
                            'course_code' => $user->course->course_code,
                            'course_name' => $user->course->course_name,
                        ] : null,
                        'section'            => $user->section ? [
                            'section_id'   => $user->section->section_id,
                            'section_code' => $user->section->section_code,
                            'section_name' => $user->section->section_name,
                            'year_level'   => $user->section->year_level,
                        ] : null,
                    ];
                });

            return $this->successResponse($users, 'Users without face registration retrieved');
        } catch (\Exception $e) {
            Log::error('Failed to fetch users without face: ' . $e->getMessage());
            return $this->errorResponse('Failed to fetch users without face', 500);
        }
    }

    // ============================================================
    // ADMIN: DELETE FACE DATA
    // ============================================================

    /**
     * Delete a user's face embeddings (admin action).
     * DELETE /api/web/admin/face/delete/{userId}
     */
    public function deleteFace(Request $request, $userId)
    {
        try {
            $user = User::find($userId);

            if (!$user) {
                return $this->errorResponse('User not found', 404);
            }

            $hadFace = (bool) $user->is_face_registered;

            // Clear all embedding columns + metadata
            $user->face_encoding_front  = null;
            $user->face_encoding_left   = null;
            $user->face_encoding_right  = null;
            $user->face_encoding        = null;
            $user->is_face_registered   = false;
            $user->face_registered_at   = null;
            $user->save();

            AuditLog::create([
                'user_id'      => $request->user()->user_id,
                'action_type'  => 'DELETE_FACE',
                'target_table' => 'users',
                'target_id'    => $user->user_id,
                'old_value'    => json_encode([
                    'is_face_registered' => $hadFace,
                    'face_version'       => $user->face_version,
                ]),
                'new_value'    => json_encode([
                    'is_face_registered' => false,
                ]),
                'ip_address'   => $request->ip(),
                'user_agent'   => $request->userAgent(),
                'timestamp'    => now(),
            ]);

            return $this->successResponse(null, 'Face data deleted successfully');
        } catch (\Exception $e) {
            Log::error('Failed to delete face: ' . $e->getMessage());
            return $this->errorResponse('Failed to delete face data', 500);
        }
    }

    // ============================================================
    // PROFILE PHOTO UPLOAD (replaces the old updateFacePhoto)
    // ============================================================

    /**
     * Upload or replace the authenticated user's profile picture.
     * POST /api/web/update-profile-photo
     *
     * Uses multipart/form-data with a `photo` field.
     * Stores to storage/app/public/profile_photos/ and updates
     * the `profile_photo` column on the user.
     */
    public function updateProfilePhoto(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'photo' => 'required|image|max:5120|mimes:jpeg,png,jpg,webp',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $user = $request->user();

        try {
            // Delete previous file if it exists
            if ($user->profile_photo) {
                $oldPath = str_replace('/storage/', '', $user->profile_photo);
                if (Storage::disk('public')->exists($oldPath)) {
                    Storage::disk('public')->delete($oldPath);
                }
            }

            $file = $request->file('photo');
            $filename = 'profile_' . $user->user_id . '_' . time() . '.' .
                $file->getClientOriginalExtension();
            $path = $file->storeAs('profile_photos', $filename, 'public');
            $url  = '/storage/' . $path;

            $oldUrl = $user->profile_photo;
            $user->profile_photo = $url;
            $user->save();

            AuditLog::create([
                'user_id'      => $user->user_id,
                'action_type'  => 'UPDATE_PROFILE_PHOTO',
                'target_table' => 'users',
                'target_id'    => $user->user_id,
                'old_value'    => json_encode(['profile_photo' => $oldUrl]),
                'new_value'    => json_encode(['profile_photo' => $url]),
                'ip_address'   => $request->ip(),
                'user_agent'   => $request->userAgent(),
                'timestamp'    => now(),
            ]);

            return response()->json([
                'success'       => true,
                'message'       => 'Profile photo updated successfully',
                'profile_photo' => $url,
                'user'          => $user->fresh()->load('course', 'section'),
            ]);
        } catch (\Exception $e) {
            Log::error('updateProfilePhoto failed: ' . $e->getMessage());
            return $this->errorResponse(
                'Failed to upload profile photo: ' . $e->getMessage(),
                500
            );
        }
    }

    /**
     * Remove the authenticated user's profile picture.
     * DELETE /api/web/profile-photo
     */
    public function deleteProfilePhoto(Request $request)
    {
        $user = $request->user();

        try {
            if ($user->profile_photo) {
                $oldPath = str_replace('/storage/', '', $user->profile_photo);
                if (Storage::disk('public')->exists($oldPath)) {
                    Storage::disk('public')->delete($oldPath);
                }

                AuditLog::create([
                    'user_id'      => $user->user_id,
                    'action_type'  => 'DELETE_PROFILE_PHOTO',
                    'target_table' => 'users',
                    'target_id'    => $user->user_id,
                    'old_value'    => json_encode(['profile_photo' => $user->profile_photo]),
                    'new_value'    => json_encode(['profile_photo' => null]),
                    'ip_address'   => $request->ip(),
                    'user_agent'   => $request->userAgent(),
                    'timestamp'    => now(),
                ]);

                $user->profile_photo = null;
                $user->save();
            }

            return response()->json([
                'success' => true,
                'message' => 'Profile photo removed',
                'user'    => $user->fresh()->load('course', 'section'),
            ]);
        } catch (\Exception $e) {
            Log::error('deleteProfilePhoto failed: ' . $e->getMessage());
            return $this->errorResponse('Failed to delete profile photo', 500);
        }
    }
}
