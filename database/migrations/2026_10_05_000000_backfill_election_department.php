<?php
// database/migrations/2026_10_05_000000_backfill_election_course.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Backfill `course_id` on SBO elections that don't have one yet,
     * by matching the course code found in the election title.
     *
     * Course codes live in the `courses` table — they are NOT the
     * department codes (CIT/CBA/TED) used by the registrar's import file.
     */
    public function up(): void
    {
        $courses = DB::table('courses')
            ->select('course_id', 'course_code')
            ->get();

        if ($courses->isEmpty()) {
            return;
        }

        $elections = DB::table('elections')
            ->where('election_type', 'SBO')
            ->whereNull('course_id')
            ->get();

        foreach ($elections as $election) {
            if (empty($election->title)) {
                continue;
            }

            $upperTitle = strtoupper($election->title);
            $matchedCourseId = null;

            foreach ($courses as $course) {
                if (str_contains($upperTitle, strtoupper($course->course_code))) {
                    $matchedCourseId = $course->course_id;
                    break;
                }
            }

            if ($matchedCourseId) {
                DB::table('elections')
                    ->where('election_id', $election->election_id)
                    ->update(['course_id' => $matchedCourseId]);
            }
        }
    }

    public function down(): void
    {
        // No rollback — course_id is derived data
    }
};