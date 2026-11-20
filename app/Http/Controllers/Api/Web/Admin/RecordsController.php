<?php
// app/Http/Controllers/Api/Web/Admin/RecordsController.php

namespace App\Http\Controllers\Api\Web\Admin;

use App\Http\Controllers\Controller;
use App\Models\Election;
use App\Models\Candidate;
use App\Models\Vote;
use App\Models\ElectionParticipation;
use App\Models\Position;
use App\Models\Partylist;
use App\Services\VoterEligibilityService;
use App\Traits\HasApiResponse;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Barryvdh\DomPDF\Facade\Pdf;

class RecordsController extends Controller
{
    use HasApiResponse;

    /**
     * Get all years that have election records
     */
    public function getYears()
    {
        $years = Election::select(DB::raw('DISTINCT year'))
            ->whereNotNull('year')
            ->orderBy('year', 'desc')
            ->pluck('year')
            ->toArray();

        if (empty($years)) {
            $years = Election::select(DB::raw('YEAR(created_at) as year'))
                ->distinct()
                ->orderBy('year', 'desc')
                ->pluck('year')
                ->toArray();
        }

        return $this->successResponse($years);
    }

    /**
     * Get all records for a specific year
     */
    public function getYearRecords($year)
    {
        return $this->successResponse($this->buildYearRecords($year));
    }

    /**
     * Get yearly statistics for dashboard
     */
    public function getYearlyStats()
    {
        $years = Election::select(DB::raw('DISTINCT year'))
            ->whereNotNull('year')
            ->orderBy('year', 'desc')
            ->get()
            ->pluck('year');

        if ($years->isEmpty()) {
            $years = Election::select(DB::raw('YEAR(created_at) as year'))
                ->distinct()
                ->orderBy('year', 'desc')
                ->get()
                ->pluck('year');
        }

        $stats = [];
        foreach ($years as $year) {
            $elections = Election::where('year', $year)
                ->orWhereYear('created_at', $year)
                ->get();

            $totalVoters = 0;
            $totalVotesCast = 0;
            $csgCount = 0;
            $sboCount = 0;

            foreach ($elections as $election) {
                // Count eligible voters via service
                $totalVoters += VoterEligibilityService::eligibleVoterCount($election);

                // Count voted via participations
                $totalVotesCast += ElectionParticipation::where('election_id', $election->election_id)
                    ->where('has_voted', true)
                    ->count();

                if ($election->election_type === 'CSG') $csgCount++;
                else $sboCount++;
            }

            $stats[] = [
                'year' => $year,
                'elections_count' => $elections->count(),
                'total_voters' => $totalVoters,
                'total_votes_cast' => $totalVotesCast,
                'avg_turnout' => $totalVoters > 0 ? round(($totalVotesCast / $totalVoters) * 100, 2) : 0,
                'csg_count' => $csgCount,
                'sbo_count' => $sboCount,
            ];
        }

        return $this->successResponse($stats);
    }

    /**
     * Get full detail for a single election
     */
    public function getElectionDetail($electionId)
    {
        try {
            return $this->successResponse($this->buildElectionDetail($electionId));
        } catch (\Throwable $e) {
            Log::error('Failed to get election detail: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            return $this->errorResponse(
                'Failed to get election detail: ' . $e->getMessage(),
                500,
            );
        }
    }

    // ------------------------------------------------------------------
    // Data builders (return plain arrays; shared by API + export methods)
    // ------------------------------------------------------------------

    private function buildYearRecords($year): array
    {
        $elections = Election::where('year', $year)
            ->orWhereYear('created_at', $year)
            ->with(['course', 'positions'])
            ->get();

        $totalVoters = 0;
        $totalVotesCast = 0;

        $electionData = $elections->map(function ($election) use (&$totalVoters, &$totalVotesCast) {
            // Count eligible voters via service (department-aware)
            $total = VoterEligibilityService::eligibleVoterCount($election);

            // Count voted users from election_participations
            $voted = ElectionParticipation::where('election_id', $election->election_id)
                ->where('has_voted', true)
                ->count();

            $candidatesCount = Candidate::where('election_id', $election->election_id)
                ->where('is_approved', true)
                ->count();

            $totalVoters += $total;
            $totalVotesCast += $voted;

            return [
                'election_id' => $election->election_id,
                'title' => $election->title,
                'election_type' => $election->election_type,
                'year' => $election->year,
                'department' => $election->department,
                'description' => $election->description,
                'voting_start' => $election->voting_start,
                'voting_end' => $election->voting_end,
                'created_at' => $election->created_at,
                'status' => $this->getStatus($election),
                'positions_count' => $election->positions->count(),
                'candidates_count' => $candidatesCount,
                'voters_total' => $total,
                'voters_voted' => $voted,
                'turnout_percentage' => $total > 0 ? round(($voted / $total) * 100, 2) : 0,
                'has_results' => $voted > 0,
                'course' => $election->course ? [
                    'course_id' => $election->course->course_id,
                    'course_code' => $election->course->course_code,
                    'course_name' => $election->course->course_name,
                ] : null,
            ];
        });

        $avgTurnout = $electionData->count() > 0
            ? round($electionData->avg('turnout_percentage'), 2)
            : 0;

        return [
            'year' => $year,
            'elections' => $electionData->values()->all(),
            'total_elections' => $electionData->count(),
            'total_voters' => $totalVoters,
            'total_votes_cast' => $totalVotesCast,
            'avg_turnout' => $avgTurnout,
        ];
    }

