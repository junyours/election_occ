<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title>{{ config('app.name', 'OCC Election System') }}</title>

        <!-- PWA -->
        <link rel="manifest" href="/manifest.webmanifest">
        <meta name="theme-color" content="#00346e">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-title" content="OCC Election">
        <meta name="apple-mobile-web-app-status-bar-style" content="default">
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @viteReactRefresh
        @vite(['resources/js/main.tsx'])
    </head>
    <body>
        <div id="root"></div>
    </body>
</html>