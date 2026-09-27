<?php

namespace App\Http\Controllers\Api\Web\Campaign;

use App\Http\Controllers\Controller;
use App\Models\CampaignSchedule;
use App\Models\CourseSection;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Carbon\Carbon;
use App\Models\Candidate;
use App\Models\CampaignScheduleRequest;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class CampaignScheduleController extends Controller
{
    public function index(Request $request, $electionId)
    {
        $perPage = $request->get('per_page', 20);
        $page = $request->get('page', 1);

        $schedules = CampaignSchedule::where('election_id', $electionId)
            ->with(['candidate.user', 'candidate.position', 'section.course'])
            ->orderBy('start_time')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'success' => true,
            'data' => $schedules
        ]);
    }

    public function getByCourse($electionId, $courseSection)
    {
        $schedules = CampaignSchedule::where('election_id', $electionId)
            ->where('course_section', $courseSection)
            ->with(['candidate.user', 'candidate.position'])
            ->orderBy('start_time')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $schedules
        ]);
    }

    public function getCandidateSchedules($candidateId)
    {
        try {
            $schedules = CampaignSchedule::where('candidate_id', $candidateId)
                ->with([
                    'election',
                    'section.course',   // ✅ make sure this is included
                    'candidate.user',
                    'candidate.position',
                ])
                ->orderBy('start_time')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $schedules,
            ]);
        } catch (\Exception $e) {
            Log::error('getCandidateSchedules error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch candidate schedules',
            ], 500);
        }
    }

    /**
     * Candidate submits a schedule request
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'election_id' => 'required|exists:elections,election_id',
            'section_id' => 'required|exists:course_sections,section_id',
            'preferred_date' => 'required|date|after_or_equal:today',
            'preferred_start_time' => 'required|date_format:H:i',
            'preferred_end_time' => 'required|date_format:H:i',
            'message' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        // ✅ Manual time comparison — more reliable than `after:` for time-only fields
        $startTime = $request->preferred_start_time;
        $endTime = $request->preferred_end_time;

        if ($endTime <= $startTime) {
            return response()->json([
                'success' => false,
                'errors' => [
                    'preferred_end_time' => [
                        'The preferred end time must be after the preferred start time.',
                    ],
                ],
            ], 422);
        }

        // ✅ If the date is today, ensure the start time hasn't already passed
        $preferredDate = \Carbon\Carbon::parse($request->preferred_date);
        if ($preferredDate->isToday()) {
            $now = \Carbon\Carbon::now()->format('H:i');
            if ($startTime < $now) {
                return response()->json([
                    'success' => false,
                    'errors' => [
                        'preferred_start_time' => [
                            'The preferred start time has already passed for today.',
                        ],
                    ],
                ], 422);
            }
        }

        $user = $request->user();
        $electionId = $request->election_id;

        // Check if user is an approved candidate in this election
        $candidate = Candidate::where('user_id', $user->user_id)
            ->where('election_id', $electionId)
            ->where('is_approved', true)
            ->first();

        if (!$candidate) {
            return response()->json([
                'success' => false,
                'message' => 'You are not an approved candidate in this election',
            ], 403);
        }

        // Check if candidate already has a pending request
        $existingPending = CampaignScheduleRequest::where('candidate_id', $candidate->candidate_id)
            ->where('election_id', $electionId)
            ->where('status', 'pending')
            ->first();

        if ($existingPending) {
            return response()->json([
                'success' => false,
                'message' => 'You already have a pending schedule request. Please wait for it to be processed.',
            ], 400);
        }

        // Check for overlapping requests on the same section + date
        $overlap = CampaignScheduleRequest::where('section_id', $request->section_id)
            ->where('preferred_date', $request->preferred_date)
            ->where('status', 'pending')
            ->where(function ($query) use ($startTime, $endTime) {
                $query->where(function ($q) use ($startTime, $endTime) {
                    $q->where('preferred_start_time', '<', $endTime)
                        ->where('preferred_end_time', '>', $startTime);
                });
            })
            ->exists();

        if ($overlap) {
            return response()->json([
                'success' => false,
                'message' => 'Another candidate has already requested this time slot for the same section.',
            ], 400);
        }

        // Create the request
        $scheduleRequest = CampaignScheduleRequest::create([
            'candidate_id' => $candidate->candidate_id,
            'election_id' => $electionId,
            'section_id' => $request->section_id,
            'preferred_date' => $request->preferred_date,
            'preferred_start_time' => $startTime,
            'preferred_end_time' => $endTime,
            'message' => $request->message,
            'status' => 'pending',
        ]);

        AuditLog::create([
            'user_id' => $user->user_id,
            'action_type' => 'CREATE_SCHEDULE_REQUEST',
            'target_table' => 'campaign_schedule_requests',
            'target_id' => $scheduleRequest->request_id,
            'new_value' => json_encode($scheduleRequest->toArray()),
            'ip_address' => $request->ip(),
        ]);

        // Notify admins about the new request
        try {
            $notificationService = app(NotificationService::class);
            $adminUsers = \App\Models\User::whereIn('role', ['admin', 'comelec'])->get();
            $candidateName = $user->first_name . ' ' . $user->last_name;
            $section = $scheduleRequest->section;
            $sectionDisplay = $section
                ? $section->course->course_code . ' - Year ' . $section->year_level . ' Section ' . $section->section_code
                : 'Unknown Section';

            foreach ($adminUsers as $admin) {
                $notificationService->send(
                    $admin->user_id,
                    '📋 New Schedule Request',
                    "{$candidateName} requested schedule for {$sectionDisplay} on {$request->preferred_date} at {$startTime} - {$endTime}",
                    'system',
                    [
                        'candidate' => $candidateName,
                        'candidate_id' => $candidate->candidate_id,
                        'request_id' => $scheduleRequest->request_id,
                        'section' => $sectionDisplay,
                        'date' => $request->preferred_date,
                        'time' => $startTime . ' - ' . $endTime,
                    ]
                );
            }
        } catch (\Exception $e) {
            Log::warning('Failed to send schedule request notification: ' . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Schedule request submitted successfully. Please wait for approval.',
            'data' => $scheduleRequest->load(['candidate.user', 'section.course', 'election']),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $schedule = CampaignSchedule::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'section_id' => 'sometimes|exists:course_sections,section_id',
            'start_time' => 'sometimes|date',
            'end_time' => 'sometimes|date|after:start_time',
            'candidate_id' => 'nullable|exists:candidates,candidate_id',
            'notes' => 'nullable|string',
            'status' => 'sometimes|in:pending,ongoing,completed,cancelled',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $oldData = $schedule->toArray();

        $updateData = $request->only(['section_id', 'start_time', 'end_time', 'candidate_id', 'notes', 'status']);
        $schedule->update($updateData);

        AuditLog::create([
            'user_id' => $request->user()->user_id,
            'action_type' => 'UPDATE_CAMPAIGN_SCHEDULE',
            'target_table' => 'campaign_schedules',
            'target_id' => $schedule->schedule_id,
            'old_value' => json_encode($oldData),
            'new_value' => json_encode($schedule->toArray()),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Campaign schedule updated successfully',
            'data' => $schedule->load(['candidate.user', 'section.course'])
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $schedule = CampaignSchedule::findOrFail($id);
        $schedule->delete();

        AuditLog::create([
            'user_id' => $request->user()->user_id,
            'action_type' => 'DELETE_CAMPAIGN_SCHEDULE',
            'target_table' => 'campaign_schedules',
            'target_id' => $id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Campaign schedule deleted successfully'
        ]);
    }

    public function bulkStore(Request $request, $electionId)
    {
        $validator = Validator::make($request->all(), [
            'schedules' => 'required|array',
            'schedules.*.section_id' => 'required|exists:course_sections,section_id',
            'schedules.*.start_time' => 'required|date|after:now',
            'schedules.*.end_time' => 'required|date|after:start_time',
            'schedules.*.candidate_id' => 'nullable|exists:candidates,candidate_id',
            'schedules.*.notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $userId = $request->user()->user_id;
        $created = [];
        $errors = [];

        foreach ($request->schedules as $scheduleData) {
            // ✅ Convert to UTC properly
            $startTime = Carbon::parse($scheduleData['start_time'])->utc();
            $endTime = Carbon::parse($scheduleData['end_time'])->utc();

            $overlap = CampaignSchedule::where('election_id', $electionId)
                ->where('section_id', $scheduleData['section_id'])
                ->where(function ($q) use ($startTime, $endTime) {
                    $q->whereBetween('start_time', [$startTime, $endTime])
                        ->orWhereBetween('end_time', [$startTime, $endTime]);
                })
                ->exists();

            if ($overlap) {
                $errors[] = [
                    'section_id' => $scheduleData['section_id'],
                    'message' => 'Schedule overlaps with existing schedule'
                ];
                continue;
            }

            $schedule = CampaignSchedule::create([
                'election_id' => $electionId,
                'section_id' => $scheduleData['section_id'],
                'start_time' => $startTime,
                'end_time' => $endTime,
                'candidate_id' => $scheduleData['candidate_id'] ?? null,
                'notes' => $scheduleData['notes'] ?? null,
                'status' => 'pending',
                'created_by_user_id' => $userId,
            ]);
            $created[] = $schedule;
        }

        AuditLog::create([
            'user_id' => $userId,
            'action_type' => 'BULK_CREATE_CAMPAIGN_SCHEDULES',
            'target_table' => 'campaign_schedules',
            'new_value' => json_encode(['count' => count($created)]),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => count($created) . ' schedules created successfully',
            'data' => $created,
            'errors' => $errors
        ], 201);
    }

    public function getSections(Request $request)
    {
        $query = CourseSection::with('course')->where('is_active', true);

        if ($request->has('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        if ($request->has('year_level')) {
            $query->where('year_level', $request->year_level);
        }

        $sections = $query->orderBy('course_id')
            ->orderBy('year_level')
            ->orderBy('section_code')
            ->get()
            ->map(function ($section) {
                return [
                    'section_id' => $section->section_id,
                    'name' => $section->course->course_code . ' - Year ' . $section->year_level . ' Section ' . $section->section_code,
                    'course_code' => $section->course->course_code,
                    'year_level' => $section->year_level,
                    'section_code' => $section->section_code,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $sections
        ]);
    }
}
