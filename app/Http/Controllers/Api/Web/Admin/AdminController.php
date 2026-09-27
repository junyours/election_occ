<?php
// app/Http/Controllers/Api/Web/Admin/AdminController.php

namespace App\Http\Controllers\Api\Web\Admin;

use App\Http\Controllers\Controller;
use App\Models\Election;
use App\Models\Position;
use App\Models\Partylist;
use App\Models\User;
use App\Models\AuditLog;
use App\Models\Candidate;
use App\Models\Course;
use App\Models\DigitalReceipt;
use App\Models\ElectionParticipation;
use App\Traits\HasApiResponse;
use App\Traits\HasFileUpload;
use App\Traits\HasAuditLog;
use App\Services\VoterEligibilityService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;
use App\Services\NotificationService;
use Illuminate\Support\Carbon;

class AdminController extends Controller
{
    use HasApiResponse, HasFileUpload, HasAuditLog;

    // ==================== PARTYLIST MANAGEMENT ====================

    public function getPartylists($electionId)
    {
        $partylists = Partylist::where('election_id', $electionId)
            ->with('candidates')
            ->get();

        return $this->successResponse($partylists);
    }

    public function createPartylist(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'election_id' => 'required|exists:elections,election_id',
            'name' => 'required|string|max:100|unique:partylists,name',
            'description' => 'nullable|string',
            'logo' => 'nullable|image|max:2048',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $logoUrl = null;
        if ($request->hasFile('logo')) {
            $logoUrl = $this->uploadFile($request->file('logo'), 'partylist_logos');
        }

        $partylist = Partylist::create([
            'election_id' => $request->election_id,
            'name' => $request->name,
            'logo_url' => $logoUrl,
            'description' => $request->description,
            'approved_by_user_id' => $request->user()->user_id,
        ]);

        $this->logAction(
            $request->user()->user_id,
            'CREATE_PARTYLIST',
            'partylists',
            $partylist->partylist_id,
            null,
            $partylist->toArray(),
            $request->ip()
        );

        return $this->successResponse($partylist, 'Partylist created successfully', 201);
    }

    public function updatePartylist(Request $request, $id)
    {
        $partylist = Partylist::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string',
            'logo' => 'nullable|image|max:2048',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $oldValue = $partylist->toArray();

        if ($request->has('name')) {
            $partylist->name = $request->name;
        }
        if ($request->has('description')) {
            $partylist->description = $request->description;
        }

        if ($request->hasFile('logo')) {
            if ($partylist->logo_url) {
                $oldLogoPath = str_replace('/storage/', '', $partylist->logo_url);
                if (Storage::disk('public')->exists($oldLogoPath)) {
                    Storage::disk('public')->delete($oldLogoPath);
                }
            }

            $logoUrl = $this->uploadFile($request->file('logo'), 'partylist_logos');
            $partylist->logo_url = $logoUrl;
        }

        $partylist->save();

        $this->logAction(
            $request->user()->user_id,
            'UPDATE_PARTYLIST',
            'partylists',
            $partylist->partylist_id,
            $oldValue,
            $partylist->toArray(),
            $request->ip()
        );

        return $this->successResponse($partylist, 'Partylist updated successfully');
    }

    public function deletePartylist(Request $request, $id)
    {
        $partylist = Partylist::findOrFail($id);

        if ($partylist->candidates()->count() > 0) {
            return $this->errorResponse('Cannot delete partylist with existing candidates', 400);
        }

        if ($partylist->logo_url) {
            $this->deleteFile($partylist->logo_url);
        }

        $this->logAction(
            $request->user()->user_id,
            'DELETE_PARTYLIST',
            'partylists',
            $id,
            $partylist->toArray(),
            null,
            $request->ip()
        );

        $partylist->delete();

        return $this->successResponse(null, 'Partylist deleted successfully');
    }

    // ==================== POSITION MANAGEMENT ====================

