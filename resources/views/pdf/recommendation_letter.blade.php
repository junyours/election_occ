@php
// ------------------------------------------------------------------
// Seals (images live in: public/images/seals/)
// occ.png -> college seal, shown on the LEFT
// (falls back to default.png / default.jpg)
// <course>.png -> course seal, shown on the RIGHT
    // (.jpg also works; blank if the course has no seal)
    // Course aliases are lowercase with no spaces/symbols and are matched
    // against the applicant's course (e.g. "BS Information Technology"
    // becomes "bsinformationtechnology"). Add a new course by adding a
    // line below and dropping its image in public/images/seals/.
    // ------------------------------------------------------------------
    $courseSeals = [
    'bsit' => ['bsit', 'bsinformationtechnology', 'informationtechnology'],
    'beed' => ['beed', 'bachelorofelementaryeducation', 'elementaryeducation'],
    'bsba' => ['bsba', 'bsbusinessadministration', 'businessadministration'],
    ];

    // Embed as base64 so DomPDF never needs remote access / path config.
    // Tries the base name with .png, .jpg and .jpeg.
    $sealUri = function (?string $base) {
    if (!$base) {
    return null;
    }
    foreach (['png', 'jpg', 'jpeg'] as $ext) {
    $path = public_path('images/seals/' . $base . '.' . $ext);
    if (is_file($path)) {
    $mime = $ext === 'png' ? 'image/png' : 'image/jpeg';
    return 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($path));
    }
    }
    return null;
    };

    $normalizedCourse = preg_replace('/[^a-z0-9]/', '', strtolower($form['course'] ?? ''));
    $courseBase = null;
    if ($normalizedCourse !== '') {
    foreach ($courseSeals as $base => $aliases) {
    foreach ($aliases as $alias) {
    if (str_contains($normalizedCourse, $alias)) {
    $courseBase = $base;
    break 2;
    }
    }
    }
    }

    $collegeSealSrc = $sealUri('occ') ?? $sealUri('default');
    $courseSealSrc = $sealUri($courseBase);
    @endphp
    <!DOCTYPE html>
    <html>

    <head>
        <meta charset="UTF-8">
        <title>Recommendation Letter</title>
        <style>
            /* ONE-PAGE LAYOUT (DomPDF)
           - sizes are in pt and every default margin is reset, because
             DomPDF adds its own margins to h1/h2/h3/p
           - the footer is position:fixed, so it sits in the bottom page
             margin and takes no space in the content flow */
            @page {
                margin: 0.5in 0.7in 0.7in 0.7in;
            }

            * {
                box-sizing: border-box;
            }

            body {
                font-family: 'Times New Roman', Times, serif;
                margin: 0;
                padding: 0;
                color: #1a1a1a;
                font-size: 11pt;
                line-height: 1.3;
            }

            h1,
            h2,
            h3,
            p {
                margin: 0;
                padding: 0;
            }

            .header {
                text-align: center;
                border-bottom: 2px solid #1a1a1a;
                padding-bottom: 6px;
                margin-bottom: 10px;
            }

            .header h1 {
                font-size: 15pt;
                letter-spacing: 1px;
            }

            .header h2 {
                font-size: 13pt;
                margin: 2px 0;
            }

            .header p {
                font-size: 10pt;
            }

            .header h3 {
                font-size: 12pt;
                margin-top: 6px;
            }

            .content {
                margin: 8px 0 0 0;
            }

            .content p {
                font-size: 11pt;
                margin: 0 0 7px 0;
                text-align: justify;
            }

            .details {
                margin: 6px 0 8px 0;
            }

            .details table {
                border-collapse: collapse;
            }

            .details td {
                padding: 1px 8px;
                font-size: 11pt;
                line-height: 1.25;
            }

            .details .label {
                font-weight: bold;
                width: 110px;
            }

            .signature {
                margin-top: 16px;
                page-break-inside: avoid;
            }

            .signature .box {
                width: 250px;
                margin-left: auto;
                text-align: center;
            }

            .signature .line {
                border-top: 1px solid #1a1a1a;
                margin-top: 26px;
            }

            .signature .label {
                font-size: 10pt;
                margin-top: 2px;
            }

            .footer {
                position: fixed;
                left: 0;
                right: 0;
                bottom: -0.45in;
                text-align: center;
                font-size: 9pt;
                color: #555;
                border-top: 1px solid #ccc;
                padding-top: 5px;
            }
        </style>
    </head>

    <body>
        <div class="header">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="width: 90px; text-align: left; vertical-align: middle;">
                        @if ($collegeSealSrc)
                        <img src="{{ $collegeSealSrc }}" alt="OCC Seal" style="width: 80px; height: 80px;">
                        @endif
                    </td>
                    <td style="text-align: center; vertical-align: middle;">
                        <h1>Republic of the Philippines</h1>
                        <h2>Opol Community College</h2>
                        <p>Opol, Misamis Oriental</p>
                    </td>
                    {{-- Course seal (right). Empty cell keeps the text centered if none exists --}}
                    <td style="width: 90px; text-align: right; vertical-align: middle;">
                        @if ($courseSealSrc)
                        <img src="{{ $courseSealSrc }}" alt="Course Seal" style="width: 80px; height: 80px;">
                        @endif
                    </td>
                </tr>
            </table>
            <h3>RECOMMENDATION LETTER FOR CANDIDACY</h3>
        </div>

        <div class="content">
            <p>Date: <strong>{{ $date }}</strong></p>
            <p>To the Commission on Elections (COMELEC),</p>
            <p>This is to recommend <strong>{{ $user->first_name }} {{ $user->last_name }}</strong> (Student ID: {{ $user->id_no }}) as a candidate for the position of <strong>{{ $form['selectedPosition'] ?? 'N/A' }}</strong> in the upcoming {{ $election->title }}.</p>

            <p>The applicant has submitted the required application form and has been verified by the administration. We find the applicant to be a bona fide student of Opol Community College with good moral character and academic standing.</p>

            <p>We recommend the applicant for consideration by the COMELEC for final approval.</p>

            <div class="details">
                <table>
                    <tr>
                        <td class="label">Name:</td>
                        <td>{{ $user->first_name }} {{ $user->last_name }}</td>
                    </tr>
                    <tr>
                        <td class="label">Student No.:</td>
                        <td>{{ $user->id_no }}</td>
                    </tr>
                    <tr>
                        <td class="label">Course:</td>
                        <td>{{ $form['course'] ?? 'N/A' }}</td>
                    </tr>
                    <tr>
                        <td class="label">Year Level:</td>
                        <td>{{ $form['currentYear'] ?? 'N/A' }}</td>
                    </tr>
                    <tr>
                        <td class="label">Position:</td>
                        <td>{{ $form['positionCSG'] ? 'CSG' : ($form['positionSC'] ? 'Student Council' : '') }}</td>
                    </tr>
                    <tr>
                        <td class="label">Department:</td>
                        <td>{{ $form['department'] ?? 'N/A' }}</td>
                    </tr>
                </table>
            </div>

            <p>We hope for your favorable action on this application.</p>
        </div>

        <div class="signature">
            <div class="box">
                <div class="line"></div>
                <div class="label">Signature of Administrator</div>
                <div style="margin-top: 4px;"><strong>{{ $application->adminApprovedBy ? $application->adminApprovedBy->first_name . ' ' . $application->adminApprovedBy->last_name : 'Admin' }}</strong></div>
                <div style="font-size: 10pt;">Date: {{ $application->admin_approved_at ? $application->admin_approved_at->format('F d, Y') : '' }}</div>
            </div>
        </div>

        <div class="footer">
            This is a system-generated document. No signature is required for digital copy.
        </div>
    </body>

    </html>