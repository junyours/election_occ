<?php
// app/Jobs/ImportVotersJob.php

namespace App\Jobs;

use App\Imports\VotersImport;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use App\Imports\CountingImport;

class ImportVotersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Cache key holding the import_id of the currently running import. */
    public const ACTIVE_KEY = 'voter-import:active';

    public int $timeout = 1800;

    // Full-sync import: never retry automatically.
    public int $tries = 1;

    public function __construct(
        public int $electionId,
        public int $adminUserId,
        public string $storedFilePath,
        public string $importId,
    ) {}

    public static function progressKey(string $importId): string
    {
        return "voter-import:{$importId}:progress";
    }

    public static function resultKey(string $importId): string
    {
        return "voter-import:{$importId}:result";
    }

    public function handle(): void
    {
        @ini_set('max_execution_time', '600');
        @ini_set('memory_limit', '512M');
        @set_time_limit(600);

        $progressKey  = self::progressKey($this->importId);
        $resultKey    = self::resultKey($this->importId);
        $absolutePath = Storage::disk('local')->path($this->storedFilePath);

        Cache::put($progressKey, [
            'status'     => 'running',
            'processed'  => 0,
            'total'      => 0,
            'imported'   => 0,
            'updated'    => 0,
            'deactivated'=> 0,
            'failed'     => 0,
            'percent'    => 0,
            'message'    => 'Reading file…',
            'started_at' => now()->toISOString(),
        ], now()->addHours(2));

        try {
            $totalRows = $this->countRows($absolutePath);

            Cache::put($progressKey, array_merge(
                Cache::get($progressKey, []),
                [
                    'total'   => $totalRows,
                    'message' => "Processing {$totalRows} rows…",
                ],
            ), now()->addHours(2));

            $import = new VotersImport();
            $import->setProgressKey($progressKey);
            $import->setTotalRows($totalRows);

            Excel::import($import, $absolutePath);

            // ✅ Deactivate everyone NOT in this upload
            $deactivated = $import->syncActiveStatus();

            $created = $import->getImportedCount();
            $updated = $import->getUpdatedCount();
            $skipped = count($import->getSkippedRows());

            $summary = sprintf(
                'Import complete: %d new, %d updated, %d deactivated, %d skipped.',
                $created, $updated, $deactivated, $skipped,
            );

            // Save the result FIRST, then flip progress to "completed",
            // so the frontend never sees "completed" without a result.
            Cache::put($resultKey, [
                'success'           => true,
                'imported_count'    => $created,
                'updated_count'     => $updated,
                'deactivated_count' => $deactivated,
                'skipped_count'     => $skipped,
                'skipped_rows'      => array_slice($import->getSkippedRows(), 0, 100),
                'completed_at'      => now()->toISOString(),
            ], now()->addHours(2));

            Cache::put($progressKey, [
                'status'      => 'completed',
                'processed'   => $totalRows,
                'total'       => $totalRows,
                'imported'    => $created,
                'updated'     => $updated,
                'deactivated' => $deactivated,
                'failed'      => $skipped,
                'percent'     => 100,
                'message'     => $summary,
                'finished_at' => now()->toISOString(),
            ], now()->addHours(2));

            // Release the lock so a new import can start
            Cache::forget(self::ACTIVE_KEY);

            try {
                $admin = User::find($this->adminUserId);
                if ($admin) {
                    app(NotificationService::class)->send(
                        $admin->user_id,
                        'Voter Import Complete',
                        $summary,
                        'system',
                        [
                            'election_id' => $this->electionId,
                            'import_id'   => $this->importId,
                            'created'     => $created,
                            'updated'     => $updated,
                            'deactivated' => $deactivated,
                            'skipped'     => $skipped,
                        ]
                    );
                }
            } catch (\Throwable $e) {
                Log::warning('Failed to notify admin: ' . $e->getMessage());
            }

            if (Storage::disk('local')->exists($this->storedFilePath)) {
                Storage::disk('local')->delete($this->storedFilePath);
            }
        } catch (\Throwable $e) {
            Cache::put($progressKey, [
                'status'  => 'failed',
                'message' => 'Import failed: ' . $e->getMessage(),
                'percent' => 0,
                'failed'  => true,
            ], now()->addHours(2));

            Cache::put($resultKey, [
                'success' => false,
                'message' => $e->getMessage(),
            ], now()->addHours(2));

            Cache::forget(self::ACTIVE_KEY);

            throw $e;
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Voter import job failed permanently', [
            'election_id' => $this->electionId,
            'admin_id'    => $this->adminUserId,
            'import_id'   => $this->importId,
            'error'       => $exception->getMessage(),
        ]);

        $progressKey = self::progressKey($this->importId);
        Cache::put($progressKey, [
            'status'  => 'failed',
            'message' => 'Import failed: ' . $exception->getMessage(),
            'percent' => 0,
            'failed'  => true,
        ], now()->addHours(2));

        // Always release the lock, even on timeout / worker kill
        Cache::forget(self::ACTIVE_KEY);

        try {
            $admin = User::find($this->adminUserId);
            if ($admin) {
                app(NotificationService::class)->send(
                    $admin->user_id,
                    'Voter Import Failed',
                    'The import failed: ' . $exception->getMessage(),
                    'system'
                );
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to notify admin: ' . $e->getMessage());
        }
    }

    private function countRows(string $absolutePath): int
    {
        try {
            $sheets = Excel::toArray(new CountingImport(), $absolutePath);
            $first  = $sheets[0] ?? [];
            return max(0, count($first) - 1);
        } catch (\Throwable $e) {
            Log::warning('Row pre-count failed, falling back to 0: ' . $e->getMessage());
            return 0;
        }
    }
}