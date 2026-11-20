<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\CheckRole;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

// ✅ Exception imports
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'checkRole' => CheckRole::class,
        ]);

        $middleware->api(prepend: [
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // ============================================================
        // ✅ 429 — Too Many Requests (rate limiter / throttle)
        // ============================================================
        $exceptions->render(function (ThrottleRequestsException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $retryAfter = $e->getHeaders()['Retry-After'] ?? null;

                return response()->json([
                    'success' => false,
                    'message' => 'Too many attempts. Please wait a moment and try again.',
                    'retry_after' => $retryAfter ? (int) $retryAfter : null,
                ], 429, $e->getHeaders());
            }
        });

        // ============================================================
        // ✅ 401 — Unauthenticated
        // ============================================================
        $exceptions->render(function (AuthenticationException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated. Please log in.',
                ], 401);
            }
        });

        // ============================================================
        // ✅ 403 — Forbidden
        // ============================================================
        $exceptions->render(function (AccessDeniedHttpException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'You do not have permission to perform this action.',
                ], 403);
            }
        });

        // ============================================================
        // ✅ 404 — Not Found
        // ============================================================
        $exceptions->render(function (NotFoundHttpException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'The requested resource was not found.',
                ], 404);
            }
        });

        // ============================================================
        // ✅ 422 — Validation
        // ============================================================
        $exceptions->render(function (ValidationException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                    'errors'  => $e->errors(),
                ], 422);
            }
        });

        // ============================================================
        // ✅ Other HttpExceptions (405, 500, 503, etc.)
        //    Preserves status code + message but wraps in JSON shape
        // ============================================================
        $exceptions->render(function (HttpException $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage() ?: 'Request failed.',
                ], $e->getStatusCode(), $e->getHeaders());
            }
        });
    })->create();