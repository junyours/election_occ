<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });

        // ✅ 429 — Too Many Requests (rate limiter / throttle)
        $this->renderable(function (ThrottleRequestsException $e, $request) {
            if ($this->wantsJson($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Too many attempts. Please wait a moment and try again.',
                ], 429);
            }
        });

        // ✅ 401 — Unauthenticated
        $this->renderable(function (AuthenticationException $e, $request) {
            if ($this->wantsJson($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated. Please log in.',
                ], 401);
            }
        });

        // ✅ 403 — Forbidden
        $this->renderable(function (AccessDeniedHttpException $e, $request) {
            if ($this->wantsJson($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'You do not have permission to perform this action.',
                ], 403);
            }
        });

        // ✅ 404 — Not Found
        $this->renderable(function (NotFoundHttpException $e, $request) {
            if ($this->wantsJson($request)) {
                return response()->json([
                    'success' => false,
                    'message' => 'The requested resource was not found.',
                ], 404);
            }
        });

        // ✅ 422 — Validation
        $this->renderable(function (ValidationException $e, $request) {
            if ($this->wantsJson($request)) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                    'errors'  => $e->errors(),
                ], 422);
            }
        });
    }

    /**
     * ✅ Helper — decide if we should return JSON.
     * Covers /api/* routes, XHR requests, and "Accept: application/json".
     */
    private function wantsJson($request): bool
    {
        return $request->is('api/*')
            || $request->expectsJson()
            || $request->ajax()
            || $request->wantsJson();
    }
}