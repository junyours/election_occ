<?php
// app/Imports/CountingImport.php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\ToArray;

class CountingImport implements ToArray
{
    /**
     * Maatwebsite calls this for each sheet. We don't persist anything —
     * we just need the raw row count via Excel::toArray() in the job.
     */
    public function array(array $array): void
    {
        // Intentionally empty — the job counts the returned array.
    }
}