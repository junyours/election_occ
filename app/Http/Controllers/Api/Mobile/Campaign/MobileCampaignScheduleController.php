<?php

namespace App\Http\Controllers\Api\Mobile\Campaign;

use App\Http\Controllers\Controller;
use App\Models\CampaignSchedule;
use App\Models\Candidate;
use Illuminate\Support\Facades\Log;

class MobileCampaignScheduleController extends Controller
{
    /**
     * Get schedules for a specific candidate (VIEW ONLY)
     * GET /mobile/campaign-schedules/candidate/{candidateId}
     */
    public function getCandidateSchedules($candidateId)
    {
        try {
            $candidate = Candidate::with('user')->findOrFail($candidateId);

            $schedules = CampaignSchedule::where('candidate_id', $candidateId)
                ->with(['election', 'section.course'])
                ->orderBy('start_time')
                ->get()
                ->map(function ($schedule) {
                    // ✅ Build a human-readable section label from the
                    //    course_sections + courses relations.
                    $sectionLabel = null;
                    if ($schedule->section) {
                        $courseCode = $schedule->section->course->course_code ?? null;
                        $yearLevel  = $schedule->section->year_level ?? null;
                        $sectionCode = $schedule->section->section_code ?? null;

                        if ($courseCode && $yearLevel && $sectionCode) {
                            $sectionLabel = "{$courseCode} - Year {$yearLevel} Section {$sectionCode}";
                        } elseif ($courseCode && $sectionCode) {
                            $sectionLabel = "{$courseCode} - Section {$sectionCode}";
                        } elseif ($courseCode) {
                            $sectionLabel = $courseCode;
                        }
                    }

                    return [
                        'schedule_id'     => $schedule->schedule_id,
                        'election' => $schedule->election ? [
                            'election_id' => $schedule->election->election_id,
                            'title'       => $schedule->election->title,
                        ] : null,

                        // ✅ New structured section object
                        'section' => $schedule->section ? [
                            'section_id'   => $schedule->section->section_id,
                            'section_code' => $schedule->section->section_code,
                            'section_name' => $schedule->section->section_name,
                            'year_level'   => $schedule->section->year_level,
                            'course' => $schedule->section->course ? [
                                'course_id'   => $schedule->section->course->course_id,
                                'course_code' => $schedule->section->course->course_code,
                                'course_name' => $schedule->section->course->course_name,
                            ] : null,
                        ] : null,

                        // ✅ Backwards-compatible string label for the mobile UI
                        'course_section'  => $sectionLabel,

                        'start_time'      => $schedule->start_time,
                        'end_time'        => $schedule->end_time,
                        'status'          => $schedule->status,
                        'notes'           => $schedule->notes,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => [
                    'candidate' => [
                        'candidate_id' => $candidate->candidate_id,
                        'name' => trim(
                            ($candidate->user->first_name ?? '') . ' ' .
                                ($candidate->user->last_name ?? '')
                        ),
                    ],
                    'schedules' => $schedules,
                    'total'     => $schedules->count(),
                ],
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Candidate not found',
            ], 404);
        } catch (\Exception $e) {
            Log::error('Mobile getCandidateSchedules error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch candidate schedules',
            ], 500);
        }
    }
}
