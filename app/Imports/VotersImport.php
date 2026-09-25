<?php
// app/Imports/VotersImport.php

namespace App\Imports;

use App\Models\Course;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;

class VotersImport implements ToCollection, WithHeadingRow, WithChunkReading, SkipsEmptyRows
{
    /**
     * The registrar's spreadsheet uses department codes.
     * This map converts them to the course codes stored in `courses`.
     *
     * ⚠️ This is the ONLY place in the codebase where CIT / CBA / TED
     * appear. Everywhere else uses `course_id` or `course_code`.
     */
    private const DEPARTMENT_TO_COURSE_CODE = [
        'CIT' => 'BSIT',
        'CBA' => 'BSBA',
        'TED' => 'BEED',
    ];

    private int $importedCount = 0;
    private int $updatedCount  = 0;
    private array $skippedRows = [];

    // ------------------------------------------------------------
    // Chunking — keeps memory bounded on large files
    // ------------------------------------------------------------
    public function chunkSize(): int
    {
        return 500;
    }

    // ------------------------------------------------------------
    // Main entry point
    // ------------------------------------------------------------
    public function collection(Collection $rows): void
    {
        // Preload all courses so we don't hit the DB per row
        $courses = Course::query()
            ->select('course_id', 'course_code')
            ->get()
            ->keyBy(fn($c) => strtoupper($c->course_code));

        foreach ($rows as $index => $row) {
            try {
                $this->processRow($row, $courses, $index + 2); // +2 to account for header
            } catch (\Throwable $e) {
                $this->skippedRows[] = sprintf(
                    'Row %d: %s',
                    $index + 2,
                    $e->getMessage()
                );
                Log::warning('Voter import row failed', [
                    'row'   => $index + 2,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    // ------------------------------------------------------------
    // Per-row processing
    // ------------------------------------------------------------
    private function processRow($row, Collection $courses, int $rowNumber): void
    {
        // The registrar file columns (snake_case after WithHeadingRow):
        //   id_number, last_name, first_name, middle_name, email, department
        $studentId = $this->clean($row['id_number'] ?? null);
        $lastName  = $this->clean($row['last_name'] ?? null);
        $firstName = $this->clean($row['first_name'] ?? null);
        $email     = $this->cleanEmail($row['email'] ?? null);
        $deptCode  = $this->clean($row['department'] ?? null);

        // Required fields
        if (!$studentId || !$lastName || !$firstName || !$email) {
            throw new \RuntimeException('Missing required field(s)');
        }

        // Skip blank / placeholder middle names — column may not exist
        $middleName = $this->cleanNullable($row['middle_name'] ?? null);

        // --- Resolve course_id from the department code ---
        $courseId = null;

        if ($deptCode) {
            $courseCode = self::DEPARTMENT_TO_COURSE_CODE[strtoupper($deptCode)] ?? null;

            if ($courseCode) {
                $course = $courses->get(strtoupper($courseCode));
                $courseId = $course?->course_id;
            }

            // If the department isn't recognized, still import the user,
            // just without a course. They can be assigned later.
            if (!$courseId) {
                Log::info('Unknown department code in import, leaving course_id null', [
                    'row'        => $rowNumber,
                    'department' => $deptCode,
                ]);
            }
        }

        // --- Find existing user (by id_no first, then by email) ---
        $user = User::where('id_no', $studentId)->first()
            ?? User::where('email', $email)->first();

        if ($user) {
            // Update the mutable fields
            $user->first_name = $firstName;
            $user->last_name  = $lastName;
            $user->email      = $email;

            if ($courseId) {
                $user->course_id = $courseId;
            }

            // Only update id_no if it wasn't already set
            if (!$user->id_no) {
                $user->id_no = $studentId;
            }

            $user->save();
            $this->updatedCount++;
            return;
        }

        // --- Create a new user ---
        User::create([
            'first_name'    => $firstName,
            'last_name'     => $lastName,
            'email'         => $email,
            'password_hash' => Hash::make($studentId), // student ID is the default password
            'id_no'    => $studentId,
            'course_id'     => $courseId,
            'year_level'    => null,     // student fills this in later
            'role'          => 'voter',
            'is_active'     => true,
        ]);

        $this->importedCount++;
    }

    // ------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------
    private function clean($value): ?string
    {
        if ($value === null) {
            return null;
        }
        $trimmed = trim((string) $value);
        return $trimmed === '' ? null : $trimmed;
    }

    private function cleanEmail($value): ?string
    {
        $email = $this->clean($value);
        return $email ? strtolower($email) : null;
    }

    /**
     * Middle name: accept blank, "N/A", "NULL", "-" as null.
     */
    private function cleanNullable($value): ?string
    {
        $cleaned = $this->clean($value);
        if (!$cleaned) {
            return null;
        }
        $upper = strtoupper($cleaned);
        if (in_array($upper, ['N/A', 'NA', 'NULL', '-', '—'], true)) {
            return null;
        }
        return $cleaned;
    }

    // ------------------------------------------------------------
    // Public accessors used by ImportVotersJob
    // ------------------------------------------------------------
    public function getImportedCount(): int
    {
        return $this->importedCount;
    }

    public function getUpdatedCount(): int
    {
        return $this->updatedCount;
    }

    public function getSkippedRows(): array
    {
        return $this->skippedRows;
    }
}
