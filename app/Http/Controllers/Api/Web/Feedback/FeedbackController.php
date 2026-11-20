<?php
// app/Http/Controllers/Api/Web/Feedback/FeedbackController.php

namespace App\Http\Controllers\Api\Web\Feedback;

use App\Http\Controllers\Controller;
use App\Models\Feedback;
use App\Models\FeedbackCategory;
use App\Models\Election;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class FeedbackController extends Controller
{
    /**
     * Get all feedback visible to the current user:
     *   ✅ Public feedback from everyone
     *   ✅ Plus the current user's OWN feedback (public OR private, anonymous OR not)
     *
     * For anonymous feedback written by OTHER users, the `user` relation
     * is hidden so their identity is protected. The author still sees it.
     */
    public function index(Request $request)
    {
        try {
            $currentUserId = $request->user()?->user_id;

            $query = Feedback::with(['user', 'election', 'category'])
                ->where(function ($q) use ($currentUserId) {
                    $q->where('is_public', true);

                    // ✅ Also include the requester's own feedback
                    //    (public or private, anonymous or not)
                    if ($currentUserId) {
                        $q->orWhere('user_id', $currentUserId);
                    }
                });

            if ($request->has('election_id')) {
                $query->where('election_id', $request->election_id);
            }

            if ($request->has('category_id')) {
                $query->where('category_id', $request->category_id);
            }

            $feedback = $query->orderBy('created_at', 'desc')->get();

            $transformed = $feedback->map(function ($item) use ($currentUserId) {
                $isMine = $currentUserId && $item->user_id === $currentUserId;

                // ✅ Hide the author's identity on anonymous posts UNLESS
                //    the requester is the author themselves.
                $exposeUser = $item->user && (! $item->is_anonymous || $isMine);

                return [
                    'feedback_id'    => $item->feedback_id,
                    'user_id'        => $item->user_id,
                    'election_id'    => $item->election_id,
                    'category_id'    => $item->category_id,
                    'category_name'  => $item->category ? $item->category->category_name : null,
                    'rating'         => $item->rating,
                    'title'          => $item->title,
                    'comment'        => $item->comment,
                    'is_public'      => $item->is_public,
                    'is_anonymous'   => $item->is_anonymous,
                    'admin_response' => $item->admin_response,
                    'helpful_count'  => $item->helpful_count,
                    'created_at'     => $item->created_at,
                    'updated_at'     => $item->updated_at,
                    'user'           => $exposeUser ? [
                        'user_id'    => $item->user->user_id,
                        'first_name' => $item->user->first_name,
                        'last_name'  => $item->user->last_name,
                        'email'      => $item->user->email,
                    ] : null,
                    'election'       => $item->election ? [
                        'election_id' => $item->election->election_id,
                        'title'       => $item->election->title,
                    ] : null,
                    // ✅ Server-side permission flags, so the frontend doesn't
                    //    have to guess based on the (possibly hidden) user object.
                    'can_edit'       => $isMine,
                    'can_delete'     => $isMine,
                ];
            });

            return response()->json([
                'success' => true,
                'data'    => $transformed,
                'total'   => $transformed->count(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch feedback: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch feedback: ' . $e->getMessage(),
                'data'    => [],
            ], 500);
        }
    }

    /**
     * Get user's own feedback for an election
     */
    public function getUserFeedback(Request $request, $electionId)
    {
        try {
            $userId = $request->user()->user_id;

            $feedback = Feedback::where('user_id', $userId)
                ->where('election_id', $electionId)
                ->first();

            if (!$feedback) {
                return response()->json([
                    'success'       => true,
                    'data'          => null,
                    'has_submitted' => false,
                ]);
            }

            return response()->json([
                'success'       => true,
                'data'          => $feedback,
                'has_submitted' => true,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch feedback',
            ], 500);
        }
    }

    /**
     * Get feedback categories
     */
    public function getCategories()
    {
        try {
            $categories = FeedbackCategory::where('is_active', true)
                ->orderBy('display_order')
                ->get();

            return response()->json([
                'success' => true,
                'data'    => $categories,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch categories',
            ], 500);
        }
    }

    /**
     * Store new feedback
     * ✅ Only one feedback per election
     * ✅ Always stores user_id — anonymity is a display flag, not a null id
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'election_id'  => 'required|exists:elections,election_id',
            'category_id'  => 'nullable|exists:feedback_categories,category_id',
            'rating'       => 'required|integer|min:1|max:5',
            'title'        => 'nullable|string|max:255',
            'comment'      => 'required|string',
            'is_public'    => 'boolean',
            'is_anonymous' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $userId     = $request->user()->user_id;
        $electionId = $request->election_id;

        if (Feedback::hasSubmitted($userId, $electionId)) {
            return response()->json([
                'success' => false,
                'message' => 'You have already submitted feedback for this election. You can edit it instead.',
                'code'    => 'already_submitted',
            ], 422);
        }

        try {
            // ✅ ALWAYS store user_id — even for anonymous posts.
            //    Anonymous only affects what OTHER users see, not the
            //    ownership of the row.
            $feedback = Feedback::create([
                'user_id'      => $userId,
                'election_id'  => $electionId,
                'category_id'  => $request->category_id,
                'rating'       => $request->rating,
                'title'        => $request->title,
                'comment'      => $request->comment,
                'is_public'    => $request->is_public ?? true,
                'is_anonymous' => $request->is_anonymous ?? false,
            ]);

            try {
                $notificationService = app(NotificationService::class);
                $adminUsers = \App\Models\User::where('role', 'admin')->get();
                $user = $request->user();

                // ✅ Don't leak the anonymous author's name in the admin notification
                $displayName = $feedback->is_anonymous
                    ? 'An anonymous user'
                    : "{$user->first_name} {$user->last_name}";

                foreach ($adminUsers as $admin) {
                    $notificationService->send(
                        $admin->user_id,
                        '💬 New Feedback Submitted',
                        "{$displayName} submitted feedback for election: \"{$feedback->title}\"",
                        'feedback_response',
                        [
                            'feedback_id' => $feedback->feedback_id,
                            'user'        => $displayName,
                            'title'       => $feedback->title,
                            'rating'      => $feedback->rating,
                        ]
                    );
                }
            } catch (\Exception $e) {
                Log::warning('Failed to send feedback notification: ' . $e->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Feedback submitted successfully!',
                'data'    => $feedback,
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to submit feedback: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to submit feedback: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update feedback
     * ✅ Users can edit their own feedback
     */
    public function update(Request $request, $id)
    {
        $feedback = Feedback::findOrFail($id);
        $userId = $request->user()->user_id;

        if ($feedback->user_id !== $userId) {
            return response()->json([
                'success' => false,
                'message' => 'You can only edit your own feedback',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'category_id'  => 'required|exists:feedback_categories,category_id',
            'rating'       => 'required|integer|min:1|max:5',
            'title'        => 'nullable|string|max:255',
            'comment'      => 'required|string',
            'is_public'    => 'boolean',
            'is_anonymous' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        try {
            $feedback->update([
                'category_id'  => $request->category_id,
                'rating'       => $request->rating,
                'title'        => $request->title,
                'comment'      => $request->comment,
                'is_public'    => $request->is_public ?? true,
                'is_anonymous' => $request->is_anonymous ?? false,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Feedback updated successfully!',
                'data'    => $feedback,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to update feedback: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update feedback: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete feedback
     * ✅ Users can delete their own feedback
     */
    public function destroy(Request $request, $id)
    {
        try {
            $feedback = Feedback::findOrFail($id);
            $userId = $request->user()->user_id;

            if ($feedback->user_id !== $userId && $request->user()->role !== 'admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to delete this feedback',
                ], 403);
            }

            $feedback->delete();

            return response()->json([
                'success' => true,
                'message' => 'Feedback deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete feedback',
            ], 500);
        }
    }

    /**
     * Mark feedback as helpful
     */
    public function markHelpful($id)
    {
        try {
            $feedback = Feedback::findOrFail($id);
            $feedback->increment('helpful_count');

            return response()->json([
                'success'       => true,
                'message'       => 'Marked as helpful',
                'helpful_count' => $feedback->fresh()->helpful_count,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to mark helpful: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to mark as helpful',
            ], 500);
        }
    }

    /**
     * Admin: Get all feedback
     */
    public function adminIndex(Request $request)
    {
        try {
            $query = Feedback::with(['user', 'election', 'category']);

            if ($request->has('election_id')) {
                $query->where('election_id', $request->election_id);
            }

            if ($request->has('category_id')) {
                $query->where('category_id', $request->category_id);
            }

            if ($request->has('user_id')) {
                $query->where('user_id', $request->user_id);
            }

            $feedback = $query->orderBy('created_at', 'desc')->get();

            return response()->json([
                'success' => true,
                'data'    => $feedback,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch admin feedback: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch feedback',
            ], 500);
        }
    }

    /**
     * Admin: Add admin response
     */
    public function respond(Request $request, $id)
    {
        $feedback = Feedback::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'admin_response' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        $feedback->update([
            'admin_response' => $request->admin_response,
            'responded_by'   => $request->user()->user_id,
            'responded_at'   => now(),
        ]);

        try {
            $notificationService = app(NotificationService::class);
            $notificationService->feedbackResponded(
                $feedback->user_id,
                $feedback->title ?? 'Feedback'
            );
        } catch (\Exception $e) {
            Log::warning('Failed to send feedback response notification: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Response added successfully',
            'data'    => $feedback,
        ]);
    }

    public function checkStatus(Request $request, $electionId)
    {
        try {
            $userId = $request->user()->user_id;

            $feedback = Feedback::where('user_id', $userId)
                ->where('election_id', $electionId)
                ->first();

            return response()->json([
                'success'      => true,
                'has_submitted' => !is_null($feedback),
                'feedback'     => $feedback,
                'can_edit'     => !is_null($feedback),
                'can_delete'   => !is_null($feedback),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to check feedback status',
            ], 500);
        }
    }
}
