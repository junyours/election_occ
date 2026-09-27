<?php
// app/Http/Controllers/Api/Web/Candidacy/CandidacyController.php

namespace App\Http\Controllers\Api\Web\Candidacy;

use App\Http\Controllers\Controller;
use App\Models\CandidacyApplication;
use App\Models\Election;
use App\Models\User;
use App\Models\Candidate;
use App\Models\Position;
use App\Models\Partylist;
use App\Models\PartylistMembership;
use App\Models\AuditLog;
use App\Services\NotificationService;
use App\Traits\HasApiResponse;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class CandidacyController extends Controller
{
    use HasApiResponse;

    // ============================================================
    // SUBMIT APPLICATION
    // ============================================================
    public function apply(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'election_id' => 'required|exists:elections,election_id',
            'form_data' => 'required|array',
            'form_data.lastName' => 'required|string|max:50',
            'form_data.firstName' => 'required|string|max:50',
            'form_data.middleInitial' => 'nullable|string|max:5',
            'form_data.age' => 'required|integer|min:16|max:99',
            'form_data.course' => 'required|string|max:100',
            'form_data.presentAddress' => 'required|string|max:200',
            'form_data.presentAddress2' => 'nullable|string|max:200',
            'form_data.studentNo' => 'required|string|max:20',
            'form_data.currentYear' => 'required|string|max:20',
            'form_data.noUnitLoad' => 'required|integer|min:0|max:18',
            'form_data.cellphone' => 'required|string|min:10|max:11',
            'form_data.socialMedia' => 'nullable|string|max:100',
            'form_data.positionCSG' => 'boolean',
            'form_data.positionSC' => 'boolean',
            'form_data.selectedPosition' => 'required|string|max:100',
            'form_data.department' => 'nullable|string|max:100',
            'form_data.partyIndependent' => 'boolean',
            'form_data.partyExisting' => 'boolean',
            'form_data.partyCreate' => 'boolean',
            'form_data.partyOther' => 'boolean',
            'form_data.politicalParty' => 'nullable|string|max:100',
            'form_data.existing_partylist_id' => 'nullable',
            'form_data.newPartyName' => 'nullable|string|max:100',
            'form_data.newPartyDescription' => 'nullable|string|max:500',
            'selected_partylist_id' => 'nullable',
            'create_new_party' => 'nullable|boolean',
            'new_party_name' => 'nullable|string|max:100',
            'new_party_description' => 'nullable|string|max:500',
            'form_data.aff1Org' => 'nullable|string|max:100',
            'form_data.aff1Pos' => 'nullable|string|max:100',
            'form_data.aff1Date' => 'nullable|string|max:30',
            'form_data.aff2Org' => 'nullable|string|max:100',
            'form_data.aff2Pos' => 'nullable|string|max:100',
            'form_data.aff2Date' => 'nullable|string|max:30',
            'form_data.aff3Org' => 'nullable|string|max:100',
            'form_data.aff3Pos' => 'nullable|string|max:100',
            'form_data.aff3Date' => 'nullable|string|max:30',
            'form_data.signedDay' => 'required|integer|min:1|max:31',
            'form_data.signedMonth' => 'required|string|max:20',
            'form_data.signedYear' => 'required|string|max:10',
            'form_data.platform' => 'nullable|string',
            'form_data.qualifications' => 'nullable|string',
            'form_data.photo' => 'nullable|string',
            'form_data.signature' => 'nullable|string',
            'form_data.schoolYear' => 'nullable|string|max:20',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not authenticated',
            ], 401);
        }

        // Profile completeness guard
        $requiredProfileFields = [
            'first_name'      => 'First Name',
            'last_name'       => 'Last Name',
            'id_no'      => 'Student ID',
            'course_id'       => 'Course',
            'year_level'      => 'Year Level',
            'birthdate'       => 'Birthdate',
            'present_address' => 'Present Address',
            'cellphone'       => 'Cellphone',
            'no_unit_load'    => 'Number of Unit Load',
        ];

        $missing = [];
        foreach ($requiredProfileFields as $field => $label) {
            $value = $user->{$field} ?? null;
            if ($value === null || $value === '' || $value === 0) {
                $missing[] = $label;
            }
        }

        if (!empty($missing)) {
            return response()->json([
                'success' => false,
                'message' => 'Your profile is incomplete. Please complete the following in your profile before applying: ' . implode(', ', $missing),
                'missing_fields' => $missing,
            ], 422);
        }

        $electionId = $request->election_id;
        $formData = $request->form_data;

        $election = Election::with('course')->find($electionId);

        if (!$election) {
            return response()->json([
                'success' => false,
                'message' => 'Election not found',
            ], 404);
        }

        if (!\App\Services\VoterEligibilityService::canApplyForCandidacy($user, $election)) {
            return response()->json([
                'success' => false,
                'message' => \App\Services\VoterEligibilityService::getCandidacyRestrictionMessage($user, $election),
            ], 403);
        }

        // Party mode resolution
        $partyIndependent = (bool) ($request->input('form_data.partyIndependent') ?? false);
        $partyExisting    = (bool) ($request->input('form_data.partyExisting') ?? false);
        $partyCreate      = (bool) (
            $request->input('form_data.partyCreate')
            ?? $request->input('form_data.create_new_party')
            ?? $request->input('create_new_party')
            ?? false
        );

        $selectedPartylistId =
            $request->input('form_data.existing_partylist_id')
            ?? $request->input('selected_partylist_id')
            ?? null;

        $newPartyName =
            $request->input('form_data.newPartyName')
            ?? $request->input('form_data.new_party_name')
            ?? $request->input('new_party_name')
            ?? null;

        $newPartyDescription =
            $request->input('form_data.newPartyDescription')
            ?? $request->input('form_data.new_party_description')
            ?? $request->input('new_party_description')
            ?? null;

        if (!$partyIndependent && !$partyExisting && !$partyCreate) {
            $legacyOther = (bool) ($formData['partyOther'] ?? false);
            $legacyName = $formData['politicalParty'] ?? null;

            if ($legacyOther && !empty($legacyName)) {
                $partyCreate = true;
                $newPartyName = $legacyName;
            } elseif ($legacyOther && empty($legacyName)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Please enter the political party name',
                ], 422);
            }
        }

        $activeModes = [];
        if ($partyIndependent) $activeModes[] = 'Independent';
        if ($partyExisting)    $activeModes[] = 'Existing';
        if ($partyCreate)      $activeModes[] = 'Create';

        if (count($activeModes) === 0) {
            return response()->json([
                'success' => false,
                'message' => 'Please select a political party affiliation',
            ], 422);
        }

        if (count($activeModes) > 1) {
            return response()->json([
                'success' => false,
                'message' => 'Only one political party affiliation can be selected',
            ], 422);
        }

        $topPosition = Position::where('election_id', $electionId)
            ->orderBy('order_in_ballot')
            ->first();

        $selectedPositionTitle = $formData['selectedPosition'] ?? null;
        $isHighestPosition = $topPosition && $topPosition->title === $selectedPositionTitle;

        if ($partyCreate) {
            if (!$isHighestPosition) {
                return response()->json([
                    'success' => false,
                    'message' => 'Only candidates running for the highest position can create a new political party.',
                ], 422);
            }

            if (empty($newPartyName) || trim((string) $newPartyName) === '') {
                return response()->json([
                    'success' => false,
                    'message' => 'Please enter a name for your new political party',
                ], 422);
            }
        }

        if ($partyExisting) {
            if (empty($selectedPartylistId)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Please select an existing political party',
                ], 422);
            }

            $partylist = Partylist::where('partylist_id', $selectedPartylistId)
                ->where('election_id', $electionId)
                ->first();

            if (!$partylist) {
                return response()->json([
                    'success' => false,
                    'message' => 'The selected political party does not belong to this election.',
                ], 422);
            }
        }

        $hasCSG = (bool) ($formData['positionCSG'] ?? false);
        $hasSC  = (bool) ($formData['positionSC'] ?? false);

        if (!$hasCSG && !$hasSC) {
            return response()->json([
                'success' => false,
                'message' => 'Please select an organization',
            ], 422);
        }

        if ($hasCSG && $hasSC) {
            return response()->json([
                'success' => false,
                'message' => 'Please select only one organization',
            ], 422);
        }

        if (empty($selectedPositionTitle)) {
            return response()->json([
                'success' => false,
                'message' => 'Please select a specific position',
            ], 422);
        }

        $existing = CandidacyApplication::where('user_id', $user->user_id)
            ->where('election_id', $electionId)
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'You have already submitted an application for this election.',
            ], 400);
        }

        $isCandidate = Candidate::where('user_id', $user->user_id)
            ->where('election_id', $electionId)
            ->exists();

        if ($isCandidate) {
            return response()->json([
                'success' => false,
                'message' => 'You are already a candidate in this election.',
            ], 400);
        }

        $formData['partyIndependent']    = $partyIndependent;
        $formData['partyExisting']       = $partyExisting;
        $formData['partyCreate']         = $partyCreate;
        $formData['newPartyName']        = $newPartyName;
        $formData['newPartyDescription'] = $newPartyDescription;
        if ($selectedPartylistId) {
            $formData['existing_partylist_id'] = $selectedPartylistId;
        }

        $application = CandidacyApplication::create([
            'user_id' => $user->user_id,
            'election_id' => $electionId,
            'form_data' => $formData,
            'selected_partylist_id' => $partyExisting ? $selectedPartylistId : null,
            'admin_status' => 'pending',
        ]);

        // ✅ Generate the platform PDF immediately
        try {
            $this->generatePlatformPdf($application);
        } catch (\Exception $e) {
            Log::warning('Platform PDF generation failed on apply: ' . $e->getMessage());
        }

        AuditLog::create([
            'user_id' => $user->user_id,
            'action_type' => 'SUBMIT_CANDIDACY_APPLICATION',
            'target_table' => 'candidacy_applications',
            'target_id' => $application->application_id,
            'new_value' => json_encode([
                'election_id' => $electionId,
                'selected_partylist_id' => $application->selected_partylist_id,
                'party_mode' => $activeModes[0],
                'new_party_name' => $newPartyName,
            ]),
            'ip_address' => $request->ip(),
        ]);

        try {
            $notificationService = app(NotificationService::class);
            $position = $selectedPositionTitle;

            if ($election && $notificationService) {
                $notificationService->applicationSubmitted(
                    $user->user_id,
                    $election->title ?? 'Election',
                    $position,
                );

                $adminUsers = User::where('role', 'admin')->get();
                foreach ($adminUsers as $admin) {
                    $notificationService->send(
                        $admin->user_id,
                        '📋 New Candidacy Application',
                        "{$user->first_name} {$user->last_name} applied for {$position} in {$election->title}",
                        'system',
                        [
                            'applicant' => $user->first_name . ' ' . $user->last_name,
                            'position' => $position,
                            'election' => $election->title,
                            'application_id' => $application->application_id,
                        ],
                    );
                }
            }
        } catch (\Exception $e) {
            Log::warning('Failed to send application notifications: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Application submitted successfully.',
            'data' => $application,
        ], 201);
    }

    // ============================================================
    // ADMIN: LIST APPLICATIONS
    // ============================================================
    public function adminList(Request $request)
    {
        try {
            $query = CandidacyApplication::with(['user', 'election'])
                ->orderBy('created_at', 'desc');

            if ($request->has('status')) {
                $query->where('admin_status', $request->status);
            }

            if ($request->has('election_id')) {
                $query->where('election_id', $request->election_id);
            }

            $applications = $query->get();

            $transformed = $applications->map(function ($app) {
                return [
                    'application_id' => $app->application_id,
                    'user_id' => $app->user_id,
                    'election_id' => $app->election_id,
                    'form_data' => $app->form_data,
                    'admin_status' => $app->admin_status,
                    'admin_approved_at' => $app->admin_approved_at,
                    'admin_approved_by_user_id' => $app->admin_approved_by_user_id,
                    'admin_remarks' => $app->admin_remarks,
                    'recommendation_letter_path' => $app->recommendation_letter_path,
                    'platform_pdf_path' => $app->platform_pdf_path,
                    'letter_generated' => $app->letter_generated,
                    'created_at' => $app->created_at,
                    'updated_at' => $app->updated_at,
                    'user' => $app->user ? [
                        'user_id' => $app->user->user_id,
                        'first_name' => $app->user->first_name,
                        'last_name' => $app->user->last_name,
                        'email' => $app->user->email,
                        'student_id' => $app->user->student_id,
                    ] : null,
                    'election' => $app->election ? [
                        'election_id' => $app->election->election_id,
                        'title' => $app->election->title,
                    ] : null,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $transformed,
                'total' => $transformed->count(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch applications: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch applications: ' . $e->getMessage(),
                'data' => [],
            ], 500);
        }
    }

    // ============================================================
    // ADMIN: APPROVE
    // ============================================================
    public function adminApprove(Request $request, $id)
    {
        $application = CandidacyApplication::with(['user', 'election'])->findOrFail($id);

        if ($application->admin_status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This application has already been processed.',
            ], 400);
        }

        $user = $application->user;
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        $electionId = $application->election_id;
        $formData = $application->form_data;
        $selectedPartylistId = $application->selected_partylist_id;

        $existingCandidate = Candidate::where('user_id', $user->user_id)
            ->where('election_id', $electionId)
            ->first();

        if ($existingCandidate) {
            return response()->json([
                'success' => false,
                'message' => 'User is already a candidate in this election.',
            ], 400);
        }

        $partylist = null;
        $isCreator = false;
        $partylistName = null;
        $membership = null;

        DB::transaction(function () use (
            $application,
            $request,
            $user,
            $formData,
            $selectedPartylistId,
            &$partylist,
            &$isCreator,
            &$partylistName,
            &$membership
        ) {
            $application->admin_status = 'approved';
            $application->admin_approved_at = now();
            $application->admin_approved_by_user_id = $request->user()->user_id;
            $application->admin_remarks = $request->remarks;
            $application->save();

            $this->generateRecommendationLetter($application);

            $positionTitle = $formData['selectedPosition'] ?? null;

            if (!$positionTitle) {
                if ($formData['positionCSG'] ?? false) {
                    $positionTitle = 'CSG President';
                } elseif ($formData['positionSC'] ?? false) {
                    $positionTitle = 'Governor';
                } else {
                    $positionTitle = 'Other';
                }
            }

            $position = Position::where('election_id', $application->election_id)
                ->where('title', $positionTitle)
                ->first();

            if (!$position) {
                $position = Position::where('election_id', $application->election_id)
                    ->where('title', 'like', '%' . $positionTitle . '%')
                    ->first();
            }

            if (!$position) {
                $position = Position::where('election_id', $application->election_id)->first();
            }

            $candidate = Candidate::create([
                'user_id' => $user->user_id,
                'election_id' => $application->election_id,
                'position_id' => $position ? $position->position_id : null,
                'platform' => $formData['platform'] ?? 'To be announced',
                'qualifications' => $formData['qualifications'] ?? 'To be announced',
                'photo_url' => null,
                'is_approved' => true,
                'approved_by_user_id' => $request->user()->user_id,
                'approved_at' => now(),
            ]);

            $isHighest = $this->isHighestPosition($application->election_id, $positionTitle);

            $isIndependent = (bool) ($formData['partyIndependent'] ?? false);
            $isCreatingNewParty = (bool) (
                $formData['partyCreate']
                ?? $formData['partyOther']
                ?? false
            );
            $isJoiningExisting = (bool) ($formData['partyExisting'] ?? false);

            $shouldCreatePartylist = $isHighest && $isCreatingNewParty && !$isIndependent;

            if ($shouldCreatePartylist) {
                $partylist = $this->createPartylistForCandidate($candidate, $user, $formData);
                $isCreator = true;
                $partylistName = $partylist ? $partylist->name : null;
            } elseif ($isHighest && $isIndependent) {
                Log::info('ℹ️ Highest-position candidate is Independent — no partylist created', [
                    'candidate_id' => $candidate->candidate_id,
                    'user_id' => $user->user_id,
                ]);
            } elseif ($selectedPartylistId && !$isIndependent) {
                $partylist = Partylist::where('partylist_id', $selectedPartylistId)
                    ->where('election_id', $application->election_id)
                    ->first();

                if ($partylist) {
                    $membership = PartylistMembership::create([
                        'partylist_id' => $partylist->partylist_id,
                        'candidate_id' => $candidate->candidate_id,
                        'status' => 'pending',
                        'approved_at' => null,
                        'approved_by_user_id' => null,
                        'is_active' => true,
                    ]);

                    $partylistName = $partylist->name;

                    try {
                        $notificationService = app(NotificationService::class);
                        $creatorId = $partylist->created_by_user_id;
                        $candidateName = $user->first_name . ' ' . $user->last_name;
                        $positionTitleForNotification = $candidate->position
                            ? $candidate->position->title
                            : 'Unknown Position';

                        $notificationService->send(
                            $creatorId,
                            '📋 New Partylist Membership Request',
                            "{$candidateName} (Position: {$positionTitleForNotification}) has requested to join your partylist \"{$partylist->name}\". Please review and approve or reject the request.",
                            'system',
                            [
                                'candidate' => $candidateName,
                                'candidate_id' => $candidate->candidate_id,
                                'partylist' => $partylist->name,
                                'partylist_id' => $partylist->partylist_id,
                                'membership_id' => $membership->membership_id,
                                'position' => $positionTitleForNotification,
                            ],
                        );
                    } catch (\Exception $e) {
                        Log::warning('Failed to send partylist request notification: ' . $e->getMessage());
                    }
                }
            }

            if ($user->role !== 'candidate') {
                $user->role = 'candidate';
                $user->save();
            }

            AuditLog::create([
                'user_id' => $request->user()->user_id,
                'action_type' => 'ADMIN_APPROVE_CANDIDATE',
                'target_table' => 'candidates',
                'target_id' => $candidate->candidate_id,
                'new_value' => json_encode([
                    'user_id' => $user->user_id,
                    'election_id' => $application->election_id,
                    'position_id' => $position ? $position->position_id : null,
                    'position_title' => $positionTitle,
                    'is_creator' => $isCreator,
                    'partylist_created' => $shouldCreatePartylist,
                    'partylist_name' => $partylistName,
                    'auto_joined_partylist' => $membership !== null,
                    'membership_status' => $membership ? $membership->status : null,
                ]),
                'ip_address' => $request->ip(),
            ]);

            try {
                $notificationService = app(NotificationService::class);
                $notificationService->candidateApprovedAdmin(
                    $user->user_id,
                    $positionTitle,
                    $application->election->title,
                );
            } catch (\Exception $e) {
                Log::warning('Failed to send admin approval notification: ' . $e->getMessage());
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Application approved. Candidate registered successfully.',
            'data' => [
                'application' => $application->fresh(),
                'partylist_created' => $partylist !== null,
                'partylist_name' => $partylistName,
                'membership_status' => $membership
                    ? $membership->status
                    : ($isCreator ? 'approved' : null),
            ],
        ]);
    }

    // ============================================================
    // ADMIN: REJECT
    // ============================================================
    public function adminReject(Request $request, $id)
    {
        $application = CandidacyApplication::with(['user', 'election'])->findOrFail($id);

        if ($application->admin_status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This application has already been processed.',
            ], 400);
        }

        $user = $application->user;
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        $formData = $application->form_data;
        $positionTitle = $formData['selectedPosition'] ?? 'Unknown Position';

        $application->admin_status = 'rejected';
        $application->admin_remarks = $request->remarks;
        $application->save();

        AuditLog::create([
            'user_id' => $request->user()->user_id,
            'action_type' => 'ADMIN_REJECT_CANDIDATE',
            'target_table' => 'candidacy_applications',
            'target_id' => $application->application_id,
            'new_value' => json_encode(['admin_status' => 'rejected']),
            'ip_address' => $request->ip(),
        ]);

        try {
            $notificationService = app(NotificationService::class);
            if ($notificationService) {
                $notificationService->candidateRejected(
                    $user->user_id,
                    $positionTitle,
                    $application->election->title,
                    $request->remarks
                );
            }
        } catch (\Exception $e) {
            Log::warning('Failed to send rejection notification: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Application rejected.',
            'data' => $application,
        ]);
    }

    // ============================================================
    // COMELEC: LIST / APPROVE / REJECT
    // ============================================================
    public function comelecList(Request $request)
    {
        $query = CandidacyApplication::with(['user', 'election'])
            ->where('admin_status', 'approved')
            ->orderBy('created_at', 'desc');

        if ($request->has('status')) {
            $query->where('comelec_status', $request->status);
        }

        if ($request->has('election_id')) {
            $query->where('election_id', $request->election_id);
        }

        $applications = $query->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $applications,
        ]);
    }

    public function comelecApprove(Request $request, $id)
    {
        $application = CandidacyApplication::with(['user', 'election'])->findOrFail($id);

        if ($application->admin_status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'This application has not been admin-approved.',
            ], 400);
        }

        if ($application->comelec_status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This application has already been processed by COMELEC.',
            ], 400);
        }

        $user = $application->user;
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        $electionId = $application->election_id;
        $formData = $application->form_data;

        $existingCandidate = Candidate::where('user_id', $user->user_id)
            ->where('election_id', $electionId)
            ->first();

        if ($existingCandidate) {
            return response()->json([
                'success' => false,
                'message' => 'User is already a candidate in this election.',
            ], 400);
        }

        $partylistName = null;

        DB::transaction(function () use (
            $application,
            $request,
            $user,
            $formData,
            &$partylistName
        ) {
            $application->comelec_status = 'approved';
            $application->comelec_approved_at = now();
            $application->comelec_approved_by_user_id = $request->user()->user_id;
            $application->comelec_remarks = $request->remarks;
            $application->save();

            $positionTitle = $formData['selectedPosition'] ?? null;

            if (!$positionTitle) {
                if ($formData['positionCSG'] ?? false) {
                    $positionTitle = 'CSG President';
                } elseif ($formData['positionSC'] ?? false) {
                    $positionTitle = 'Governor';
                } else {
                    $positionTitle = 'Other';
                }
            }

            $position = Position::where('election_id', $application->election_id)
                ->where('title', $positionTitle)
                ->first();

            if (!$position) {
                $position = Position::where('election_id', $application->election_id)
                    ->where('title', 'like', '%' . $positionTitle . '%')
                    ->first();
            }

            if (!$position) {
                $position = Position::where('election_id', $application->election_id)->first();
            }

            $candidate = Candidate::create([
                'user_id' => $user->user_id,
                'election_id' => $application->election_id,
                'position_id' => $position ? $position->position_id : null,
                'platform' => $formData['platform'] ?? 'To be announced',
                'qualifications' => $formData['qualifications'] ?? 'To be announced',
                'photo_url' => null,
                'is_approved' => true,
                'approved_by_user_id' => $request->user()->user_id,
                'approved_at' => now(),
            ]);

            $isHighest = $this->isHighestPosition($application->election_id, $positionTitle);
            $isIndependent = (bool) ($formData['partyIndependent'] ?? false);
            $isCreatingNewParty = (bool) (
                $formData['partyCreate']
                ?? $formData['partyOther']
                ?? false
            );

            $shouldCreatePartylist = $isHighest && $isCreatingNewParty && !$isIndependent;

            if ($shouldCreatePartylist) {
                $partylist = $this->createPartylistForCandidate($candidate, $user, $formData);
                $partylistName = $partylist ? $partylist->name : null;
            }

            if ($user->role !== 'candidate') {
                $user->role = 'candidate';
                $user->save();
            }

            AuditLog::create([
                'user_id' => $request->user()->user_id,
                'action_type' => 'COMELEC_APPROVE_CANDIDATE',
                'target_table' => 'candidates',
                'target_id' => $candidate->candidate_id,
                'new_value' => json_encode([
                    'user_id' => $user->user_id,
                    'election_id' => $application->election_id,
                    'position_id' => $position ? $position->position_id : null,
                    'position_title' => $positionTitle,
                    'partylist_created' => $shouldCreatePartylist,
                    'partylist_name' => $partylistName,
                    'is_independent' => $isIndependent,
                ]),
                'ip_address' => $request->ip(),
            ]);

            try {
                $notificationService = app(NotificationService::class);
                $notificationService->candidateApprovedComelec(
                    $user->user_id,
                    $positionTitle,
                    $application->election->title,
                );
            } catch (\Exception $e) {
                Log::warning('Failed to send COMELEC approval notification: ' . $e->getMessage());
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Candidate approved and registered successfully.',
            'data' => [
                'application' => $application->fresh(),
                'partylist_created' => $partylistName !== null,
                'partylist_name' => $partylistName,
            ],
        ]);
    }

    public function comelecReject(Request $request, $id)
    {
        $application = CandidacyApplication::with(['user', 'election'])->findOrFail($id);

        if ($application->admin_status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'This application has not been admin-approved.',
            ], 400);
        }

        if ($application->comelec_status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'This application has already been processed by COMELEC.',
            ], 400);
        }

        $user = $application->user;
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        $formData = $application->form_data;
        $positionTitle = $formData['selectedPosition'] ?? 'Unknown Position';

        $application->comelec_status = 'rejected';
        $application->comelec_remarks = $request->remarks;
        $application->save();

        AuditLog::create([
            'user_id' => $request->user()->user_id,
            'action_type' => 'COMELEC_REJECT_CANDIDATE',
            'target_table' => 'candidacy_applications',
            'target_id' => $application->application_id,
            'new_value' => json_encode(['comelec_status' => 'rejected']),
            'ip_address' => $request->ip(),
        ]);

        try {
            $notificationService = app(NotificationService::class);
            if ($notificationService) {
                $notificationService->candidateRejected(
                    $user->user_id,
                    $positionTitle,
                    $application->election->title,
                    $request->remarks
                );
            }
        } catch (\Exception $e) {
            Log::warning('Failed to send COMELEC rejection notification: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Candidate application rejected by COMELEC.',
            'data' => $application,
        ]);
    }

    // ============================================================
    // VOTER: MY APPLICATIONS
    // ============================================================
    public function getMyApplication(Request $request, $electionId = null)
    {
        $user = $request->user();
        $query = CandidacyApplication::where('user_id', $user->user_id);

        if ($electionId) {
            $query->where('election_id', $electionId);
        }

        $applications = $query->with('election')->orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $applications,
        ]);
    }

    // ============================================================
    // PARTYLIST HELPERS
    // ============================================================
    public function getAvailablePartylists(Request $request, $electionId)
    {
        try {
            $user = $request->user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated',
                ], 401);
            }

            $userCandidate = Candidate::where('user_id', $user->user_id)
                ->where('election_id', $electionId)
                ->where('is_approved', true)
                ->first();

            if (!$userCandidate) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not an approved candidate in this election',
                ], 403);
            }

            $existingMembership = PartylistMembership::where('candidate_id', $userCandidate->candidate_id)
                ->where('status', 'approved')
                ->where('is_active', true)
                ->first();

            if ($existingMembership) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are already a member of a partylist',
                    'data' => [
                        'partylist_id' => $existingMembership->partylist_id,
                        'partylist_name' => $existingMembership->partylist->name ?? null,
                    ],
                ], 400);
            }

            $positionTitle = $userCandidate->position ? $userCandidate->position->title : null;
            $isHighest = $this->isHighestPosition($electionId, $positionTitle);

            $partylists = Partylist::where('election_id', $electionId)
                ->withCount(['activeMemberships as members_count'])
                ->with(['creator'])
                ->get()
                ->map(function ($partylist) use ($userCandidate) {
                    $pendingRequest = PartylistMembership::where('partylist_id', $partylist->partylist_id)
                        ->where('candidate_id', $userCandidate->candidate_id)
                        ->where('status', 'pending')
                        ->first();

                    return [
                        'partylist_id' => $partylist->partylist_id,
                        'name' => $partylist->name,
                        'description' => $partylist->description,
                        'logo_url' => $partylist->logo_url,
                        'members_count' => $partylist->members_count ?? 0,
                        'creator' => $partylist->creator ? [
                            'user_id' => $partylist->creator->user_id,
                            'first_name' => $partylist->creator->first_name,
                            'last_name' => $partylist->creator->last_name,
                        ] : null,
                        'has_pending_request' => !is_null($pendingRequest),
                        'request_id' => $pendingRequest?->membership_id,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => [
                    'can_create' => $isHighest,
                    'create_message' => $isHighest ?
                        'You are running for the highest position. A partylist has been or will be created for you.' :
                        'You can join an existing partylist.',
                    'is_highest_position' => $isHighest,
                    'position_title' => $positionTitle,
                    'partylists' => $partylists,
                    'user_candidate' => [
                        'candidate_id' => $userCandidate->candidate_id,
                        'position' => $userCandidate->position ? [
                            'position_id' => $userCandidate->position->position_id,
                            'title' => $userCandidate->position->title,
                        ] : null,
                    ],
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching available partylists: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch available partylists: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function candidateApplyToPartylist(Request $request, $partylistId)
    {
        try {
            $user = $request->user();

            if (!$user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            $partylist = Partylist::findOrFail($partylistId);

            $candidate = Candidate::where('user_id', $user->user_id)
                ->where('election_id', $partylist->election_id)
                ->where('is_approved', true)
                ->first();

            if (!$candidate) {
                return response()->json([
                    'message' => 'You are not an approved candidate in this election',
                ], 403);
            }

            $existingMembership = PartylistMembership::where('candidate_id', $candidate->candidate_id)
                ->where('status', 'approved')
                ->where('is_active', true)
                ->first();

            if ($existingMembership) {
                return response()->json([
                    'message' => 'You are already a member of a partylist',
                ], 400);
            }

            $existingRequest = PartylistMembership::where('partylist_id', $partylistId)
                ->where('candidate_id', $candidate->candidate_id)
                ->where('status', 'pending')
                ->first();

            if ($existingRequest) {
                return response()->json([
                    'message' => 'You already have a pending application for this partylist',
                ], 400);
            }

            $rejectedRequest = PartylistMembership::where('partylist_id', $partylistId)
                ->where('candidate_id', $candidate->candidate_id)
                ->where('status', 'rejected')
                ->first();

            if ($rejectedRequest) {
                return response()->json([
                    'message' => 'Your previous application was rejected',
                ], 400);
            }

            $membership = PartylistMembership::create([
                'partylist_id' => $partylistId,
                'candidate_id' => $candidate->candidate_id,
                'status' => 'pending',
                'is_active' => true,
            ]);

            AuditLog::create([
                'user_id' => $user->user_id,
                'action_type' => 'CANDIDATE_APPLY_PARTYLIST',
                'target_table' => 'partylist_memberships',
                'target_id' => $membership->membership_id,
                'new_value' => json_encode(['partylist_id' => $partylistId]),
                'ip_address' => $request->ip(),
            ]);

            try {
                $notificationService = app(NotificationService::class);
                if ($notificationService) {
                    $creatorId = $partylist->created_by_user_id;
                    $candidateName = $user->first_name . ' ' . $user->last_name;
                    $position = $candidate->position ? $candidate->position->title : 'Unknown Position';

                    $notificationService->send(
                        $creatorId,
                        '📋 New Partylist Application',
                        "{$candidateName} (Position: {$position}) has applied to join your partylist \"{$partylist->name}\".",
                        'system',
                        [
                            'candidate' => $candidateName,
                            'candidate_id' => $candidate->candidate_id,
                            'partylist' => $partylist->name,
                            'partylist_id' => $partylistId,
                            'membership_id' => $membership->membership_id,
                            'position' => $position,
                        ]
                    );
                }
            } catch (\Exception $e) {
                Log::warning('Failed to send partylist application notification: ' . $e->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Application submitted successfully',
                'data' => $membership->load(['candidate.user']),
            ]);
        } catch (\Exception $e) {
            Log::error('Error applying to partylist: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to apply to partylist: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function getPartylistRequests(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated',
                ], 401);
            }

            $partylist = Partylist::where('created_by_user_id', $user->user_id)->first();

            if (!$partylist) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'message' => 'You are not a partylist creator',
                ]);
            }

            $requests = PartylistMembership::where('partylist_id', $partylist->partylist_id)
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

    public function handlePartylistRequest(Request $request, $membershipId)
    {
        try {
            $validator = Validator::make($request->all(), [
                'action' => 'required|in:approve,reject',
            ]);

            if ($validator->fails()) {
                return response()->json(['errors' => $validator->errors()], 422);
            }

            $user = $request->user();
            if (!$user) {
                return response()->json(['message' => 'User not authenticated'], 401);
            }

            $action = $request->action;

            $membership = PartylistMembership::with(['partylist', 'candidate'])
                ->findOrFail($membershipId);

            if ($membership->partylist->created_by_user_id !== $user->user_id) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            if ($membership->status !== 'pending') {
                return response()->json([
                    'message' => 'This request has already been processed',
                ], 400);
            }

            $notificationService = app(NotificationService::class);
            $candidateId = $membership->candidate_id;
            $candidate = $membership->candidate;
            $candidateName = $candidate->user->first_name . ' ' . $candidate->user->last_name;
            $partylistName = $membership->partylist->name;

            if ($action === 'approve') {
                $membership->status = 'approved';
                $membership->approved_at = now();
                $membership->approved_by_user_id = $user->user_id;
                $membership->is_active = true;
                $membership->save();

                $message = 'Candidate approved and added to partylist';

                try {
                    if ($notificationService) {
                        $notificationService->partylistMembershipApproved(
                            $candidate->user_id,
                            $partylistName
                        );
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to send partylist approval notification: ' . $e->getMessage());
                }
            } else {
                $membership->status = 'rejected';
                $membership->is_active = false;
                $membership->save();

                $message = 'Application rejected';

                try {
                    if ($notificationService) {
                        $notificationService->partylistMembershipRejected(
                            $candidate->user_id,
                            $partylistName
                        );
                    }
                } catch (\Exception $e) {
                    Log::warning('Failed to send partylist rejection notification: ' . $e->getMessage());
                }
            }

            AuditLog::create([
                'user_id' => $user->user_id,
                'action_type' => 'HANDLE_PARTYLIST_REQUEST',
                'target_table' => 'partylist_memberships',
                'target_id' => $membershipId,
                'new_value' => json_encode(['status' => $action === 'approve' ? 'approved' : 'rejected']),
                'ip_address' => $request->ip(),
            ]);

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => $membership->load('candidate.user'),
            ]);
        } catch (\Exception $e) {
            Log::error('Error handling partylist request: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to handle request: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function getMyPartylist(Request $request, $electionId)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated',
                ], 401);
            }

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
                ->with(['partylist', 'partylist.activeMemberships.candidate.user'])
                ->first();

            if (!$membership) {
                return response()->json([
                    'success' => true,
                    'data' => null,
                    'message' => 'You are not a member of any partylist',
                ]);
            }

            $isCreator = $membership->partylist->created_by_user_id === $user->user_id;

            return response()->json([
                'success' => true,
                'data' => [
                    'membership' => $membership,
                    'partylist' => $membership->partylist,
                    'status' => $membership->status,
                    'is_creator' => $isCreator,
                    'is_approved' => $membership->status === 'approved',
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching my partylist: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch partylist: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ============================================================
    // RECOMMENDATION LETTER
    // ============================================================
    public function downloadRecommendationLetter(Request $request, $id)
    {
        $application = CandidacyApplication::with(['user', 'election'])
            ->findOrFail($id);

        if ($application->admin_status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'Recommendation letter is only available for approved applications.',
            ], 403);
        }

        if ($application->recommendation_letter_path && Storage::disk('public')->exists($application->recommendation_letter_path)) {
            $filePath = Storage::disk('public')->path($application->recommendation_letter_path);
            return response()->file($filePath, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="recommendation_letter.pdf"',
            ]);
        }

        return $this->generateRecommendationLetter($application, true);
    }

    public function voterDownloadRecommendationLetter(Request $request, $applicationId)
    {
        $application = CandidacyApplication::findOrFail($applicationId);

        if ($application->user_id !== $request->user()->user_id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        if ($application->admin_status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' => 'Recommendation letter is not yet available. Please wait for admin approval.',
            ], 403);
        }

        if ($application->recommendation_letter_path && Storage::disk('public')->exists($application->recommendation_letter_path)) {
            $filePath = Storage::disk('public')->path($application->recommendation_letter_path);
            return response()->file($filePath, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="recommendation_letter.pdf"',
            ]);
        }

        return $this->generateRecommendationLetter($application, true);
    }

    private function generateRecommendationLetter(CandidacyApplication $application, $download = false)
    {
        $data = [
            'application' => $application,
            'user' => $application->user,
            'election' => $application->election,
            'form' => $application->form_data,
            'date' => now()->format('F d, Y'),
        ];

        try {
            $pdf = Pdf::loadView('pdf.recommendation_letter', $data);
            $pdf->setPaper('letter', 'portrait');

            if ($download) {
                return $pdf->download('recommendation_letter.pdf');
            }

            $filename = 'recommendation_letters/' . $application->application_id . '_' . time() . '.pdf';
            Storage::disk('public')->put($filename, $pdf->output());
            $application->recommendation_letter_path = $filename;
            $application->letter_generated = true;
            $application->save();

            return $pdf;
        } catch (\Exception $e) {
            Log::error('Failed to generate PDF: ' . $e->getMessage());

            if ($download) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to generate recommendation letter: ' . $e->getMessage(),
                ], 500);
            }

            throw $e;
        }
    }

    // ============================================================
    // PLATFORM PDF (NEW)
    // ============================================================

    /**
     * Voter downloads their own platform PDF.
     */
    public function voterDownloadPlatformPdf(Request $request, $applicationId)
    {
        $application = CandidacyApplication::findOrFail($applicationId);

        if ($application->user_id !== $request->user()->user_id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        return $this->streamPlatformPdf($application);
    }

    /**
     * Admin/COMELEC downloads any applicant's platform PDF.
     */
    public function adminDownloadPlatformPdf(Request $request, $applicationId)
    {
        if (!in_array($request->user()->role, ['admin', 'comelec'])) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 403);
        }

        $application = CandidacyApplication::findOrFail($applicationId);

        return $this->streamPlatformPdf($application);
    }

    /**
     * Stream the stored PDF, regenerating it on the fly if missing.
     */
    private function streamPlatformPdf(CandidacyApplication $application)
    {
        if (
            !$application->platform_pdf_path ||
            !Storage::disk('public')->exists($application->platform_pdf_path)
        ) {
            try {
                $this->generatePlatformPdf($application);
            } catch (\Exception $e) {
                Log::error('Platform PDF regeneration failed', [
                    'application_id' => $application->application_id,
                    'error'          => $e->getMessage(),
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to generate platform PDF: ' . $e->getMessage(),
                ], 500);
            }
        }

        $path = Storage::disk('public')->path($application->platform_pdf_path);

        return response()->file($path, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="candidacy_platform.pdf"',
            'Cache-Control'       => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma'              => 'no-cache',
        ]);
    }

    /**
     * Render the platform PDF from the Blade view and store it.
     */
    private function generatePlatformPdf(CandidacyApplication $application): void
    {
        $application->loadMissing(['user.course', 'election', 'selectedPartylist']);

        $user     = $application->user;
        $election = $application->election;
        $form     = $application->form_data ?? [];

        // Signature: base64 data URL from the drawn pad
        $signature = $form['signature'] ?? null;

        // Photo: prefer the uploaded profile_photo, then the form's photo
        $photoUrl = $this->resolvePdfImage($user?->profile_photo)
            ?? $this->resolvePdfImage($form['photo'] ?? null);

        $data = [
            'application'   => $application,
            'user'          => $user,
            'election'      => $election,
            'electionTitle' => $election->title ?? 'Election',
            'form'          => $form,
            'partylistName' => $application->selectedPartylist?->name,
            'generatedAt'   => now()->format('F d, Y g:i A'),
            'photoUrl'      => $photoUrl,
            'signature'     => $signature,
        ];

        $pdf = Pdf::loadView('pdf.candidacy_platform', $data);
        $pdf->setPaper('letter', 'portrait');

        if (!Storage::disk('public')->exists('candidacy_platforms')) {
            Storage::disk('public')->makeDirectory('candidacy_platforms');
        }

        $filename = 'candidacy_platforms/'
            . $application->application_id . '_' . time() . '.pdf';

        Storage::disk('public')->put($filename, $pdf->output());

        $application->platform_pdf_path = $filename;
        $application->save();
    }

    /**
     * Turn a stored image reference into something dompdf can embed.
     */
    private function resolvePdfImage(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        if (str_starts_with($path, 'data:image/')) {
            return $path;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        $relative = preg_replace('#^/storage/#', '', $path);
        $relative = ltrim($relative, '/');

        $disk = Storage::disk('public');

        if (!$disk->exists($relative)) {
            return null;
        }

        return $disk->path($relative);
    }

    // ============================================================
    // PRIVATE HELPERS
    // ============================================================
    private function isHighestPosition($electionId, $positionTitle)
    {
        $topPosition = Position::where('election_id', $electionId)
            ->orderBy('order_in_ballot')
            ->first();

        if (!$topPosition) {
            return false;
        }

        return $topPosition->title === $positionTitle;
    }

    private function createPartylistForCandidate($candidate, $user, $formData)
    {
        try {
            $partylistName = null;

            if (!empty($formData['newPartyName'])) {
                $partylistName = trim($formData['newPartyName']);
            } elseif (!empty($formData['politicalParty'])) {
                $partylistName = trim($formData['politicalParty']);
            } else {
                $partylistName = $user->first_name . ' ' . $user->last_name . "'s Partylist";
            }

            $election = Election::find($candidate->election_id);
            $existing = Partylist::where('election_id', $candidate->election_id)
                ->where('name', $partylistName)
                ->first();

            if ($existing) {
                $partylistName .= ' (' . $user->last_name . ')';
            }

            $partylist = Partylist::create([
                'election_id' => $candidate->election_id,
                'name' => $partylistName,
                'description' => 'Partylist created by '
                    . $user->first_name . ' ' . $user->last_name
                    . ' for ' . ($election ? $election->title : 'Election'),
                'created_by_user_id' => $user->user_id,
                'approved_by_user_id' => $user->user_id,
            ]);

            PartylistMembership::create([
                'partylist_id' => $partylist->partylist_id,
                'candidate_id' => $candidate->candidate_id,
                'status' => 'approved',
                'approved_at' => now(),
                'approved_by_user_id' => $user->user_id,
                'is_active' => true,
            ]);

            return $partylist;
        } catch (\Exception $e) {
            Log::error('Failed to create partylist: ' . $e->getMessage());
            throw $e;
        }
    }

    public function getAvailableElections(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated',
                ], 401);
            }

            $now = now();

            $elections = Election::where('is_active', true)
                ->where('voting_end', '>', $now)
                ->with(['course'])
                ->orderBy('voting_start', 'asc')
                ->get();

            $availableElections = $elections->filter(function ($election) use ($user) {
                $hasApplied = CandidacyApplication::where('user_id', $user->user_id)
                    ->where('election_id', $election->election_id)
                    ->exists();

                $isCandidate = Candidate::where('user_id', $user->user_id)
                    ->where('election_id', $election->election_id)
                    ->exists();

                $isVoter = $user->role === 'voter';

                return !$hasApplied && !$isCandidate && $isVoter;
            })->values();

            $appliedElections = CandidacyApplication::where('user_id', $user->user_id)
                ->with(['election'])
                ->get()
                ->map(function ($application) {
                    return [
                        'election_id' => $application->election_id,
                        'election_title' => $application->election->title ?? 'Unknown',
                        'status' => $application->admin_status,
                        'application_id' => $application->application_id,
                        'submitted_at' => $application->created_at,
                    ];
                });

            $candidateElections = Candidate::where('user_id', $user->user_id)
                ->with(['election', 'position'])
                ->get()
                ->map(function ($candidate) {
                    return [
                        'election_id' => $candidate->election_id,
                        'election_title' => $candidate->election->title ?? 'Unknown',
                        'position' => $candidate->position->title ?? 'Unknown',
                        'status' => $candidate->is_approved ? 'approved' : 'pending',
                        'candidate_id' => $candidate->candidate_id,
                    ];
                });

            $available = $availableElections->map(function ($election) {
                return [
                    'election_id' => $election->election_id,
                    'title' => $election->title,
                    'election_type' => $election->election_type,
                    'description' => $election->description,
                    'voting_start' => $election->voting_start,
                    'voting_end' => $election->voting_end,
                    'course' => $election->course ? [
                        'course_id' => $election->course->course_id,
                        'course_code' => $election->course->course_code,
                        'course_name' => $election->course->course_name,
                    ] : null,
                    'is_available' => true,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => [
                    'available' => $available,
                    'applied' => $appliedElections,
                    'candidate' => $candidateElections,
                    'can_apply' => $user->role === 'voter',
                    'has_pending_application' => $appliedElections->contains('status', 'pending'),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch available elections: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch available elections: ' . $e->getMessage(),
            ], 500);
        }
    }
}
