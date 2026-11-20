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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class MobileVoteController extends Controller
{
    // OTP lifetimes
    private const VOTE_OTP_TTL_SECONDS       = 600; // 10 min  — the code itself
    private const VOTE_OTP_RESEND_COOLDOWN   = 30;  // 30 s   — resend gate
    private const VOTE_OTP_TOKEN_TTL_SECONDS = 900; // 15 min — castVote token

    // ============================================================
    // STEP 1 — request OTP
    // POST /mobile/elections/{electionId}/vote/request-otp
    // ============================================================
    public function requestVoteOtp(Request $request, $electionId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $election = Election::find($electionId);
        if (!$election) {
            return response()->json(['success' => false, 'message' => 'Election not found'], 404);
        }
        if (!$election->isOngoing()) {
            return response()->json(['success' => false, 'message' => 'Election is not ongoing'], 403);
        }
        if (!VoterEligibilityService::isEligible($user, $election)) {
            return response()->json(['success' => false, 'message' => 'You are not eligible to vote in this election'], 403);
        }

        $participation = ElectionParticipation::ensure((int) $electionId, (int) $user->user_id);
        if ($participation->has_voted) {
            return response()->json(['success' => false, 'message' => 'You have already voted in this election'], 403);
        }

        $cooldownKey = "vote-otp:{$user->user_id}:{$electionId}:cooldown";
        if (Cache::has($cooldownKey)) {
            $ttl = Cache::get($cooldownKey);
            return response()->json([
                'success'     => false,
                'message'     => 'Please wait a moment before requesting another code.',
                'retry_after' => (int) $ttl,
            ], 429);
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        Cache::put(
            "vote-otp:{$user->user_id}:{$electionId}:code",
            $code,
            now()->addSeconds(self::VOTE_OTP_TTL_SECONDS),
        );
        Cache::put(
            $cooldownKey,
            self::VOTE_OTP_RESEND_COOLDOWN,
            now()->addSeconds(self::VOTE_OTP_RESEND_COOLDOWN),
        );

        try {
            Mail::raw(
                "Your OCC election verification code is: {$code}\n\n"
                . "It expires in " . (self::VOTE_OTP_TTL_SECONDS / 60) . " minutes.\n"
                . "If you did not initiate this, ignore this email.",
                function ($m) use ($user) {
                    $m->to($user->email)
                      ->subject('Your vote verification code — OCC Election');
                }
            );
        } catch (\Throwable $e) {
            Log::error('Vote OTP email failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to send verification code. Please try again.',
            ], 500);
        }

        AuditLog::create([
            'user_id'      => $user->user_id,
            'action_type'  => 'MOBILE_VOTE_OTP_SENT',
            'target_table' => 'elections',
            'target_id'    => $electionId,
            'old_value'    => null,
            'new_value'    => json_encode(['email' => $user->email]),
            'ip_address'   => $request->ip(),
            'user_agent'   => $request->userAgent(),
            'timestamp'    => now(),
        ]);

        return response()->json([
            'success'    => true,
            'message'    => 'Verification code sent to your email.',
            'expires_in' => self::VOTE_OTP_TTL_SECONDS,
        ]);
    }

    // ============================================================
    // STEP 2 — verify OTP, issue vote token
    // POST /mobile/elections/{electionId}/vote/verify-otp
    // ============================================================
    public function verifyVoteOtp(Request $request, $electionId)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|digits:6',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $election = Election::find($electionId);
        if (!$election) {
            return response()->json(['success' => false, 'message' => 'Election not found'], 404);
        }

        $codeKey = "vote-otp:{$user->user_id}:{$electionId}:code";
        $cached  = Cache::get($codeKey);

        if (!$cached || !hash_equals((string) $cached, (string) $request->code)) {
            AuditLog::create([
                'user_id'      => $user->user_id,
                'action_type'  => 'MOBILE_VOTE_OTP_FAILED',
                'target_table' => 'elections',
                'target_id'    => $electionId,
                'old_value'    => null,
                'new_value'    => json_encode(['email' => $user->email]),
                'ip_address'   => $request->ip(),
                'user_agent'   => $request->userAgent(),
                'timestamp'    => now(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired verification code.',
            ], 401);
        }

        // Burn the code — single use
        Cache::forget($codeKey);

        // Issue a single-use token for castVote()
        $token = Str::random(48);
        Cache::put(
            "vote-otp:{$user->user_id}:{$electionId}:token",
            $token,
            now()->addSeconds(self::VOTE_OTP_TOKEN_TTL_SECONDS),
        );

        return response()->json([
            'success'    => true,
            'message'    => 'Verification successful. You may now submit your vote.',
            'token'      => $token,
            'expires_in' => self::VOTE_OTP_TOKEN_TTL_SECONDS,
        ]);
    }

    // ============================================================
    // STEP 3 — cast the vote + create the receipt atomically
    // POST /mobile/elections/{electionId}/vote
    // Header: X-Vote-Otp-Token
    // ============================================================
    public function castVote(Request $request, $electionId)
    {
        try {
            // ---------- 1. OTP token gate ----------
            $user = $request->user();
            if (!$user) {
                return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
            }

            $providedToken = (string) $request->header('X-Vote-Otp-Token', '');
            if ($providedToken === '') {
                return response()->json([
                    'success' => false,
                    'message' => 'OTP verification token is required. Please verify your code first.',
                ], 403);
            }

            $tokenKey    = "vote-otp:{$user->user_id}:{$electionId}:token";
            $cachedToken = Cache::get($tokenKey);

            if (!$cachedToken || !hash_equals((string) $cachedToken, $providedToken)) {
                return response()->json([
                    'success' => false,
                    'message' => 'OTP verification token is invalid or expired. Please verify your code again.',
                ], 403);
            }

            Cache::forget($tokenKey);

            // ---------- 2. Transaction ----------
            DB::beginTransaction();

            $election = Election::findOrFail($electionId);

            if (!$election->isOngoing()) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'Election is not ongoing'], 403);
            }
            if (!VoterEligibilityService::isEligible($user, $election)) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'You are not eligible to vote in this election'], 403);
            }

            $participation = ElectionParticipation::ensure(
                (int) $electionId,
                (int) $user->user_id,
            );
            if ($participation->has_voted) {
                DB::rollBack();
                return response()->json(['success' => false, 'message' => 'You have already voted in this election'], 403);
            }

            // ---------- 3. Validate payload ----------
            $validator = Validator::make($request->all(), [
                'votes'                      => 'required|array|min:1',
                'votes.*.position_id'        => 'required|exists:positions,position_id',
                'votes.*.candidate_id'       => 'nullable|exists:candidates,candidate_id',
                'votes.*.abstained'          => 'boolean',
                'location'                   => 'nullable|array',
                'location.latitude'          => 'nullable|numeric|between:-90,90',
                'location.longitude'         => 'nullable|numeric|between:-180,180',
                'location.accuracy'          => 'nullable|numeric|min:0',
                'location.address'           => 'nullable|string|max:255',
                'location.source'            => 'nullable|in:gps,manual',
                'votes.*.location'           => 'nullable|array',
            ]);
            if ($validator->fails()) {
                DB::rollBack();
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $positionIds = array_column($request->votes, 'position_id');
            if (count($positionIds) !== count(array_unique($positionIds))) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot vote multiple times for the same position.',
                ], 422);
            }

            $fallback = $this->normalizeLocation($request->input('location'));

            // ---------- 4. Per-position checks ----------
            $selectedCandidates = [];
            $abstainedPositions = [];
            $votesToInsert      = [];

            foreach ($request->votes as $voteData) {
                $positionId = (int) $voteData['position_id'];
                $abstained  = (bool) ($voteData['abstained'] ?? false);

                $rowLocation = $this->normalizeLocation($voteData['location'] ?? null) ?? $fallback;

                if ($abstained) {
                    if (!empty($voteData['candidate_id'])) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => "Abstained position {$positionId} cannot carry a candidate_id.",
                        ], 422);
                    }

                    $abstainedPositions[] = $positionId;
                    $votesToInsert[] = array_merge([
                        'user_id'      => $user->user_id,
                        'candidate_id' => null,
                        'position_id'  => $positionId,
                        'election_id'  => $electionId,
                        'timestamp'    => now(),
                    ], $this->locationColumns($rowLocation));
                    continue;
                }

                if (empty($voteData['candidate_id'])) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => "Please choose a candidate or abstain for position {$positionId}.",
                    ], 422);
                }

                $candidate = Candidate::with(['user', 'position'])->find($voteData['candidate_id']);
                if (!$candidate || (int) $candidate->position_id !== $positionId) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'Invalid candidate for the given position.',
                    ], 422);
                }
                if (!$candidate->is_approved) {
                    DB::rollBack();
                    return response()->json(['success' => false, 'message' => 'Candidate is not approved.'], 422);
                }

                $selectedCandidates[] = [
                    'candidate_id'   => $candidate->candidate_id,
                    'candidate_name' => trim(
                        ($candidate->user->first_name ?? '') . ' ' .
                        ($candidate->user->last_name ?? ''),
                    ),
                    'position_id'    => $candidate->position_id,
                    'position_title' => $candidate->position->title ?? null,
                ];

                $votesToInsert[] = array_merge([
                    'user_id'      => $user->user_id,
                    'candidate_id' => $candidate->candidate_id,
                    'position_id'  => $positionId,
                    'election_id'  => $electionId,
                    'timestamp'    => now(),
                ], $this->locationColumns($rowLocation));
            }

            // ---------- 5. Persist votes ----------
            foreach ($votesToInsert as $row) {
                Vote::create($row);
            }

            $participation->has_voted = true;
            $participation->voted_at  = now();
            $participation->save();

            // ---------- 6. Create the receipt FIRST ----------
            // Doing this before audit + notification means the receipt
            // is guaranteed to exist the moment the vote is committed.
            $receipt = DigitalReceipt::create([
                'election_id'   => $electionId,
                'user_id'       => $user->user_id,
                'receipt_code'  => 'VOTE-' . strtoupper(Str::random(16)),
                'sent_to_email' => $user->email,
                'generated_at'  => now(),
            ]);

            $receiptCode = $receipt->receipt_code;

            // ---------- 7. Audit ----------
            AuditLog::create([
                'user_id'      => $user->user_id,
                'action_type'  => 'MOBILE_VOTE_CAST',
                'target_table' => 'votes',
                'target_id'    => null,
                'old_value'    => json_encode([
                    'election_id'    => $electionId,
                    'election_title' => $election->title,
                    'voter_id'       => $user->user_id,
                    'voted_at'       => now()->toISOString(),
                ]),
                'new_value'    => json_encode([
                    'receipt_code'           => $receiptCode,
                    'positions_voted'        => count($selectedCandidates),
                    'positions_abstained'    => count($abstainedPositions),
                    'candidates'             => $selectedCandidates,
                    'abstained_position_ids' => $abstainedPositions,
                    'location'               => $fallback,
                ]),
                'ip_address'   => $request->ip(),
                'user_agent'   => $request->userAgent(),
                'timestamp'    => now(),
            ]);

            DB::commit();

            // ---------- 8. Notification (best-effort, post-commit) ----------
            try {
                app(NotificationService::class)->voteConfirmed(
                    $user->user_id,
                    $election->title,
                    $receiptCode,
                );
            } catch (\Throwable $e) {
                Log::warning('Vote confirmation notification failed: ' . $e->getMessage());
            }

            return response()->json([
                'success'             => true,
                'message'             => 'Vote cast successfully',
                'receipt_code'        => $receiptCode,
                'receipt'             => [
                    'receipt_code'  => $receipt->receipt_code,
                    'generated_at'  => $receipt->generated_at,
                    'sent_to_email' => $receipt->sent_to_email,
                ],
                'positions_voted'     => count($selectedCandidates),
                'positions_abstained' => count($abstainedPositions),
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Vote casting failed: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Failed to cast vote: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ============================================================
    // Receipt — includes location + abstains
    // ============================================================
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
                ->with(['candidate.user', 'candidate.position', 'candidate.partylist', 'position'])
                ->get();

            $receiptLocation = null;
            foreach ($votes as $v) {
                if ($v->vote_latitude !== null && $v->vote_longitude !== null) {
                    $receiptLocation = [
                        'latitude'  => (float) $v->vote_latitude,
                        'longitude' => (float) $v->vote_longitude,
                        'accuracy'  => $v->vote_accuracy !== null ? (float) $v->vote_accuracy : null,
                        'address'   => $v->vote_address,
                        'source'    => $v->vote_source,
                    ];
                    break;
                }
            }

            return response()->json([
                'success' => true,
                'receipt' => $receipt ? [
                    'receipt_code'  => $receipt->receipt_code,
                    'generated_at'  => $receipt->generated_at,
                    'sent_to_email' => $receipt->sent_to_email,
                    'location'      => $receiptLocation,
                ] : null,
                'votes' => $votes->map(function ($vote) {
                    $isAbstain = $vote->candidate_id === null;

                    return [
                        'position'       => $vote->position->title ?? null,
                        'abstained'      => $isAbstain,
                        'candidate_id'   => $vote->candidate_id,
                        'candidate_name' => $isAbstain
                            ? null
                            : trim(
                                ($vote->candidate->user->first_name ?? '') . ' ' .
                                ($vote->candidate->user->last_name ?? ''),
                            ),
                        'partylist'      => $isAbstain
                            ? null
                            : ($vote->candidate->partylist->name ?? 'Independent'),
                        'timestamp'      => $vote->timestamp,
                        'location'       => $vote->vote_latitude !== null ? [
                            'latitude'  => (float) $vote->vote_latitude,
                            'longitude' => (float) $vote->vote_longitude,
                            'accuracy'  => $vote->vote_accuracy !== null ? (float) $vote->vote_accuracy : null,
                            'address'   => $vote->vote_address,
                            'source'    => $vote->vote_source,
                        ] : null,
                    ];
                }),
                'election_title' => $participation->election->title,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to get receipt: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to get receipt'], 500);
        }
    }

    // ============================================================
    // History
    // ============================================================
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
                        'election_id'    => $p->election_id,
                        'election_title' => $p->election->title,
                        'election_type'  => $p->election->election_type,
                        'voted_at'       => $p->voted_at,
                        'receipt_code'   => $receipt?->receipt_code,
                    ];
                });

            return response()->json(['success' => true, 'history' => $history]);
        } catch (\Throwable $e) {
            Log::error('Failed to get history: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to get history'], 500);
        }
    }

    // ============================================================
    // Status
    // ============================================================
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
                    'success'       => true,
                    'has_voted'     => false,
                    'is_registered' => false,
                    'is_eligible'   => false,
                ]);
            }

            $participation = ElectionParticipation::where('election_id', $electionId)
                ->where('user_id', $user->user_id)
                ->first();

            return response()->json([
                'success'       => true,
                'has_voted'     => $participation ? $participation->has_voted : false,
                'is_registered' => true,
                'is_eligible'   => true,
                'voted_at'      => $participation?->voted_at,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to check vote status: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Failed to check status'], 500);
        }
    }

    // ============================================================
    // Location helpers
    // ============================================================
    private function normalizeLocation($loc): ?array
    {
        if (!is_array($loc)) return null;

        $lat = $loc['latitude']  ?? null;
        $lng = $loc['longitude'] ?? null;

        if ($lat === null || $lng === null) return null;
        if (!is_numeric($lat) || !is_numeric($lng)) return null;

        return [
            'latitude'  => (float) $lat,
            'longitude' => (float) $lng,
            'accuracy'  => isset($loc['accuracy']) && is_numeric($loc['accuracy'])
                ? (float) $loc['accuracy']
                : null,
            'address'   => isset($loc['address']) && is_string($loc['address'])
                ? substr(trim($loc['address']), 0, 255)
                : null,
            'source'    => in_array(($loc['source'] ?? null), ['gps', 'manual'], true)
                ? $loc['source']
                : null,
        ];
    }

    private function locationColumns(?array $loc): array
    {
        if (!$loc) {
            return [
                'vote_latitude'  => null,
                'vote_longitude' => null,
                'vote_accuracy'  => null,
                'vote_address'   => null,
                'vote_source'    => null,
            ];
        }

        return [
            'vote_latitude'  => $loc['latitude'],
            'vote_longitude' => $loc['longitude'],
            'vote_accuracy'  => $loc['accuracy'],
            'vote_address'   => $loc['address'],
            'vote_source'    => $loc['source'],
        ];
    }
}