    public function createPosition(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'election_id' => 'required|exists:elections,election_id',
            'title' => 'required|string|max:50',
            'order_in_ballot' => 'required|integer',
            'max_winners' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $position = Position::create($request->all());

        $this->logAction(
            $request->user()->user_id,
            'CREATE_POSITION',
            'positions',
            $position->position_id,
            null,
            $position->toArray(),
            $request->ip()
        );

        return $this->successResponse($position, 'Position created successfully', 201);
    }

    public function updatePosition(Request $request, $id)
    {
        $position = Position::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:50',
            'order_in_ballot' => 'sometimes|integer',
            'max_winners' => 'sometimes|integer|min:1',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $oldValue = $position->toArray();
        $position->update($request->all());

        $this->logAction(
            $request->user()->user_id,
            'UPDATE_POSITION',
            'positions',
            $position->position_id,
            $oldValue,
            $position->toArray(),
            $request->ip()
        );

        return $this->successResponse($position, 'Position updated successfully');
    }

    public function deletePosition(Request $request, $id)
    {
        $position = Position::findOrFail($id);

        $this->logAction(
            $request->user()->user_id,
            'DELETE_POSITION',
            'positions',
            $id,
            $position->toArray(),
            null,
            $request->ip()
        );

        $position->delete();

        return $this->successResponse(null, 'Position deleted successfully');
    }

    // ==================== USER MANAGEMENT ====================

    public function updateUser(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'first_name'        => 'sometimes|string|max:50',
            'last_name'         => 'sometimes|string|max:50',
            'email'             => 'sometimes|email|unique:users,email,' . $id . ',user_id',
            'id_no'        => 'sometimes|string|unique:users,id_no,' . $id . ',user_id',
            'course'            => 'nullable|string|max:100',
            'year_level'        => 'nullable|integer|min:1|max:4',
            'role'              => 'sometimes|in:admin,comelec,candidate,voter',
            'password'          => 'sometimes|min:8',
            'birthdate'         => 'nullable|date|before:today',
            'present_address'   => 'nullable|string|max:255',
            'present_address_2' => 'nullable|string|max:255',
            'no_unit_load'      => 'nullable|integer|min:0|max:18',
            'cellphone'         => ['nullable', 'string', 'regex:/^[0-9]{11}$/'],
            'social_media'      => 'nullable|string|max:100',
        ], [
            'cellphone.regex'  => 'Cellphone number must be exactly 11 digits.',
            'no_unit_load.max' => 'Unit load cannot exceed 18 units.',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $oldValue = $user->toArray();

        if ($request->has('first_name')) $user->first_name = $request->first_name;
        if ($request->has('last_name')) $user->last_name = $request->last_name;
        if ($request->has('email')) $user->email = $request->email;
        if ($request->has('id_no')) $user->id_no = $request->id_no;

        if ($request->has('course') && $request->course) {
            $course = Course::where('course_code', $request->course)->first();
            if ($course) {
                $user->course_id = $course->course_id;
            }
        }

        if ($request->has('year_level')) $user->year_level = $request->year_level;
        if ($request->has('role')) $user->role = $request->role;
        if ($request->has('birthdate')) $user->birthdate = $request->birthdate;
        if ($request->has('present_address')) $user->present_address = $request->present_address;
        if ($request->has('present_address_2')) $user->present_address_2 = $request->present_address_2;
        if ($request->has('no_unit_load')) $user->no_unit_load = $request->no_unit_load;
        if ($request->has('cellphone')) $user->cellphone = $request->cellphone;
        if ($request->has('social_media')) $user->social_media = $request->social_media;

        if ($request->has('password') && $request->password) {
            $user->password_hash = Hash::make($request->password);
        }

        $user->save();

        $this->logAction(
            $request->user()->user_id,
            'UPDATE_USER',
            'users',
            $user->user_id,
            $oldValue,
            $user->toArray(),
            $request->ip()
        );

        return $this->successResponse($user->load('course'), 'User updated successfully');
    }

    public function deleteUser(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if ($user->user_id === $request->user()->user_id) {
            return $this->errorResponse('Cannot delete your own account', 400);
        }

        $this->logAction(
            $request->user()->user_id,
            'DELETE_USER',
            'users',
            $id,
            $user->toArray(),
            null,
            $request->ip()
        );

        $user->delete();

        return $this->successResponse(null, 'User deleted successfully');
    }

