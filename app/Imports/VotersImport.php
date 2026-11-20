<?php
// app/Imports/VotersImport.php

namespace App\Imports;

use App\Models\Course;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;

class VotersImport implements ToCollection, WithHeadingRow, WithChunkReading, SkipsEmptyRows
{
    private const DEPARTMENT_TO_COURSE_CODE = [
        'CIT' => 'BSIT',
        'CBA' => 'BSBA',
        'TED' => 'BEED',
    ];

    private int $importedCount = 0;
    private int $updatedCount  = 0;
    private int $deactivatedCount = 0;
    private array $skippedRows = [];

    // ✅ Progress state
    private string $progressKey   = '';
    private int    $totalRows     = 0;
    private int    $processedRows = 0;

    // ✅ Active-sync state — every user_id touched by this upload
    private array $touchedUserIds = [];

    public function setProgressKey(string $key): void
    {
        $this->progressKey = $key;
    }

    public function setTotalRows(int $total): void
    {
        $this->totalRows = $total;
    }

    public function chunkSize(): int
    {
        return 500;
    }

    public function collection(Collection $rows): void
    {
        $courses = Course::query()
            ->select('course_id', 'course_code')
            ->get()
            ->keyBy(fn($c) => strtoupper($c->course_code));

        foreach ($rows as $index => $row) {
            $this->processedRows++;

            try {
                $this->processRow($row, $courses, $index + 2);
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

            if ($this->processedRows % 10 === 0 ||
                $this->processedRows === $this->totalRows) {
                $this->writeProgress();
            }
        }
    }

    /**
     * Called by ImportVotersJob after Excel::import() finishes.
     * Deactivates every voter/candidate NOT in the uploaded file.
     */
    public function syncActiveStatus(): int
    {
        // Only consider role voter/candidate — never touch admin/comelec
        $query = User::query()
            ->whereIn('role', ['voter', 'candidate'])
            ->where('is_active', true);

        // Only deactivate the ones we didn't see in the upload
        if (!empty($this->touchedUserIds)) {
            $query->whereNotIn('user_id', $this->touchedUserIds);
        }

        $count = $query->count();

        if ($count > 0) {
            $query->update(['is_active' => false]);
            Log::info("Voter import sync: deactivated {$count} users not in upload");
        }

        $this->deactivatedCount = $count;
        return $count;
    }

    private function processRow($row, Collection $courses, int $rowNumber): void
    {
        $studentId = $this->clean($row['id_number'] ?? null);
        $lastName  = $this->clean($row['last_name'] ?? null);
        $firstName = $this->clean($row['first_name'] ?? null);
        $email     = $this->cleanEmail($row['email'] ?? null);
        $deptCode  = $this->clean($row['department'] ?? null);

        if (!$studentId || !$lastName || !$firstName || !$email) {
            throw new \RuntimeException('Missing required field(s)');
        }

        $middleName = $this->cleanNullable($row['middle_name'] ?? null);

        $courseId = null;
        if ($deptCode) {
            $courseCode = self::DEPARTMENT_TO_COURSE_CODE[strtoupper($deptCode)] ?? null;
            if ($courseCode) {
                $course = $courses->get(strtoupper($courseCode));
                $courseId = $course?->course_id;
            }
            if (!$courseId) {
                Log::info('Unknown department code in import, leaving course_id null', [
                    'row'        => $rowNumber,
                    'department' => $deptCode,
                ]);
            }
        }

        $user = User::where('id_no', $studentId)->first()
            ?? User::where('email', $email)->first();

        if ($user) {
            $user->first_name = $firstName;
            $user->last_name  = $lastName;
            $user->email      = $email;

            if ($courseId) $user->course_id = $courseId;
            if (!$user->id_no) $user->id_no = $studentId;

            // ✅ Reactivate — they're in the current upload
            $user->is_active = true;

            $user->save();
            $this->updatedCount++;
            $this->touchedUserIds[] = $user->user_id;
            return;
        }

        $newUser = User::create([
            'first_name'    => $firstName,
            'last_name'     => $lastName,
            'email'         => $email,
            'password_hash' => Hash::make($studentId),
            'id_no'         => $studentId,
            'course_id'     => $courseId,
            'year_level'    => null,
            'role'          => 'voter',
            'is_active'     => true,
        ]);

        $this->importedCount++;
        $this->touchedUserIds[] = $newUser->user_id;
    }

    // ------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------
    private function clean($value): ?string
    {
        if ($value === null) return null;
        $trimmed = trim((string) $value);
        return $trimmed === '' ? null : $trimmed;
    }

    private function cleanEmail($value): ?string
    {
        $email = $this->clean($value);
        return $email ? strtolower($email) : null;
    }

    private function cleanNullable($value): ?string
    {
        $cleaned = $this->clean($value);
        if (!$cleaned) return null;
        $upper = strtoupper($cleaned);
        if (in_array($upper, ['N/A', 'NA', 'NULL', '-', '—'], true)) {
            return null;
        }
        return $cleaned;
    }

    private function writeProgress(): void
    {
        if ($this->progressKey === '') return;

        $percent = $this->totalRows > 0
            ? round(($this->processedRows / $this->totalRows) * 100)
            : 0;

        $current = Cache::get($this->progressKey, []);

        Cache::put(
            $this->progressKey,
            array_merge($current, [
                'status'    => 'running',
                'processed' => $this->processedRows,
                'total'     => $this->totalRows,
                'imported'  => $this->importedCount,
                'updated'   => $this->updatedCount,
                'failed'    => count($this->skippedRows),
                'percent'   => $percent,
                'message'   => "{$this->processedRows} of {$this->totalRows} rows processed ({$percent}%)",
            ]),
            now()->addHours(2),
        );
    }

    // ------------------------------------------------------------
    // Accessors
    // ------------------------------------------------------------
    public function getImportedCount(): int      { return $this->importedCount; }
    public function getUpdatedCount(): int       { return $this->updatedCount; }
    public function getSkippedRows(): array      { return $this->skippedRows; }
    public function getDeactivatedCount(): int   { return $this->deactivatedCount; }
    public function getProcessedCount(): int     { return $this->processedRows; }
    public function getTouchedUserIds(): array   { return $this->touchedUserIds; }
}