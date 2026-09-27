<?php
// app/Http/Controllers/Api/Mobile/Auth/MobileFaceController.php

namespace App\Http\Controllers\Api\Mobile\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class MobileFaceController extends Controller
{
    /**
     * Register face embeddings from on-device MobileFaceNet.
     * POST /api/mobile/face/register-embeddings
     *
     * No photo is uploaded anymore — only the embeddings + metadata.
     */
    public function registerEmbeddings(Request $request)
    {
        Log::info('📸 Face embedding registration request', [
            'user_id' => $request->input('user_id'),
            'ip'      => $request->ip(),
        ]);

        $validator = Validator::make($request->all(), [
            'user_id'             => 'required|numeric|exists:users,user_id',
            'face_encoding_front' => 'required|string',
            'face_encoding_left'  => 'required|string',
            'face_encoding_right' => 'required|string',
        ]);

        if ($validator->fails()) {
            Log::warning('❌ Embedding validation failed', $validator->errors()->toArray());
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        try {
            $user = User::findOrFail((int) $request->user_id);

            $angles = ['front', 'left', 'right'];
            $decoded = [];

            foreach ($angles as $angle) {
                $raw = $request->input("face_encoding_{$angle}");
                $arr = json_decode($raw, true);

                if (!is_array($arr) || count($arr) < 64 || count($arr) > 512) {
                    return response()->json([
                        'success' => false,
                        'message' => "Invalid {$angle} embedding (expected numeric array).",
                    ], 422);
                }

                foreach ($arr as $v) {
                    if (!is_numeric($v)) {
                        return response()->json([
                            'success' => false,
                            'message' => "Invalid {$angle} embedding values.",
                        ], 422);
                    }
                }

                $decoded[$angle] = array_map('floatval', $arr);
            }

            $user->face_encoding_front = $decoded['front'];
            $user->face_encoding_left  = $decoded['left'];
            $user->face_encoding_right = $decoded['right'];
            $user->is_face_registered  = true;
            $user->face_registered_at  = now();
            $user->face_version        = 'mobilefacenet-v1';
            $user->save();

            AuditLog::create([
                'user_id'      => $user->user_id,
                'action_type'  => 'MOBILE_FACE_EMBEDDINGS_REGISTERED',
                'target_table' => 'users',
                'target_id'    => $user->user_id,
                'old_value'    => null,
                'new_value'    => json_encode([
                    'has_front' => true,
                    'has_left'  => true,
                    'has_right' => true,
                    'source'    => 'on-device-mobilefacenet',
                    'version'   => 'mobilefacenet-v1',
                    'at'        => now()->toISOString(),
                ]),
                'ip_address'   => $request->ip(),
                'user_agent'   => $request->userAgent(),
                'timestamp'    => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Face embeddings stored successfully',
                'data'    => [
                    'user_id'            => $user->user_id,
                    'is_face_registered' => true,
                    'face_registered_at' => $user->face_registered_at?->toISOString(),
                    'face_version'       => $user->face_version,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('❌ registerEmbeddings error: ' . $e->getMessage());
            Log::error($e->getTraceAsString());

            return response()->json([
                'success' => false,
                'message' => 'Failed to store embeddings: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/mobile/face/data
     */
    public function getFaceData(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated',
                ], 401);
            }

            if (!$user->is_face_registered && !$user->hasPoseEmbeddings()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Face not registered',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data'    => [
                    'user_id'             => $user->user_id,
                    'face_encoding_front' => $user->face_encoding_front,
                    'face_encoding_left'  => $user->face_encoding_left,
                    'face_encoding_right' => $user->face_encoding_right,
                    'face_encoding'       => $user->face_encoding,
                    'registered_at'       => ($user->face_registered_at ?? $user->updated_at)?->toISOString(),
                    'face_version'        => $user->face_version ?? 'mobilefacenet-v1',
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('❌ getFaceData error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get face data',
            ], 500);
        }
    }

    /**
     * GET /api/mobile/face/status
     */
    public function getFaceStatus(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not authenticated',
            ], 401);
        }

        return response()->json([
            'success' => true,
            'data'    => [
                'is_face_registered'  => (bool) $user->is_face_registered,
                'has_pose_embeddings' => $user->hasPoseEmbeddings(),
                'face_registered_at'  => $user->face_registered_at?->toISOString(),
                'face_version'        => $user->face_version,
            ],
        ]);
    }

    /**
     * DELETE /api/mobile/face/data
     */
    public function deleteFaceData(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not authenticated',
            ], 401);
        }

        try {
            $user->face_encoding_front = null;
            $user->face_encoding_left  = null;
            $user->face_encoding_right = null;
            $user->face_encoding       = null;
            $user->is_face_registered  = false;
            $user->face_registered_at  = null;
            $user->save();

            AuditLog::create([
                'user_id'      => $user->user_id,
                'action_type'  => 'MOBILE_FACE_DELETED',
                'target_table' => 'users',
                'target_id'    => $user->user_id,
                'old_value'    => json_encode(['is_face_registered' => true]),
                'new_value'    => json_encode(['is_face_registered' => false]),
                'ip_address'   => $request->ip(),
                'user_agent'   => $request->userAgent(),
                'timestamp'    => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Face data deleted',
            ]);
        } catch (\Exception $e) {
            Log::error('❌ deleteFaceData error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete face data',
            ], 500);
        }
    }
}