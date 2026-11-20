<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Your Login Code</title>
</head>
<body style="font-family: Arial, sans-serif; background:#f5f5f5; padding: 24px;">
    <div style="max-width: 520px; margin: 0 auto; background:#fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        <div style="background:#1a56db; padding: 20px 24px;">
            <h1 style="color:#fff; margin:0; font-size:18px;">OCC Election System</h1>
        </div>
        <div style="padding: 24px;">
            <p style="font-size:15px; color:#333;">Hi {{ $userName }},</p>
            <p style="font-size:15px; color:#333;">
                Use the code below to complete your login. It expires in
                <strong>{{ $ttlMinutes }} minutes</strong>.
            </p>

            <div style="text-align:center; margin: 28px 0;">
                <div style="display:inline-block; padding: 14px 32px; background:#f0f4ff; border: 1px dashed #1a56db; border-radius: 10px;">
                    <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color:#1a56db;">
                        {{ $otpCode }}
                    </span>
                </div>
            </div>

            <p style="font-size:13px; color:#888;">
                If you didn't try to log in, please ignore this email and consider changing your password.
            </p>
        </div>
        <div style="text-align:center; padding: 14px; font-size:12px; color:#999; border-top:1px solid #eee;">
            © {{ date('Y') }} Opol Community College
        </div>
    </div>
</body>
</html>