    private function buildElectionDetail($electionId): array
    {
        $election = Election::with(['positions', 'course'])
            ->findOrFail($electionId);

        // ---------- Positions with candidates and votes ----------
        $positions = Position::where('election_id', $electionId)
            ->with(['candidates' => function ($query) {
                $query->where('is_approved', true)
                    ->with(['user', 'partylist']);
            }])
            ->get()
            ->map(function ($position) {
                $candidates = $position->candidates->map(function ($candidate) {
                    $votes = Vote::where('candidate_id', $candidate->candidate_id)->count();

                    return [
                        'candidate_id'   => $candidate->candidate_id,
                        'user_id'        => $candidate->user_id,
                        'first_name'     => $candidate->user?->first_name,
                        'last_name'      => $candidate->user?->last_name,
                        'id_no'          => $candidate->user?->id_no,
                        'partylist_name' => $candidate->partylist?->name,
                        'votes'          => $votes,
                        'winner'         => false,
                    ];
                });

                $topVotes = $candidates->max('votes') ?? 0;

                // FIX: don't mutate $sorted[0]['winner'] in place (Collection is
                // ArrayAccess, so nested writes throw "Indirect modification...").
                // Build the winner flag with map() instead.
                // Candidates tied for the top spot are all marked as winners.
                $sorted = $candidates
                    ->sortByDesc('votes')
                    ->values()
                    ->map(function ($c) use ($topVotes) {
                        $c['winner'] = $topVotes > 0 && $c['votes'] === $topVotes;
                        return $c;
                    })
                    ->all();

                return [
                    'position_id' => $position->position_id,
                    'title'       => $position->title,
                    'category'    => $position->category,
                    'candidates'  => $sorted,
                ];
            })
            ->values()
            ->all();

        // ---------- Voters ----------
        // eligibleVotersQuery() returns a User query, so eager-load `course`
        // (a valid User relation), not `user`.
        $eligibleUsers = VoterEligibilityService::eligibleVotersQuery($election)
            ->with('course')
            ->get();

        $participationMap = ElectionParticipation::where('election_id', $electionId)
            ->get()
            ->keyBy('user_id');

        $voters = $eligibleUsers->map(function ($user) use ($participationMap) {
            $participation = $participationMap->get($user->user_id);

            return [
                'user_id'    => $user->user_id,
                'first_name' => $user->first_name,
                'last_name'  => $user->last_name,
                'id_no'      => $user->id_no,
                'has_voted'  => $participation ? (bool) $participation->has_voted : false,
                'voted_at'   => $participation?->voted_at,
            ];
        })->values()->all();

        // ---------- Partylists with candidate count ----------
        $partylists = Partylist::where('election_id', $electionId)
            ->withCount(['candidates' => function ($query) {
                $query->where('is_approved', true);
            }])
            ->get()
            ->map(function ($partylist) {
                return [
                    'partylist_id'     => $partylist->partylist_id,
                    'name'             => $partylist->name,
                    'description'      => $partylist->description,
                    'logo_url'         => $partylist->logo_url,
                    'candidates_count' => $partylist->candidates_count,
                ];
            })
            ->values()
            ->all();

        // ---------- Timeline ----------
        $timeline = [
            [
                'date'        => $election->created_at?->toDateString() ?? now()->toDateString(),
                'event'       => 'Election Created',
                'description' => 'Election was created by admin',
            ],
            [
                'date'        => $election->voting_start,
                'event'       => 'Voting Started',
                'description' => 'Voting period began',
            ],
            [
                'date'        => $election->voting_end,
                'event'       => 'Voting Ended',
                'description' => 'Voting period concluded',
            ],
        ];

        $hasVotes = ElectionParticipation::where('election_id', $electionId)
            ->where('has_voted', true)
            ->exists();

        if ($hasVotes) {
            $timeline[] = [
                'date'        => now()->toDateString(),
                'event'       => 'Results Available',
                'description' => 'Election results are available',
            ];
        }

        return [
            'election_id'   => $election->election_id,
            'title'         => $election->title,
            'election_type' => $election->election_type,
            'year'          => $election->year,
            'department'    => $election->department,
            'description'   => $election->description,
            'voting_start'  => $election->voting_start,
            'voting_end'    => $election->voting_end,
            'created_at'    => $election->created_at,
            'status'        => $this->getStatus($election),
            'positions'     => $positions,
            'voters_list'   => $voters,
            'partylists'    => $partylists,
            'timeline'      => $timeline,
            'course'        => $election->course ? [
                'course_id'   => $election->course->course_id,
                'course_code' => $election->course->course_code,
                'course_name' => $election->course->course_name,
            ] : null,
        ];
    }

