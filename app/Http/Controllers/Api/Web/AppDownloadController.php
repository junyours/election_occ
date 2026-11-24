<?php

namespace App\Http\Controllers\Api\Web;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;

class AppDownloadController extends Controller
{
    public function download()
    {
        $path = 'apps/occ-voting.apk';

        if (!Storage::disk('local')->exists($path)) {
            abort(404, 'App file not found.');
        }

        return Storage::disk('local')->download(
            $path,
            'OCC-Voting.apk',
            ['Content-Type' => 'application/vnd.android.package-archive']
        );
    }
}