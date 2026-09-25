<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title>Reset Your Password</title>
</head>

<body style="font-family: Arial, sans-serif; background:#f5f5f5; padding: 24px; margin: 0;">
    <div style="max-width: 520px; margin: 0 auto; background:#fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="background:#1a56db; padding: 20px 24px;">
            <h1 style="color:#fff; margin:0; font-size:18px;">OCC Election System</h1>
        </div>
        <div style="padding: 24px;">
            <p style="font-size:15px; color:#333;">Hi {{ $userName }},</p>

            <p style="font-size:15px; color:#333;">
                We received a request to reset your password. Click the button
                below to choose a new one.
            </p>

            <div style="text-align: center; margin: 28px 0;">
                <a href="{{ $resetUrl }}"
                    style="display: inline-block; padding: 14px 32px; background:#1a56db; color:#fff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px;">
                    Reset My Password
                </a>
            </div>

            <p style="font-size: 13px; color: #666;">
                This link expires in <strong>{{ $ttlMinutes ?? 60 }} minutes</strong>.
            </p>

            <p style="font-size: 12px; color: #999; word-break: break-all;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{{ $resetUrl }}" style="color:#1a56db;">{{ $resetUrl }}</a>
            </p>

            <p style="font-size:13px; color:#888; margin-top: 24px;">
                If you didn't request this, you can safely ignore this email —
                your password won't change.
            </p>
        </div>
        <div style="text-align:center; padding: 14px; font-size:12px; color:#999; border-top:1px solid #eee;">
            © {{ date('Y') }} Opol Community College
        </div>
    </div>
</body>

</html>