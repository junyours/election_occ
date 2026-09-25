<?php
// app/Http/Controllers/Api/Mobile/Election/MobileVoteController.php

namespace App\Http\Controllers\Api\Mobile\Election;

use App\Http\Controllers\Controller;
use App\Models\Election;
use App\Models\Vote;
use App\Models\Candidate;
use App\Models\DigitalReceipt;
use App\Models\ElectionParticipation;
use App\Models\AuditLog;
use App\Services\NotificationService;
use App\Services\VoterEligibilityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class MobileVoteController extends Controller
{
    public function getReceipt(Request $request, $electionId)
    {
        try {
            $user = $request->user();

            $participation = ElectionParticipation::where('election_id', $electionId)
                ->where('user_id', $user->user_id)
                ->first();

            if (!$participation || !$participation->has_voted) {
                return response()->json(['success' => false, 'message' => 'No vote found'], 404);
            }

            $receipt = DigitalReceipt::where('election_id', $electionId)
                ->where('user_id', $user->user_id)
                ->first();

            $votes = Vote::where('user_id', $user->user_id)
                ->where('election_id', $electionId)
                ->with(['candidate.user', 'candidate.position', 'candidate.partylist'])
                ->get();

            return response()->json([
                'success' => true,
                'receipt' => $receipt ? [
                    'receipt_code' => $receipt->receipt_code,
                    'generated_at' => $receipt->generated_at,
                    'sent_to_email' => $receipt->sent_to_email,
                ] : null,
                'votes' => $votes->map(function ($vote) {
                    return [
                        'position' => $vote->position->title,
                        'candidate_name' => $vote->candidate->user->first_name . ' ' . $vote->candidate->user->last_name,
                        'partylist' => $vote->candidate->partylist->name ?? 'Independent',
                        'timestamp' => $vote->timestamp,
                    ];
                }),
                'election_title' => $participation->election->title,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to get receipt: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to get receipt'], 500);
        }
    }

    public function getHistory(Request $request)
    {
        try {
            $user = $request->user();

            $history = ElectionParticipation::where('user_id', $user->user_id)
                ->where('has_voted', true)
                ->with('election')
                ->orderBy('voted_at', 'desc')
                ->get()
                ->map(function ($p) {
                    $receipt = DigitalReceipt::where('election_id', $p->election_id)
                        ->where('user_id', $p->user_id)
                        ->first();

                    return [
                        'election_id' => $p->election_id,
                        'election_title' => $p->election->title,
                        'election_type' => $p->election->election_type,
                        'voted_at' => $p->voted_at,
                        'receipt_code' => $receipt?->receipt_code,
                    ];
                });

            return response()->json(['success' => true, 'history' => $history]);
        } catch (\Exception $e) {
            Log::error('Failed to get history: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to get history'], 500);
        }
    }

    public function checkStatus(Request $request, $electionId)
    {
        try {
            $user = $request->user();

            if (!$user) {
                return response()->json(['success' => false, 'message' => 'User not authenticated'], 401);
            }

            $election = Election::find($electionId);
            if (!$election) {
                return response()->json(['success' => false, 'message' => 'Election not found'], 404);
            }

            $isEligible = VoterEligibilityService::isEligible($user, $election);

            if (!$isEligible) {
                return response()->json([
                    'success' => true,
                    'has_voted' => false,
                    'is_registered' => false,
                    'is_eligible' => false,
                ]);
            }

            $participation = ElectionParticipation::where('election_id', $electionId)
                ->where('user_id', $user->user_id)
                ->first();

            return response()->json([
                'success' => true,
                'has_voted' => $participation ? $participation->has_voted : false,
                'is_registered' => true,
                'is_eligible' => true,
                'voted_at' => $participation?->voted_at,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to check vote status: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to check status'], 500);
        }
    }

    public function castVote(Request $request, $electionId)
    {
        try {
            DB::beginTransaction();

            $user = $request->user();

            $election = Election::findOrFail($electionId);

            if (!$election->isOngoing()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Election is not ongoing',
                ], 403);
            }

            if (!VoterEligibilityService::isEligible($user, $election)) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not eligible to vote in this election',
                ], 403);
            }

            $participation = ElectionParticipation::ensure(
                (int) $electionId,
                (int) $user->user_id
            );

            if ($participation->has_voted) {
                return response()->json([
                    'success' => false,
                    'message' => 'You have already voted in this election',
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'votes' => 'required|array',
                'votes.*.position_id' => 'required|exists:positions,position_id',
                'votes.*.candidate_id' => 'required|exists:candidates,candidate_id',
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $positionIds = array_column($request->votes, 'position_id');
            if (count($positionIds) !== count(array_unique($positionIds))) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot vote multiple times for the same position',
                ], 422);
            }

            $selectedCandidates = [];
            foreach ($request->votes as $voteData) {
                $candidate = Candidate::find($voteData['candidate_id']);
                if (!$candidate || $candidate->position_id != $voteData['position_id']) {
                    return response()->json(['success' => false, 'message' => 'Invalid candidate for position'], 422);
                }

                if (!$candidate->is_approved) {
                    return response()->json(['success' => false, 'message' => 'Candidate is not approved'], 422);
                }

                $selectedCandidates[] = [
                    'candidate_id' => $candidate->candidate_id,
                    'candidate_name' => $candidate->user->first_name . ' ' . $candidate->user->last_name,
                    'position_id' => $candidate->position_id,
                    'position_title' => $candidate->position->title,
                ];
            }

            foreach ($request->votes as $voteData) {
                Vote::create([
                    'user_id' => $user->user_id,
                    'candidate_id' => $voteData['candidate_id'],
                    'position_id' => $voteData['position_id'],
                    'election_id' => $electionId,
                    'timestamp' => now(),
                ]);
            }

            $participation->has_voted = true;
            $participation->voted_at = now();
            $participation->save();

            $receiptCode = 'VOTE-' . strtoupper(Str::random(16));
            DigitalReceipt::create([
                'election_id' => $electionId,
                'user_id' => $user->user_id,
                'receipt_code' => $receiptCode,
                'sent_to_email' => $user->email,
                'generated_at' => now(),
            ]);

            AuditLog::create([
                'user_id' => $user->user_id,
                'action_type' => 'MOBILE_VOTE_CAST',
                'target_table' => 'votes',
                'target_id' => null,
                'old_value' => json_encode([
                    'election_id' => $electionId,
                    'election_title' => $election->title,
                    'voter_id' => $user->user_id,
                    'voted_at' => now()->toISOString(),
                ]),
                'new_value' => json_encode([
                    'receipt_code' => $receiptCode,
                    'positions_voted' => count($request->votes),
                    'candidates' => $selectedCandidates,
                ]),
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'timestamp' => now(),
            ]);

            DB::commit();

            try {
                app(NotificationService::class)->voteConfirmed(
                    $user->user_id,
                    $election->title,
                    $receiptCode
                );
            } catch (\Exception $e) {
                Log::warning('Failed to send vote confirmation: ' . $e->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Vote cast successfully',
                'receipt_code' => $receiptCode,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Vote casting failed: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to cast vote: ' . $e->getMessage(),
            ], 500);
        }
    }
}