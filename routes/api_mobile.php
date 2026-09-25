<?php
// routes/api_mobile.php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\Mobile\Auth\MobileAuthController;
use App\Http\Controllers\Api\Mobile\Auth\MobileFaceController;
use App\Http\Controllers\Api\Mobile\Auth\MobilePasswordController;
use App\Http\Controllers\Api\Mobile\Election\MobileElectionController;
use App\Http\Controllers\Api\Mobile\Election\MobileCandidateController;
use App\Http\Controllers\Api\Mobile\Election\MobileVoteController;
use App\Http\Controllers\Api\Mobile\Partylist\MobilePartylistController;
use App\Http\Controllers\Api\Mobile\Interaction\MobileCommentController;
use App\Http\Controllers\Api\Mobile\Course\MobileCourseController;
use App\Http\Controllers\Api\Mobile\Campaign\MobileCampaignScheduleController;
use App\Http\Controllers\Api\Web\Campaign\CampaignPostController;

/*
|--------------------------------------------------------------------------
| Mobile API Routes (On-Device Face Recognition)
|--------------------------------------------------------------------------
*/

// ==================== PUBLIC ====================
Route::prefix('mobile')->group(function () {

    // Auth
    Route::post('/login', [MobileAuthController::class, 'login']);
    Route::post('/register', [MobileAuthController::class, 'register']);
    Route::post('/forgot-password', [MobilePasswordController::class, 'forgotPassword']);
    Route::post('/reset-password', [MobilePasswordController::class, 'resetPassword']);
    Route::post('/verify-credentials', [MobileAuthController::class, 'verifyCredentials']);

    // Face embeddings registration (pre-login)
    Route::post('/face/register-embeddings', [MobileFaceController::class, 'registerEmbeddings']);

    // Courses
    Route::get('/courses', [MobileCourseController::class, 'index']);
    Route::get('/courses/{id}', [MobileCourseController::class, 'show']);

    // Partylists
    Route::get('/partylists', [MobilePartylistController::class, 'index']);
    Route::get('/partylists/{id}', [MobilePartylistController::class, 'show']);

    // Elections
    Route::get('/elections', [MobileElectionController::class, 'index']);
    Route::get('/elections/active', [MobileElectionController::class, 'getActiveElection']);
    Route::get('/elections/{id}', [MobileElectionController::class, 'show']);
    Route::get('/elections/{id}/results', [MobileElectionController::class, 'getResults']);

    // Candidates
    Route::get('/candidates/{id}', [MobileCandidateController::class, 'getById']);
    Route::get('/candidates/election/{electionId}', [MobileCandidateController::class, 'getByElection']);

    // Campaign schedules (public view)
    Route::get('/campaign-schedules/candidate/{candidateId}', [MobileCampaignScheduleController::class, 'getCandidateSchedules']);
});

// ==================== AUTHENTICATED ====================
Route::prefix('mobile')->middleware(['auth:sanctum'])->group(function () {

    // Auth & profile
    Route::post('/logout', [MobileAuthController::class, 'logout']);
    Route::get('/me', [MobileAuthController::class, 'me']);
    Route::post('/change-password', [MobilePasswordController::class, 'changePassword']);

    // ✅ Profile photo
    Route::post('/profile/photo', [MobileAuthController::class, 'uploadProfilePhoto']);
    Route::delete('/profile/photo', [MobileAuthController::class, 'deleteProfilePhoto']);

    // Face data
    Route::get('/face/data', [MobileFaceController::class, 'getFaceData']);
    Route::get('/face/status', [MobileFaceController::class, 'getFaceStatus']);
    Route::delete('/face/data', [MobileFaceController::class, 'deleteFaceData']);

    // Voting
    Route::get('/elections/{electionId}/ballot', [MobileCandidateController::class, 'getBallot']);
    Route::post('/elections/{electionId}/vote', [MobileVoteController::class, 'castVote']);
    Route::get('/elections/{electionId}/vote-status', [MobileVoteController::class, 'checkStatus']);
    Route::get('/elections/{electionId}/receipt', [MobileVoteController::class, 'getReceipt']);
    Route::get('/votes/history', [MobileVoteController::class, 'getHistory']);

    // Comments
    Route::get('/comments/election/{electionId}', [MobileCommentController::class, 'getByElection']);
    Route::post('/comments', [MobileCommentController::class, 'store']);

    Route::prefix('campaign-posts')->group(function () {
        Route::get('/election/{electionId}', [CampaignPostController::class, 'getPosts']);
        Route::get('/candidate/{candidateId}', [CampaignPostController::class, 'getCandidatePosts']);
        Route::post('/{postId}/comments', [CampaignPostController::class, 'addComment']);
        Route::delete('/comments/{commentId}', [CampaignPostController::class, 'deleteComment']);
        Route::post('/{postId}/reactions', [CampaignPostController::class, 'addReaction']);
        Route::delete('/{postId}/reactions', [CampaignPostController::class, 'removeReaction']);
    });
});
