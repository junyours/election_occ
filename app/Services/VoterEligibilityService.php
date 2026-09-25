<?php
// app/Services/VoterEligibilityService.php

namespace App\Services;

use App\Models\Course;
use App\Models\Election;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class VoterEligibilityService
{
    // ============================================================
    // PUBLIC API
    // ============================================================

    /**
     * Is this user eligible to vote in this election?
     *
     *   - CSG → open to every active voter/candidate
     *   - SBO → only users whose course_id matches the election's course_id
     */
    public static function isEligible(User $user, Election $election): bool
    {
        if (!self::hasVotingRole($user) || !self::isActive($user)) {
            return false;
        }

        if ($election->election_type === 'CSG') {
            return true;
        }

        if ($election->election_type === 'SBO') {
            return self::courseMatches($user, $election);
        }

        return false;
    }

    public static function canApplyForCandidacy(User $user, Election $election): bool
    {
        return self::isEligible($user, $election);
    }

    public static function getCandidacyRestrictionMessage(User $user, Election $election): string
    {
        if ($election->election_type !== 'SBO') {
            return 'You are not eligible to apply in this election.';
        }

        $userCourse     = self::courseCodeFor($user) ?? 'Unknown';
        $electionCourse = self::courseCodeForElection($election) ?? 'Unknown';

        return "This SBO election is for {$electionCourse} students. "
            . "You are enrolled in {$userCourse}. You can only apply for "
            . "SBO elections that match your own course.";
    }

    // ============================================================
    // QUERY HELPERS
    // ============================================================

    public static function eligibleVotersQuery(Election $election): Builder
    {
        $query = User::query()
            ->where('users.is_active', true)
            ->whereIn('users.role', ['voter', 'candidate']);

        if ($election->election_type === 'SBO' && $election->course_id) {
            $query->where('users.course_id', $election->course_id);
        }

        return $query;
    }

    public static function eligibleVoterCount(Election $election): int
    {
        return self::eligibleVotersQuery($election)->count();
    }

    // ============================================================
    // INTERNALS
    // ============================================================

    private static function hasVotingRole(User $user): bool
    {
        return in_array($user->role, ['voter', 'candidate'], true);
    }

    private static function isActive(User $user): bool
    {
        return (bool) $user->is_active;
    }

    private static function courseMatches(User $user, Election $election): bool
    {
        if (!$election->course_id) {
            return true; // No scoping → open to all
        }

        return (int) $user->course_id === (int) $election->course_id;
    }

    private static function courseCodeFor(User $user): ?string
    {
        if ($user->relationLoaded('course') && $user->course) {
            return $user->course->course_code;
        }

        if ($user->course_id) {
            return Course::find($user->course_id)?->course_code;
        }

        return null;
    }

    private static function courseCodeForElection(Election $election): ?string
    {
        if ($election->relationLoaded('course') && $election->course) {
            return $election->course->course_code;
        }

        if ($election->course_id) {
            return Course::find($election->course_id)?->course_code;
        }

        return null;
    }
}