    // ------------------------------------------------------------------
    // Exports
    // ------------------------------------------------------------------

    public function exportYearRecords(Request $request, $year)
    {
        $format = $request->get('format', 'csv');
        $data = $this->buildYearRecords($year);

        if ($format === 'csv') {
            return $this->exportCSV($data, "election_records_{$year}");
        }

        return $this->exportPDF($data, "election_records_{$year}");
    }

    public function exportElection(Request $request, $electionId)
    {
        $format = $request->get('format', 'csv');
        $data = $this->buildElectionDetail($electionId);

        if ($format === 'csv') {
            return $this->exportElectionCSV($data);
        }

        return $this->exportElectionPDF($data);
    }

    private function exportCSV(array $data, $filename)
    {
        $rows = [
            ['Election ID', 'Title', 'Type', 'Status', 'Voters Total', 'Votes Cast', 'Turnout %'],
        ];

        foreach ($data['elections'] as $election) {
            $rows[] = [
                $election['election_id'],
                $election['title'],
                $election['election_type'],
                $election['status'],
                $election['voters_total'],
                $election['voters_voted'],
                $election['turnout_percentage'] . '%',
            ];
        }

        return response($this->toCsv($rows), 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename={$filename}.csv",
        ]);
    }

    private function exportPDF(array $data, $filename)
    {
        // Views expect object-style access ($data->elections), so convert.
        $object = json_decode(json_encode($data));

        $pdf = Pdf::loadView('pdf.election_records', ['data' => $object, 'year' => $object->year]);
        $pdf->setPaper('a4', 'landscape');

        return $pdf->download("{$filename}.pdf");
    }

    private function exportElectionCSV(array $data)
    {
        $rows = [
            ['Position', 'Candidate', 'Partylist', 'Votes', 'Winner'],
        ];

        foreach ($data['positions'] as $position) {
            foreach ($position['candidates'] as $candidate) {
                $rows[] = [
                    $position['title'],
                    trim(($candidate['first_name'] ?? '') . ' ' . ($candidate['last_name'] ?? '')),
                    $candidate['partylist_name'] ?? 'Independent',
                    $candidate['votes'],
                    $candidate['winner'] ? 'Yes' : 'No',
                ];
            }
        }

        $rows[] = [];
        $rows[] = ['Summary'];
        $rows[] = ['Title', $data['title']];
        $rows[] = ['Type', $data['election_type']];
        $rows[] = ['Status', $data['status']];

        return response($this->toCsv($rows), 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=election_{$data['election_id']}_results.csv",
        ]);
    }

    private function exportElectionPDF(array $data)
    {
        // Views expect object-style access ($data->positions), so convert.
        $object = json_decode(json_encode($data));

        $pdf = Pdf::loadView('pdf.election_results', ['data' => $object]);
        $pdf->setPaper('a4', 'landscape');

        return $pdf->download("election_{$object->election_id}_results.pdf");
    }

    /**
     * Build a properly escaped CSV string (handles commas/quotes in titles, names).
     */
    private function toCsv(array $rows): string
    {
        $handle = fopen('php://temp', 'r+');
        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }
        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return $csv;
    }

    private function getStatus($election)
    {
        $now = now();
        $start = Carbon::parse($election->voting_start);
        $end = Carbon::parse($election->voting_end);

        if ($now < $start) return 'upcoming';
        if ($now > $end) return 'ended';
        return 'ongoing';
    }
}