    /**
     * ✅ Get users with optional pagination
     */
    public function getUsers(Request $request)
    {
        $query = User::with(['course', 'section']);

        if ($request->has('role')) {
            $query->where('role', $request->role);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('id_no', 'like', "%{$search}%");
            });
        }

        // ✅ Paginate when per_page is provided
        $perPage = $request->get('per_page');
        if ($perPage) {
            $users = $query->orderBy('created_at', 'desc')->paginate((int) $perPage);

            $transformedUsers = collect($users->items())->map(function ($user) {
                return $this->transformUser($user);
            });

            return response()->json([
                'success' => true,
                'data' => $transformedUsers,
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ]);
        }

        // Existing behavior: return all
        $users = $query->orderBy('created_at', 'desc')->get();
        $transformedUsers = $users->map(function ($user) {
            return $this->transformUser($user);
        });

        return response()->json([
            'success' => true,
            'data' => $transformedUsers,
            'total' => $transformedUsers->count(),
        ]);
    }

    /**
     * ✅ Shared transformer
     */
    private function transformUser(User $user): array
    {
        return [
            'user_id' => $user->user_id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'id_no' => $user->id_no,
            'course' => $user->course ? [
                'course_id' => $user->course->course_id,
                'course_code' => $user->course->course_code,
                'course_name' => $user->course->course_name,
            ] : null,
            'section' => $user->section ? [
                'section_id' => $user->section->section_id,
                'section_code' => $user->section->section_code,
                'section_name' => $user->section->section_name,
                'year_level' => $user->section->year_level,
            ] : null,
            'year_level' => $user->year_level,
            'role' => $user->role,
            'is_active' => $user->is_active,
            'profile_photo' => $user->profile_photo,
            'is_face_registered' => $user->is_face_registered,
            'birthdate' => $user->birthdate ? $user->birthdate->format('Y-m-d') : null,
            'age' => $user->age,
            'present_address' => $user->present_address,
            'present_address_2' => $user->present_address_2,
            'no_unit_load' => $user->no_unit_load,
            'cellphone' => $user->cellphone,
            'social_media' => $user->social_media,
            'created_at' => $user->created_at,
        ];
    }

    public function createUser(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:50',
            'last_name' => 'required|string|max:50',
            'email' => 'required|email|max:100|unique:users,email',
            'id_no' => 'required|string|max:20|unique:users,id_no',
            'course_id' => 'nullable|exists:courses,course_id',
            'section_id' => 'nullable|exists:course_sections,section_id',
            'year_level' => 'nullable|integer|min:1|max:4',
            'role' => 'required|in:admin,comelec,candidate,voter',
            'password' => 'required|string|min:8',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $user = User::create([
                'first_name' => $request->first_name,
                'last_name' => $request->last_name,
                'email' => $request->email,
                'id_no' => $request->id_no,
                'course_id' => $request->course_id,
                'section_id' => $request->section_id,
                'year_level' => $request->year_level,
                'role' => $request->role,
                'password_hash' => Hash::make($request->password),
                'is_active' => true,
            ]);

            $this->logAction(
                $request->user()->user_id,
                'CREATE_USER',
                'users',
                $user->user_id,
                null,
                $user->toArray(),
                $request->ip()
            );

            return response()->json([
                'success' => true,
                'message' => 'User created successfully',
                'data' => $user->load(['course', 'section']),
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create user: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create user: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ==================== VOTER MANAGEMENT ====================

    public function importVoters(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,csv,xls|max:20480',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        try {
            $path = $request->file('file')->store('imports');

            if (!$path) {
                return $this->errorResponse('Failed to store uploaded file.', 500);
            }

            \App\Jobs\ImportVotersJob::dispatch(
                (int) $request->input('election_id', 0),
                (int) $request->user()->user_id,
                $path,
            );

            $this->logAction(
                $request->user()->user_id,
                'QUEUE_IMPORT_VOTERS',
                'users',
                null,
                null,
                ['file' => $path],
                $request->ip()
            );

            return $this->successResponse(
                ['queued' => true, 'file' => $path],
                'Import queued. You will be notified when it finishes.',
                202
            );
        } catch (\Throwable $e) {
            Log::error('Failed to queue voter import: ' . $e->getMessage());
            return $this->errorResponse('Failed to queue import: ' . $e->getMessage(), 500);
        }
    }
    public function getVoters(Request $request, $electionId = null)
    {
        $perPage = (int) $request->get('per_page', 20);
        $search = $request->get('search', '');
        $statusFilter = $request->get('status', 'all');
        $courseFilter = $request->get('course', '');

        // ✅ Base query — eligible voters (department-scoped for SBO)
        $baseQuery = User::with(['course', 'section'])
            ->whereIn('role', ['voter', 'candidate'])
            ->orderBy('last_name', 'asc')
            ->where('is_active', true);

        if ($electionId) {
            $election = Election::find($electionId);
            if ($election) {
                $baseQuery = VoterEligibilityService::eligibleVotersQuery($election);
            }
        }

        // ============================================================
        // ✅ Compute stats FIRST from the FULL eligible set
        //    (before any search/status filters are applied)
        // ============================================================
        $allEligibleUserIds = (clone $baseQuery)->pluck('user_id')->toArray();
        $totalVoters = count($allEligibleUserIds);

        $votedUserIdsAll = [];
        if ($electionId) {
            $votedUserIdsAll = ElectionParticipation::where('election_id', $electionId)
                ->where('has_voted', true)
                ->whereIn('user_id', $allEligibleUserIds)
                ->pluck('user_id')
                ->toArray();
        }
        $votedCount = count($votedUserIdsAll);

        // ============================================================
        // Apply filters for the LIST (not for the stats)
        // ============================================================
        $query = clone $baseQuery;

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('id_no', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($courseFilter) {
            $query->whereHas('course', function ($q) use ($courseFilter) {
                $q->where('course_code', $courseFilter);
            });
        }

        $voters = $query
            ->orderBy('last_name', 'asc')
            ->orderBy('first_name', 'asc')
            ->paginate($perPage);

        $transformed = collect($voters->items())->map(function ($user) use ($votedUserIdsAll) {
            return [
                'user_id' => $user->user_id,
                'id_no' => $user->id_no,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'role' => $user->role,  // ✅ ADD THIS LINE
                'course' => $user->course ? [
                    'course_id' => $user->course->course_id,
                    'course_code' => $user->course->course_code,
                    'course_name' => $user->course->course_name,
                ] : null,
                'year_level' => $user->year_level,
                'has_voted' => in_array($user->user_id, $votedUserIdsAll),
            ];
        });

        // Post-filter by status (applies to the LIST only)
        $filtered = $transformed;
        if ($statusFilter === 'voted') {
            $filtered = $transformed->filter(fn($v) => $v['has_voted'])->values();
        } elseif ($statusFilter === 'not_voted') {
            $filtered = $transformed->filter(fn($v) => !$v['has_voted'])->values();
        }

        // ============================================================
        // Return — stats reflect the FULL eligible set, list is filtered
        // ============================================================
        return response()->json([
            'success' => true,
            'data' => [
                'voters' => $filtered,
                'total_voters' => $totalVoters,          // = total eligible
                'voted_count' => $votedCount,            // = eligible who voted
                'not_voted_count' => $totalVoters - $votedCount,
                'current_page' => $voters->currentPage(),
                'last_page' => $voters->lastPage(),
                'per_page' => $voters->perPage(),
                'list_total' => $voters->total(),        // = filtered count (for pagination only)
            ],
        ]);
    }

    /**
     * ✅ Voter stats — computed from users + election_participations
     */
    public function getVoterStats($electionId)
    {
        try {
            $election = Election::find($electionId);

            if (!$election) {
                return response()->json(['success' => false, 'message' => 'Election not found'], 404);
            }

            $totalVoters = VoterEligibilityService::eligibleVoterCount($election);
            $votedCount = ElectionParticipation::where('election_id', $electionId)
                ->where('has_voted', true)
                ->count();

            $stats = [
                'total_voters' => $totalVoters,
                'voted_count' => $votedCount,
                'turnout_percentage' => $totalVoters > 0
                    ? round(($votedCount / $totalVoters) * 100, 2)
                    : 0,
                'remaining_voters' => $totalVoters - $votedCount,
            ];

            if ($totalVoters > 0) {
                $byCourse = VoterEligibilityService::eligibleVotersQuery($election)
                    ->join('courses', 'users.course_id', '=', 'courses.course_id')
                    ->leftJoin('election_participations', function ($join) use ($electionId) {
                        $join->on('users.user_id', '=', 'election_participations.user_id')
                            ->where('election_participations.election_id', '=', $electionId);
                    })
                    ->select(
                        'courses.course_id',
                        'courses.course_code',
                        'courses.course_name',
                        DB::raw('COUNT(users.user_id) as total'),
                        DB::raw('SUM(CASE WHEN election_participations.has_voted = 1 THEN 1 ELSE 0 END) as voted')
                    )
                    ->groupBy('courses.course_id', 'courses.course_code', 'courses.course_name')
                    ->get()
                    ->map(function ($item) {
                        return [
                            'course' => $item->course_code ?? 'No Course',
                            'total' => (int) $item->total,
                            'voted' => (int) $item->voted,
                            'percentage' => $item->total > 0
                                ? round(($item->voted / $item->total) * 100, 2)
                                : 0,
                        ];
                    });

                $stats['breakdown_by_course'] = $byCourse;
            } else {
                $stats['breakdown_by_course'] = [];
            }

            return response()->json(['success' => true, 'data' => $stats]);
        } catch (\Exception $e) {
            Log::error('Failed to get voter stats: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get voter statistics: ' . $e->getMessage(),
                'data' => [
                    'total_voters' => 0,
                    'voted_count' => 0,
                    'turnout_percentage' => 0,
                    'remaining_voters' => 0,
                    'breakdown_by_course' => [],
                ],
            ], 500);
        }
    }

    /**
     * ✅ Turnout report
     */
    public function getTurnoutReport($electionId)
    {
        try {
            $election = Election::findOrFail($electionId);

            $totalVoters = VoterEligibilityService::eligibleVoterCount($election);
            $votedCount = ElectionParticipation::where('election_id', $electionId)
                ->where('has_voted', true)
                ->count();

            $byCourse = VoterEligibilityService::eligibleVotersQuery($election)
                ->join('courses', 'users.course_id', '=', 'courses.course_id')
                ->leftJoin('election_participations', function ($join) use ($electionId) {
                    $join->on('users.user_id', '=', 'election_participations.user_id')
                        ->where('election_participations.election_id', '=', $electionId);
                })
                ->select(
                    'courses.course_code',
                    'courses.course_name',
                    DB::raw('COUNT(users.user_id) as total'),
                    DB::raw('SUM(CASE WHEN election_participations.has_voted = 1 THEN 1 ELSE 0 END) as voted')
                )
                ->groupBy('courses.course_code', 'courses.course_name')
                ->get()
                ->map(function ($item) {
                    return [
                        'course' => $item->course_code ?? 'No Course',
                        'total' => (int) $item->total,
                        'voted' => (int) $item->voted,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => [
                    'total_voters' => $totalVoters,
                    'voted_count' => $votedCount,
                    'turnout_percentage' => $totalVoters > 0
                        ? round(($votedCount / $totalVoters) * 100, 2)
                        : 0,
                    'remaining_voters' => $totalVoters - $votedCount,
                    'breakdown_by_course' => $byCourse,
                    'last_updated' => now()->toISOString(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch turnout report: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * ✅ Sanctions list — non-voters
     */
    public function getSanctionsList($electionId)
    {
        try {
            $election = Election::findOrFail($electionId);

            $eligibleVoters = VoterEligibilityService::eligibleVotersQuery($election)
                ->with('course')
                ->get();

            $votedUserIds = ElectionParticipation::where('election_id', $electionId)
                ->where('has_voted', true)
                ->pluck('user_id')
                ->toArray();

            $nonVoters = $eligibleVoters->filter(function ($user) use ($votedUserIds) {
                return !in_array($user->user_id, $votedUserIds);
            });

            $nonVotersList = $nonVoters->map(function ($user) {
                return [
                    'id_no' => $user->id_no ?? '',
                    'first_name' => $user->first_name ?? '',
                    'last_name' => $user->last_name ?? '',
                    'email' => $user->email ?? '',
                    'course' => $user->course
                        ? ($user->course->course_code ?? $user->course->course_name ?? 'No Course')
                        : 'No Course',
                    'year_level' => $user->year_level ?? '',
                ];
            })->values();

            return response()->json([
                'success' => true,
                'data' => [
                    'total_eligible_voters' => $eligibleVoters->count(),
                    'total_non_voters' => $nonVotersList->count(),
                    'non_voters_list' => $nonVotersList,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get sanctions list: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function getFullResults($electionId)
    {
        try {
            $election = Election::with('positions')->findOrFail($electionId);

            $results = [];
            foreach ($election->positions as $position) {
                $candidates = Candidate::where('election_id', $electionId)
                    ->where('position_id', $position->position_id)
                    ->where('is_approved', true)
                    ->with(['user', 'partylist'])
                    ->get();

                $positionResults = [];
                foreach ($candidates as $candidate) {
                    $voteCount = \App\Models\Vote::where('election_id', $electionId)
                        ->where('candidate_id', $candidate->candidate_id)
                        ->count();

                    $positionResults[] = [
                        'candidate' => $candidate,
                        'votes' => $voteCount,
                    ];
                }

                usort($positionResults, function ($a, $b) {
                    return $b['votes'] - $a['votes'];
                });

                $results[$position->title] = $positionResults;
            }

            return $this->successResponse([
                'election' => $election,
                'results' => $results,
            ]);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to fetch results', 500);
        }
    }

    /**
     * ✅ Voter receipt — uses election_id + user_id
     */
    public function getVoterReceipt($electionId, $userId)
    {
        $receipt = DigitalReceipt::where('election_id', $electionId)
            ->where('user_id', $userId)
            ->first();

        if (!$receipt) {
            return response()->json([
                'success' => false,
                'message' => 'Receipt not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'receipt_code' => $receipt->receipt_code,
            'generated_at' => $receipt->generated_at,
            'sent_to_email' => $receipt->sent_to_email,
        ]);
    }

    /**
     * ✅ Remove voter — deactivates the user
     */
    public function removeVoter($userId)
    {
        try {
            $user = User::find($userId);

            if (!$user) {
                return response()->json(['success' => false, 'message' => 'Voter not found'], 404);
            }

            $user->is_active = false;
            $user->save();

            AuditLog::create([
                'user_id' => auth()->id(),
                'action_type' => 'DEACTIVATE_VOTER',
                'target_table' => 'users',
                'target_id' => $userId,
                'new_value' => json_encode(['is_active' => false]),
                'ip_address' => request()->ip(),
            ]);

            return response()->json([
                'success' => true,
                'message' => "{$user->first_name} {$user->last_name} has been deactivated",
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to remove voter: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to remove voter: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ==================== CANDIDATE MANAGEMENT ====================

    public function addCandidate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'election_id' => 'required|exists:elections,election_id',
            'user_id' => 'required|exists:users,user_id',
            'position_id' => 'required|exists:positions,position_id',
            'partylist_id' => 'nullable|exists:partylists,partylist_id',
            'platform' => 'nullable|string',
            'qualifications' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $existingCandidate = Candidate::where('user_id', $request->user_id)
            ->where('election_id', $request->election_id)
            ->first();

        if ($existingCandidate) {
            return $this->errorResponse('User is already a candidate for this election', 400);
        }

        DB::beginTransaction();
        try {
            $candidate = Candidate::create([
                'user_id' => $request->user_id,
                'election_id' => $request->election_id,
                'position_id' => $request->position_id,
                'partylist_id' => $request->partylist_id,
                'platform' => $request->platform ?? 'To be announced',
                'qualifications' => $request->qualifications ?? 'To be announced',
                'is_approved' => true,
                'approved_by_user_id' => $request->user()->user_id,
                'approved_at' => now(),
            ]);

            // ✅ Promote voter → candidate (never demote other roles)
            $user = User::find($request->user_id);
            if ($user && $user->role === 'voter') {
                $user->role = 'candidate';
                $user->save();
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Failed to add candidate: ' . $e->getMessage(), 500);
        }

        $this->logAction(
            $request->user()->user_id,
            'ADD_CANDIDATE',
            'candidates',
            $candidate->candidate_id,
            null,
            $candidate->toArray(),
            $request->ip()
        );

        return $this->successResponse(
            $candidate->load('user', 'position', 'partylist'),
            'Candidate added successfully',
            201
        );
    }

    public function addBulkCandidates(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'election_id' => 'required|exists:elections,election_id',
            'candidates' => 'required|array',
            'candidates.*.user_id' => 'required|exists:users,user_id',
            'candidates.*.position_id' => 'required|exists:positions,position_id',
            'candidates.*.partylist_id' => 'nullable|exists:partylists,partylist_id',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $successCount = 0;
        $failCount = 0;
        $errors = [];

        foreach ($request->candidates as $candidateData) {
            try {
                $existingCandidate = Candidate::where('user_id', $candidateData['user_id'])
                    ->where('election_id', $request->election_id)
                    ->first();

                if ($existingCandidate) {
                    $failCount++;
                    $errors[] = ['user_id' => $candidateData['user_id'], 'message' => 'Already a candidate'];
                    continue;
                }

                $candidate = Candidate::create([
                    'user_id' => $candidateData['user_id'],
                    'election_id' => $request->election_id,
                    'position_id' => $candidateData['position_id'],
                    'partylist_id' => $candidateData['partylist_id'] ?? null,
                    'platform' => $candidateData['platform'] ?? 'To be announced',
                    'qualifications' => $candidateData['qualifications'] ?? 'To be announced',
                    'is_approved' => true,
                    'approved_by_user_id' => $request->user()->user_id,
                    'approved_at' => now(),
                ]);

                $user = User::find($candidateData['user_id']);
                if ($user && $user->role === 'voter') {
                    $user->role = 'candidate';
                    $user->save();
                }

                $successCount++;
            } catch (\Exception $e) {
                $failCount++;
                $errors[] = ['user_id' => $candidateData['user_id'], 'message' => $e->getMessage()];
            }
        }

        $this->logAction(
            $request->user()->user_id,
            'BULK_ADD_CANDIDATES',
            'candidates',
            null,
            null,
            ['success' => $successCount, 'failed' => $failCount],
            $request->ip()
        );

        return response()->json([
            'success' => true,
            'success_count' => $successCount,
            'fail_count' => $failCount,
            'errors' => $errors,
        ], 200);
    }

    public function updateCandidate(Request $request, $id)
    {
        $candidate = Candidate::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'partylist_id' => 'nullable|exists:partylists,partylist_id',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $oldPartylistId = $candidate->partylist_id;
        $candidate->partylist_id = $request->partylist_id;
        $candidate->save();

        $this->logAction(
            $request->user()->user_id,
            'UPDATE_CANDIDATE_PARTYLIST',
            'candidates',
            $candidate->candidate_id,
            ['partylist_id' => $oldPartylistId],
            ['partylist_id' => $request->partylist_id],
            $request->ip()
        );

        return $this->successResponse(
            $candidate->load('user', 'position', 'partylist'),
            'Candidate updated successfully'
        );
    }

    public function getAllCandidates(Request $request)
    {
        $query = Candidate::with(['user', 'position', 'partylist', 'election']);

        if ($request->has('election_id')) {
            $query->where('election_id', $request->election_id);
        }

        if ($request->has('is_approved')) {
            $query->where('is_approved', $request->is_approved);
        }

        $candidates = $query->orderBy('created_at', 'desc')->paginate(20);

        return $this->successResponse($candidates);
    }

    public function deleteCandidate(Request $request, $id)
    {
        $candidate = Candidate::findOrFail($id);

        if ($candidate->votes()->count() > 0) {
            return $this->errorResponse('Cannot delete candidate with existing votes', 400);
        }

        $oldValue = $candidate->toArray();

        $otherCandidates = Candidate::where('user_id', $candidate->user_id)
            ->where('candidate_id', '!=', $id)
            ->count();

        if ($otherCandidates === 0) {
            $user = User::find($candidate->user_id);
            if ($user && $user->role === 'candidate') {
                $user->role = 'voter';
                $user->save();
            }
        }

        $this->logAction(
            $request->user()->user_id,
            'DELETE_CANDIDATE',
            'candidates',
            $id,
            $oldValue,
            null,
            $request->ip()
        );

        $candidate->delete();

        return $this->successResponse(null, 'Candidate removed successfully');
    }

    // ==================== ELECTION MANAGEMENT ====================

    public function updateElection(Request $request, $id)
    {
        $election = Election::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:100',
            'description' => 'nullable|string',
            'voting_start' => 'sometimes|date',
            'voting_end' => 'sometimes|date|after:voting_start',
            'is_active' => 'sometimes|boolean',
            'course_id' => 'sometimes|exists:courses,course_id',
            'department' => 'sometimes|string|max:20',
        ]);

        if ($validator->fails()) {
            return $this->validationErrorResponse($validator->errors());
        }

        $oldValue = $election->toArray();

        if ($request->has('voting_start')) {
            $votingStart = Carbon::parse($request->voting_start);
            $election->year = $votingStart->year;
        }

        $election->update($request->only([
            'title',
            'description',
            'voting_start',
            'voting_end',
            'is_active',
            'course_id',
        ]));

        // ✅ Auto-derive department if missing
        if ($election->election_type === 'SBO') {
            $newDept = $request->input('department');

            if (!$newDept && $election->course_id) {
                $course = Course::find($election->course_id);
                if ($course) {
                    $map = ['BSIT' => 'CIT', 'BEED' => 'TED', 'BSBA' => 'CBA'];
                    $newDept = $map[$course->course_code] ?? null;
                }
            }

            if ($newDept) {
                $election->department = $newDept;
                $election->save();
            }
        }

        $this->logAction(
            $request->user()->user_id,
            'UPDATE_ELECTION',
            'elections',
            $election->election_id,
            $oldValue,
            $election->toArray(),
            $request->ip()
        );

        return $this->successResponse(
            $election->load('positions', 'course'),
            'Election updated successfully'
        );
    }

    // ==================== AUDIT LOGS ====================

    public function getAuditLogs(Request $request)
    {
        try {
            $query = AuditLog::with('user');

            if ($request->has('action_type')) {
                $query->where('action_type', $request->action_type);
            }

            if ($request->has('from_date')) {
                $query->whereDate('timestamp', '>=', $request->from_date);
            }

            if ($request->has('to_date')) {
                $query->whereDate('timestamp', '<=', $request->to_date);
            }

            if ($request->has('user_id')) {
                $query->where('user_id', $request->user_id);
            }

            $logs = $query->orderBy('timestamp', 'desc')->paginate($request->get('per_page', 50));

            return $this->successResponse($logs);
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to fetch audit logs', 500);
        }
    }

    public function getElectionAuditTrail($electionId)
    {
        $auditLogs = AuditLog::where('target_table', 'elections')
            ->orWhere(function ($query) use ($electionId) {
                $query->whereIn('target_table', ['candidates', 'votes', 'election_participations'])
                    ->where('target_id', 'like', "%{$electionId}%");
            })
            ->with('user')
            ->orderBy('timestamp', 'desc')
            ->take(100)
            ->get();

        return $this->successResponse([
            'election_id' => $electionId,
            'audit_trail' => $auditLogs,
        ]);
    }
}
