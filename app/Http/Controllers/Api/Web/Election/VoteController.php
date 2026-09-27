<?php
// app/Http/Controllers/Api/Web/Election/VoteController.php

namespace App\Http\Controllers\Api\Web\Election;

use App\Http\Controllers\Controller;
use App\Models\Election;
use App\Models\Vote;
use App\Models\DigitalReceipt;
use App\Models\ElectionParticipation;
use App\Services\VoterEligibilityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class VoteController extends Controller
{
    public function checkVoteStatus(Request $request, $electionId)
    {
        try {
            $user = $request->user();
            $election = Election::find($electionId);

            if (!$election) {
                return response()->json(['success' => false, 'message' => 'Election not found'], 404);
            }

            $isEligible = VoterEligibilityService::isEligible($user, $election);

            if (!$isEligible) {
                return response()->json([
                    'success' => true,
                    'is_registered' => false,
                    'has_voted' => false,
                    'is_eligible' => false,
                ]);
            }

            $participation = ElectionParticipation::where('election_id', $electionId)
                ->where('user_id', $user->user_id)
                ->first();

            return response()->json([
                'success' => true,
                'is_registered' => true,
                'has_voted' => $participation ? $participation->has_voted : false,
                'voted_at' => $participation?->voted_at,
                'sanction_eligible' => $participation?->sanction_eligible ?? false,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to check vote status: ' . $e->getMessage());
            return response()->json(['success' => false], 500);
        }
    }

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

            if (!$receipt) {
                return response()->json(['success' => false, 'message' => 'Receipt not found'], 404);
            }

            $votes = Vote::where('user_id', $user->user_id)
                ->where('election_id', $electionId)
                ->with(['candidate.user', 'candidate.position', 'candidate.partylist'])
                ->get();

            return response()->json([
                'success' => true,
                'receipt' => [
                    'receipt_code' => $receipt->receipt_code,
                    'generated_at' => $receipt->generated_at,
                    'sent_to_email' => $receipt->sent_to_email,
                ],
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
            return response()->json(['success' => false], 500);
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

            return response()->json(['success' => true, 'history' => $history, 'total' => $history->count()]);
        } catch (\Exception $e) {
            return response()->json(['success' => false], 500);
        }
    }

    public function resendReceipt(Request $request, $electionId)
    {
        try {
            $user = $request->user();

            $receipt = DigitalReceipt::where('election_id', $electionId)
                ->where('user_id', $user->user_id)
                ->first();

            if (!$receipt) {
                return response()->json(['success' => false, 'message' => 'Receipt not found'], 404);
            }

            \App\Jobs\SendVoteReceipt::dispatch(
                $user->email,
                $receipt->receipt_code,
                $user->first_name,
                $receipt->election->title
            );

            return response()->json(['success' => true, 'message' => 'Receipt resent successfully']);
        } catch (\Exception $e) {
            return response()->json(['success' => false], 500);
        }
    }

    public function getStatistics(Request $request, $electionId)
    {
        try {
            $user = $request->user();

            if (!in_array($user->role, ['admin', 'comelec'])) {
                return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
            }

            $election = Election::findOrFail($electionId);
            $totalVoters = VoterEligibilityService::eligibleVoterCount($election);
            $votedCount = ElectionParticipation::where('election_id', $electionId)
                ->where('has_voted', true)
                ->count();

            $votesPerHour = Vote::where('election_id', $electionId)
                ->select(DB::raw('HOUR(timestamp) as hour'), DB::raw('COUNT(*) as count'))
                ->groupBy('hour')
                ->orderBy('hour')
                ->get();

            $votesPerPosition = Vote::where('election_id', $electionId)
                ->select('positions.title', DB::raw('COUNT(*) as count'))
                ->join('positions', 'votes.position_id', '=', 'positions.position_id')
                ->groupBy('positions.title')
                ->get();

            $recentVotes = Vote::where('election_id', $electionId)
                ->with(['candidate.user', 'candidate.position'])
                ->orderBy('timestamp', 'desc')
                ->limit(20)
                ->get()
                ->map(function ($vote) {
                    return [
                        'candidate_name' => $vote->candidate->user->first_name . ' ' . $vote->candidate->user->last_name,
                        'position' => $vote->position->title,
                        'timestamp' => $vote->timestamp,
                    ];
                });

            return response()->json([
                'success' => true,
                'statistics' => [
                    'total_voters' => $totalVoters,
                    'voted_count' => $votedCount,
                    'turnout_percentage' => $totalVoters > 0 ? round(($votedCount / $totalVoters) * 100, 2) : 0,
                    'remaining_voters' => $totalVoters - $votedCount,
                    'votes_per_hour' => $votesPerHour,
                    'votes_per_position' => $votesPerPosition,
                    'recent_votes' => $recentVotes,
                    'last_updated' => now(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false], 500);
        }
    }

    public function getTurnoutSummary(Request $request, $electionId)
    {
        try {
            $user = $request->user();

            if (!in_array($user->role, ['admin', 'comelec'])) {
                return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
            }

            $election = Election::find($electionId);
            if (!$election) {
                return response()->json(['success' => false, 'message' => 'Election not found'], 404);
            }

            $totalVoters = VoterEligibilityService::eligibleVoterCount($election);
            $votedCount = ElectionParticipation::where('election_id', $electionId)
                ->where('has_voted', true)
                ->count();

            $turnoutByCourse = VoterEligibilityService::eligibleVotersQuery($election)
                ->join('courses', 'users.course_id', '=', 'courses.course_id')
                ->leftJoin('election_participations', function ($join) use ($electionId) {
                    $join->on('users.user_id', '=', 'election_participations.user_id')
                        ->where('election_participations.election_id', '=', $electionId);
                })
                ->select(
                    'courses.course_code',
                    DB::raw('COUNT(users.user_id) as total'),
                    DB::raw('SUM(CASE WHEN election_participations.has_voted = 1 THEN 1 ELSE 0 END) as voted')
                )
                ->groupBy('courses.course_code')
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'total_voters' => $totalVoters,
                    'voted_count' => $votedCount,
                    'turnout_percentage' => $totalVoters > 0 ? round(($votedCount / $totalVoters) * 100, 2) : 0,
                    'remaining_voters' => $totalVoters - $votedCount,
                    'turnout_by_course' => $turnoutByCourse,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false], 500);
        }
    }

    public function getCandidateVoteTickets($electionId, $candidateId, Request $request)
    {
        try {
            $election = Election::find($electionId);
            if (!$election) {
                return response()->json(['success' => false, 'message' => 'Election not found'], 404);
            }

            $candidate = \App\Models\Candidate::with(['user'])
                ->where('candidate_id', $candidateId)
                ->where('election_id', $electionId)
                ->first();

            if (!$candidate) {
                return response()->json(['success' => false, 'message' => 'Candidate not found'], 404);
            }

            $votes = Vote::where('candidate_id', $candidateId)
                ->where('election_id', $electionId)
                ->with(['user'])
                ->orderBy('timestamp', 'desc')
                ->get();

            $tickets = [];
            foreach ($votes as $vote) {
                $receipt = DigitalReceipt::where('election_id', $electionId)
                    ->where('user_id', $vote->user_id)
                    ->first();

                $receiptCode = $receipt ? $receipt->receipt_code : null;
                if (!$receiptCode) {
                    $receiptCode = 'VOTE-' . strtoupper(substr(md5($vote->vote_id), 0, 12));
                }

                $ticketData = [
                    'vote_id' => $vote->vote_id,
                    'ticket_number' => $receiptCode,
                    'voted_at' => $vote->timestamp,
                    'has_receipt' => (bool) $receipt,
                ];

                if (!$election->isOngoing()) {
                    $ticketData['voter'] = $vote->user ? [
                        'user_id' => $vote->user->user_id,
                        'first_name' => $vote->user->first_name,
                        'last_name' => $vote->user->last_name,
                    ] : null;
                }

                $tickets[] = $ticketData;
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'candidate_id' => $candidateId,
                    'candidate_name' => $candidate->user
                        ? $candidate->user->first_name . ' ' . $candidate->user->last_name
                        : 'Unknown Candidate',
                    'total_votes' => $votes->count(),
                    'tickets' => $tickets,
                    'is_ongoing' => $election->isOngoing(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}