<?php
// app/Http/Controllers/Api/Web/Partylist/PartylistRequestController.php

namespace App\Http\Controllers\Api\Web\Partylist;

use App\Http\Controllers\Controller;
use App\Models\Partylist;
use App\Models\PartylistMembership;
use App\Models\AuditLog;
use App\Models\Candidate;
use App\Services\NotificationService;
use App\Traits\HasApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PartylistRequestController extends Controller
{
    use HasApiResponse;

    public function getPendingRequests(Request $request)
    {
        try {
            $user = $request->user();

            $partylist = Partylist::where('created_by_user_id', $user->user_id)->first();

            if (!$partylist) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'total' => 0,
                    'partylist' => null,
                    'is_creator' => false,
                    'is_read_only' => true,
                ]);
            }

            // ✅ Return ALL statuses; frontend filters client-side
            $query = PartylistMembership::with([
                'candidate.user.course',
                'candidate.user.section',
                'candidate.position',
                'candidate.election',
                'partylist',
            ])
                ->where('partylist_id', $partylist->partylist_id);

            if ($request->filled('status') && $request->status !== 'all') {
                $query->where('status', $request->status);
            }

            $requests = $query->orderBy('created_at', 'desc')->get();

            $formattedRequests = $requests->map(function ($membership) {
                $candidate = $membership->candidate;
                $userData = $candidate?->user;
                $course = $userData?->course;

                return [
                    'membership_id' => $membership->membership_id,
                    'candidate_id' => $membership->candidate_id,
                    'candidate_name' => $userData
                        ? trim($userData->first_name . ' ' . $userData->last_name)
                        : 'Unknown',
                    'id_no' => $userData?->id_no ?? 'N/A',
                    'email' => $userData?->email ?? '',
                    'year_level' => $userData?->year_level ?? null,
                    'course' => $course ? [
                        'course_id' => $course->course_id,
                        'course_code' => $course->course_code,
                        'course_name' => $course->course_name,
                    ] : null,
                    'position' => $candidate?->position?->title ?? 'Unknown',
                    'partylist_id' => $membership->partylist_id,
                    'partylist_name' => $membership->partylist?->name ?? '',
                    'requested_at' => $membership->created_at,
                    'status' => $membership->status,
                    'election' => $candidate?->election ? [
                        'election_id' => $candidate->election->election_id,
                        'title' => $candidate->election->title,
                    ] : null,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $formattedRequests,
                'total' => $formattedRequests->count(),
                'partylist' => [
                    'partylist_id' => $partylist->partylist_id,
                    'name' => $partylist->name,
                    'description' => $partylist->description,
                ],
                'is_creator' => true,
                'is_read_only' => false,
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching partylist requests: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch requests: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get all membership requests for a specific partylist
     */
    public function getPartylistRequests(Request $request, $partylistId)
    {
        try {
            $partylist = Partylist::findOrFail($partylistId);

            $requests = PartylistMembership::where('partylist_id', $partylistId)
                ->where('status', 'pending')
                ->with(['candidate.user', 'candidate.position'])
                ->orderBy('created_at', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $requests,
                'partylist' => $partylist,
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching partylist requests: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch requests: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Approve a membership request (Creator / Admin / COMELEC)
     */
    public function approveRequest(Request $request, $membershipId)
    {
        try {
            $user = $request->user();

            $membership = PartylistMembership::with([
                'partylist',
                'candidate.user',
                'candidate.position',
            ])->findOrFail($membershipId);

            if ($membership->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'This request has already been processed',
                ], 400);
            }

            $isCreator = $membership->partylist->created_by_user_id === $user->user_id;
            $isAdminOrComelec = in_array($user->role, ['admin', 'comelec']);

            if (!$isCreator && !$isAdminOrComelec) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Only the partylist creator can approve requests.',
                ], 403);
            }

            $membership->status = 'approved';
            $membership->approved_at = now();
            $membership->approved_by_user_id = $user->user_id;
            $membership->is_active = true;
            $membership->save();

            try {
                $notificationService = app(NotificationService::class);
                $notificationService->send(
                    $membership->candidate->user_id,
                    '✅ Partylist Membership Approved',
                    "Your request to join \"{$membership->partylist->name}\" has been approved! You are now a member.",
                    'system',
                    [
                        'partylist' => $membership->partylist->name,
                        'partylist_id' => $membership->partylist->partylist_id,
                        'status' => 'approved',
                    ],
                );
            } catch (\Exception $e) {
                Log::warning('Failed to send approval notification: ' . $e->getMessage());
            }

            AuditLog::create([
                'user_id' => $user->user_id,
                'action_type' => 'APPROVE_PARTYLIST_MEMBERSHIP',
                'target_table' => 'partylist_memberships',
                'target_id' => $membershipId,
                'new_value' => json_encode(['status' => 'approved']),
                'ip_address' => $request->ip(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Membership request approved successfully.',
                'data' => $membership->load('candidate.user'),
            ]);
        } catch (\Exception $e) {
            Log::error('Error approving membership request: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to approve request: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reject a membership request (Creator / Admin / COMELEC)
     */
    public function rejectRequest(Request $request, $membershipId)
    {
        try {
            $user = $request->user();

            $membership = PartylistMembership::with([
                'partylist',
                'candidate.user',
                'candidate.position',
            ])->findOrFail($membershipId);

            if ($membership->status !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'This request has already been processed',
                ], 400);
            }

            $isCreator = $membership->partylist->created_by_user_id === $user->user_id;
            $isAdminOrComelec = in_array($user->role, ['admin', 'comelec']);

            if (!$isCreator && !$isAdminOrComelec) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Only the partylist creator, Admin, or COMELEC can reject requests.',
                ], 403);
            }

            $membership->status = 'rejected';
            $membership->is_active = false;
            $membership->save();

            try {
                $notificationService = app(NotificationService::class);
                $notificationService->send(
                    $membership->candidate->user_id,
                    '❌ Partylist Membership Rejected',
                    "Your request to join \"{$membership->partylist->name}\" has been rejected.",
                    'system',
                    [
                        'partylist' => $membership->partylist->name,
                        'partylist_id' => $membership->partylist->partylist_id,
                        'status' => 'rejected',
                    ],
                );
            } catch (\Exception $e) {
                Log::warning('Failed to send rejection notification: ' . $e->getMessage());
            }

            AuditLog::create([
                'user_id' => $user->user_id,
                'action_type' => 'REJECT_PARTYLIST_MEMBERSHIP',
                'target_table' => 'partylist_memberships',
                'target_id' => $membershipId,
                'new_value' => json_encode(['status' => 'rejected']),
                'ip_address' => $request->ip(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Membership request rejected.',
                'data' => $membership->load('candidate.user'),
            ]);
        } catch (\Exception $e) {
            Log::error('Error rejecting membership request: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to reject request: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function getMyMembershipStatus(Request $request, $electionId)
    {
        try {
            $user = $request->user();

            $candidate = Candidate::where('user_id', $user->user_id)
                ->where('election_id', $electionId)
                ->first();

            if (!$candidate) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not a candidate in this election',
                ], 403);
            }

            $membership = PartylistMembership::where('candidate_id', $candidate->candidate_id)
                ->with(['partylist'])
                ->first();

            if (!$membership) {
                return response()->json([
                    'success' => true,
                    'data' => null,
                    'message' => 'You are not a member of any partylist',
                ]);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'membership_id' => $membership->membership_id,
                    'partylist' => $membership->partylist ? [
                        'partylist_id' => $membership->partylist->partylist_id,
                        'name' => $membership->partylist->name,
                    ] : null,
                    'status' => $membership->status,
                    'is_approved' => $membership->status === 'approved',
                    'is_pending' => $membership->status === 'pending',
                    'requested_at' => $membership->created_at,
                    'approved_at' => $membership->approved_at,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching membership status: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch membership status: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Debug helper — remove in production
     */
    public function debugCheck(Request $request)
    {
        try {
            $user = $request->user();

            $partylists = Partylist::where('created_by_user_id', $user->user_id)->get();

            $allPending = PartylistMembership::where('status', 'pending')
                ->with(['partylist', 'candidate.user'])
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'user_id' => $user->user_id,
                    'user_name' => $user->first_name . ' ' . $user->last_name,
                    'user_role' => $user->role,
                    'partylists_created' => $partylists->map(function ($p) {
                        return [
                            'id' => $p->partylist_id,
                            'name' => $p->name,
                            'pending_requests' => PartylistMembership::where('partylist_id', $p->partylist_id)
                                ->where('status', 'pending')
                                ->count(),
                        ];
                    }),
                    'all_pending_requests' => $allPending->map(function ($m) {
                        return [
                            'membership_id' => $m->membership_id,
                            'partylist_name' => $m->partylist?->name,
                            'candidate_name' => $m->candidate?->user
                                ? $m->candidate->user->first_name . ' ' . $m->candidate->user->last_name
                                : 'Unknown',
                            'status' => $m->status,
                        ];
                    }),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ], 500);
        }
    }
}
