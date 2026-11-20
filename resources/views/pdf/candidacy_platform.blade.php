{{-- resources/views/pdf/candidacy_platform.blade.php --}}
{{-- Styled to match CandidacyApplicationForm.tsx (web form). Compact: fits one letter page. --}}
@php
    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    // $f('key')  -> form value, or '' when missing/empty (keeps 0 and "0")
    $f = function (string $key, $default = '') use ($form) {
        return (isset($form[$key]) && $form[$key] !== '' && $form[$key] !== null)
            ? $form[$key]
            : $default;
    };

    // $val('key') -> escaped value for a printed line; &nbsp; when empty so the
    // underline keeps its height (DomPDF ignores min-height on empty cells).
    $val = function (string $key, $default = '') use ($f) {
        $x = $f($key, $default);
        return $x === '' ? '&nbsp;' : e($x);
    };

    // Same as $val but for an arbitrary string
    $show = function ($x) {
        return ($x === null || $x === '') ? '&nbsp;' : e($x);
    };

    // yyyy-mm-dd (date input) -> "Jan 05, 2026"; anything else printed as-is
    $fmtDate = function ($x) {
        if (is_string($x) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $x)) {
            return date('M d, Y', strtotime($x));
        }
        return $x;
    };

    // ------------------------------------------------------------------
    // Seals  (images live in public/images/seals/)
    //   occ.png -> college seal, shown on the left (falls back to default.png)
    //   csg.png -> CSG seal, shown on the right
    // ------------------------------------------------------------------
    $toDataUri = function (?string $file) {
        if (!$file) {
            return null;
        }
        $path = public_path('images/seals/' . $file);
        if (!is_file($path)) {
            return null;
        }
        $ext  = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $mime = in_array($ext, ['jpg', 'jpeg']) ? 'image/jpeg' : 'image/png';
        return 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($path));
    };

    $collegeSeal = $toDataUri('occ.png') ?? $toDataUri('default.png');
    $csgSeal     = $toDataUri('csg.png');

    $refNo = !empty($application->application_id)
        ? 'OCC-APP-' . str_pad($application->application_id, 5, '0', STR_PAD_LEFT)
        : null;
@endphp
<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>Application for Candidacy</title>
    <style>
        /*
         * Palette (Tailwind equivalents used by the web form)
         * blue-900 #1e3a8a | blue-700 #1d4ed8 | blue-600 #2563eb | blue-300 #93c5fd
         * blue-100 #dbeafe | blue-50 #eff6ff | indigo-600 #4f46e5
         * gray-900 #111827 | gray-800 #1f2937 | gray-600 #4b5563 | gray-500 #6b7280
         * gray-400 #9ca3af | amber-400 #fbbf24 | amber-50 #fffbeb
         */

        /* Page margins: top / right / bottom / left.
           NOTE: do NOT use a "* { margin:0 }" reset anywhere in this file. In DomPDF
           it overrides the @page margin (that is why the margins were missing). */
        @page {
            margin: 0.4in 0.55in 0.6in 0.55in;
        }

        body,
        div,
        span,
        p,
        h3,
        ul,
        li,
        table,
        th,
        td,
        img {
            margin: 0;
            padding: 0;
        }

        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 8.5pt;
            line-height: 1.25;
            color: #111827;
        }

        table {
            border-collapse: collapse;
        }

        /* Top accent bar (gradient is not supported by DomPDF) ------- */
        table.topbar {
            width: 100%;
            margin-bottom: 7px;
        }

        table.topbar td {
            height: 5px;
            font-size: 1px;
            line-height: 1px;
        }

        /* Letterhead ------------------------------------------------- */
        .lh-wrap {
            border: 2px solid #1e3a8a;
            border-radius: 6px;
            margin-bottom: 9px;
        }

        table.lh {
            width: 100%;
        }

        table.lh td {
            vertical-align: middle;
        }

        td.lh-left {
            background: #eff6ff;
            padding: 5px 9px;
            border-right: 2px solid #1e3a8a;
        }

        td.lh-right {
            width: 170px;
            background: #1e3a8a;
            color: #ffffff;
            text-align: center;
            padding: 5px 8px;
        }

        table.lh-inner {
            width: 100%;
        }

        .lh-seal {
            width: 46px;
            text-align: center;
        }

        .lh-seal img {
            width: 42px;
            height: 42px;
        }

        .lh-text {
            text-align: center;
            line-height: 1.2;
        }

        .lh-country {
            font-size: 7pt;
            font-weight: bold;
            color: #1e3a8a;
        }

        .lh-school {
            font-size: 11pt;
            font-weight: bold;
            color: #111827;
        }

        .lh-place {
            font-size: 7pt;
            color: #4b5563;
        }

        .lh-title {
            font-size: 9.5pt;
            font-weight: bold;
            letter-spacing: 0.5px;
        }

        .lh-sy {
            margin-top: 4px;
            font-size: 7pt;
        }

        .lh-sy b {
            display: inline-block;
            min-width: 58px;
            border-bottom: 1px solid #93c5fd;
            text-align: center;
            font-size: 8.5pt;
            padding: 0 3px;
        }

        .ref {
            font-size: 6pt;
            color: #bfdbfe;
            margin-top: 3px;
        }

        /* Underlined "Label: ____" fields ---------------------------- */
        table.row {
            width: 100%;
            margin-bottom: 5px;
        }

        table.row td {
            vertical-align: bottom;
        }

        td.lbl {
            white-space: nowrap;
            font-weight: bold;
            color: #1f2937;
            font-size: 8.5pt;
            padding-right: 5px;
            width: 1%;
        }

        td.line {
            border-bottom: 1px solid #9ca3af;
            padding: 0 4px 0 4px;
            font-size: 9pt;
            color: #111827;
        }

        td.gap {
            width: 16px;
        }

        /* Name block ------------------------------------------------- */
        table.name3 {
            width: 100%;
            table-layout: fixed;
        }

        table.name3 td.nl {
            border-bottom: 1px solid #9ca3af;
            padding: 0 4px 0 4px;
            font-size: 9pt;
            text-align: left;
        }

        table.name3 td.ng {
            width: 10px;
        }

        table.name3 td.cap {
            text-align: center;
            font-size: 6.5pt;
            font-style: italic;
            color: #6b7280;
            padding-top: 1px;
        }

        /* Photo ------------------------------------------------------ */
        .photo-box {
            width: 86px;
            height: 86px;
            border: 2px dashed #fbbf24;
            background: #fffbeb;
            border-radius: 8px;
            text-align: center;
            line-height: 86px;
            font-size: 7.5pt;
            color: #b45309;
            margin: 0 auto;
        }

        .photo-box img {
            width: 86px;
            height: 86px;
            border-radius: 6px;
        }

        .photo-cap {
            font-size: 6pt;
            color: #6b7280;
            text-align: center;
            line-height: 1.15;
            margin-top: 2px;
        }

        /* Rounded tinted panels -------------------------------------- */
        .panel {
            background: #f1f6fe;
            border-radius: 8px;
            padding: 6px 10px;
            margin-top: 7px;
            min-height: 92px;
        }

        .panel.auto {
            min-height: 0;
        }

        .ph {
            margin-bottom: 4px;
        }

        .ph .badge {
            display: inline-block;
            width: 13px;
            height: 13px;
            border-radius: 7px;
            background: #dbeafe;
            color: #1d4ed8;
            text-align: center;
            line-height: 13px;
            font-size: 7pt;
            font-weight: bold;
            margin-right: 4px;
        }

        .ph .t {
            font-size: 9pt;
            font-weight: bold;
            color: #111827;
        }

        table.opt {
            width: 100%;
            margin-bottom: 4px;
        }

        table.opt td {
            vertical-align: bottom;
        }

        table.opt td.cb {
            width: 18px;
            padding-left: 6px;
        }

        table.opt td.ol {
            font-size: 8pt;
        }

        table.opt td.ov {
            border-bottom: 1px solid #9ca3af;
            font-size: 8.5pt;
            font-weight: bold;
            padding: 0 4px 0 4px;
        }

        .off {
            color: #9ca3af;
        }

        .chk {
            display: inline-block;
            width: 9px;
            height: 9px;
            border: 1.2px solid #6b7280;
            border-radius: 2px;
            background: #ffffff;
            text-align: center;
            line-height: 9px;
            font-size: 7pt;
            font-weight: bold;
            color: #ffffff;
        }

        .chk.on {
            background: #2563eb;
            border-color: #2563eb;
        }

        .chk.dim {
            border-color: #d1d5db;
        }

        .sub-line {
            padding-left: 24px;
            font-size: 7.5pt;
            margin-top: 1px;
        }

        .sub-line .k {
            color: #4b5563;
        }

        .sub-line .v {
            font-weight: bold;
            border-bottom: 1px solid #9ca3af;
            padding: 0 4px;
        }

        /* Affiliations ----------------------------------------------- */
        table.aff {
            width: 100%;
            table-layout: fixed;
        }

        table.aff th {
            text-align: left;
            font-size: 7pt;
            font-weight: bold;
            color: #111827;
            padding: 0 6px 1px 4px;
        }

        table.aff td {
            border-bottom: 1px solid #9ca3af;
            padding: 3px 6px 0 4px;
            font-size: 8.5pt;
            height: 12px;
        }

        table.aff td.no,
        table.aff th.no {
            width: 16px;
            border-bottom: none;
            padding-left: 0;
            text-align: left;
        }

        /* Declaration + signing -------------------------------------- */
        .declaration ul {
            margin: 2px 0 0 18px;
        }

        .declaration li {
            font-size: 8pt;
            color: #1f2937;
            margin-bottom: 1px;
        }

        .signed-line {
            font-size: 8.5pt;
            line-height: 1.6;
        }

        .blank {
            display: inline-block;
            min-width: 22px;
            border-bottom: 1px solid #9ca3af;
            text-align: center;
            font-weight: bold;
            padding: 0 3px;
        }

        table.signrow {
            width: 100%;
            margin-top: 7px;
        }

        table.signrow td {
            vertical-align: bottom;
        }

        .sig-cell {
            width: 215px;
            text-align: center;
        }

        .sig-img {
            max-height: 40px;
            max-width: 200px;
        }

        .sig-space {
            height: 28px;
        }

        .sig-rule {
            border-top: 1.5px solid #1f2937;
            width: 200px;
            margin: 0 auto;
        }

        .sig-name {
            font-weight: bold;
            font-size: 8.5pt;
            margin-top: 1px;
        }

        .sig-caption {
            font-size: 7pt;
            color: #4b5563;
        }

        /* Platform & qualifications card ------------------------------ */
        .card {
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 6px 10px 7px 10px;
            margin-top: 8px;
        }

        .card h3 {
            font-size: 9pt;
            font-weight: bold;
            color: #111827;
            margin-bottom: 4px;
        }

        table.two {
            width: 100%;
            table-layout: fixed;
        }

        table.two td {
            vertical-align: top;
        }

        table.two td.sp {
            width: 10px;
        }

        .card .fl {
            font-size: 7.5pt;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 2px;
        }

        .card .box {
            border: 1px solid #d1d5db;
            border-radius: 5px;
            padding: 4px 6px;
        }

        .body-text {
            white-space: pre-wrap;
            font-size: 8pt;
            line-height: 1.3;
            color: #1f2937;
        }

        /* Long layout (page 2) */
        .ctx {
            font-size: 8pt;
            color: #4b5563;
            margin: 0 0 8px 17px;
        }

        .fl.lg {
            font-size: 9pt;
            margin-bottom: 3px;
        }

        .box.lg {
            padding: 7px 10px;
        }

        .body-text.lg {
            font-size: 9.5pt;
            line-height: 1.45;
        }

        .empty {
            color: #9ca3af;
            font-style: italic;
            font-size: 8pt;
        }

        /* Footer ----------------------------------------------------- */
        .footer {
            position: fixed;
            left: 0;
            right: 0;
            bottom: -0.45in;
            border-top: 1px solid #d1d5db;
            padding-top: 3px;
        }

        .footer table {
            width: 100%;
        }

        .footer td {
            font-size: 6.5pt;
            color: #6b7280;
        }

        .footer .r {
            text-align: right;
        }

        .pagenum:before {
            content: counter(page);
        }
    </style>
</head>

<body>

    {{-- Footer (fixed: sits in the bottom page margin) --}}
    <div class="footer">
        <table>
            <tr>
                <td>
                    System-generated document from the OCC Election System &bull; Generated {{ $generatedAt ?? now()->format('F d, Y g:i A') }}
                    @if($refNo) &bull; {{ $refNo }} @endif
                </td>
                <td class="r">Page <span class="pagenum"></span></td>
            </tr>
        </table>
    </div>

    {{-- Top accent bar --}}
    <table class="topbar">
        <tr>
            <td style="background:#1d4ed8; width:33%;">&nbsp;</td>
            <td style="background:#4f46e5; width:34%;">&nbsp;</td>
            <td style="background:#1d4ed8; width:33%;">&nbsp;</td>
        </tr>
    </table>

    {{-- Letterhead: school block (left) + title block (right) --}}
    <div class="lh-wrap">
        <table class="lh">
            <tr>
                <td class="lh-left">
                    <table class="lh-inner">
                        <tr>
                            <td class="lh-seal">
                                @if($collegeSeal)
                                <img src="{{ $collegeSeal }}" alt="OCC Seal">
                                @endif
                            </td>
                            <td class="lh-text">
                                <div class="lh-country">Republic of the Philippines</div>
                                <div class="lh-school">Opol Community College</div>
                                <div class="lh-place">Opol, Misamis Oriental</div>
                            </td>
                            <td class="lh-seal">
                                @if($csgSeal)
                                <img src="{{ $csgSeal }}" alt="CSG Seal">
                                @endif
                            </td>
                        </tr>
                    </table>
                </td>
                <td class="lh-right">
                    <div class="lh-title">APPLICATION FOR<br>CANDIDACY</div>
                    <div class="lh-sy">SCHOOL YEAR&nbsp; <b>{!! $val('schoolYear') !!}</b></div>
                    @if($refNo)
                    <div class="ref">{{ $refNo }}</div>
                    @endif
                </td>
            </tr>
        </table>
    </div>

    {{-- Name / age / course / address  +  photo --}}
    <table style="width:100%;">
        <tr>
            <td style="vertical-align:top; padding-right:14px;">

                <div style="font-weight:bold; font-size:8.5pt;">Name:</div>
                <table class="name3">
                    <tr>
                        <td class="nl" style="width:35%;">{!! $val('lastName') !!}</td>
                        <td class="ng"></td>
                        <td class="nl" style="width:40%;">{!! $val('firstName') !!}</td>
                        <td class="ng"></td>
                        <td class="nl" style="width:15%;">{!! $val('middleInitial') !!}</td>
                    </tr>
                    <tr>
                        <td class="cap">Last Name</td>
                        <td></td>
                        <td class="cap">First Name</td>
                        <td></td>
                        <td class="cap">M.I.</td>
                    </tr>
                </table>

                <div style="height:6px;"></div>

                <table class="row"><tr>
                    <td class="lbl">Age:</td>
                    <td class="line" style="width:20%;">{!! $val('age') !!}</td>
                    <td class="gap"></td>
                    <td class="lbl">Course:</td>
                    <td class="line">{!! $val('course') !!}</td>
                </tr></table>

                <table class="row" style="margin-bottom:3px;"><tr>
                    <td class="lbl">Present Address:</td>
                    <td class="line">{!! $val('presentAddress') !!}</td>
                </tr></table>
                <table class="row" style="margin-bottom:0;"><tr>
                    <td class="lbl" style="visibility:hidden;">Present Address:</td>
                    <td class="line">{!! $val('presentAddress2') !!}</td>
                </tr></table>

            </td>
            <td style="width:96px; vertical-align:top;">
                <div class="photo-box">
                    @if(!empty($photoUrl))
                    <img src="{{ $photoUrl }}">
                    @else
                    2 X 2 Photo
                    @endif
                </div>
                <div class="photo-cap">Photo from face registration</div>
            </td>
        </tr>
    </table>

    <div style="height:6px;"></div>

    {{-- Student No / Current Year / Unit Load / Cellphone / Social media --}}
    <table class="row"><tr>
        <td class="lbl">Student No.:</td>
        <td class="line" style="width:32%;">{!! $val('studentNo') !!}</td>
        <td class="gap"></td>
        <td class="lbl">Current Year:</td>
        <td class="line">{!! $val('currentYear') !!}</td>
    </tr></table>

    <table class="row"><tr>
        <td class="lbl">No. Unit Load:</td>
        <td class="line" style="width:32%;">{!! $val('noUnitLoad') !!}</td>
        <td class="gap"></td>
        <td class="lbl">Cellphone:</td>
        <td class="line">{!! $val('cellphone') !!}</td>
    </tr></table>

    <table class="row" style="margin-bottom:0;"><tr>
        <td class="lbl">Social Media Account:</td>
        <td class="line">{!! $val('socialMedia') !!}</td>
    </tr></table>

    {{-- Position applied for  |  Political party affiliation (side by side) --}}
    <table style="width:100%; table-layout:fixed;">
        <tr>
            <td style="vertical-align:top; width:50%;">
                <div class="panel">
                    <div class="ph"><span class="badge">&#9670;</span><span class="t">Position applied for</span></div>

                    <table class="opt" style="table-layout:fixed;">
                        <colgroup><col style="width:18px"><col style="width:132px"><col></colgroup>
                        <tr>
                            <td class="cb"><span class="chk {{ $f('positionCSG') ? 'on' : 'dim' }}">{!! $f('positionCSG') ? '&#10003;' : '&nbsp;' !!}</span></td>
                            <td class="ol {{ $f('positionCSG') ? '' : 'off' }}">Central Student Govt.</td>
                            <td class="ov">{!! $f('positionCSG') ? $show($f('selectedPosition')) : '&nbsp;' !!}</td>
                        </tr>
                    </table>

                    <table class="opt" style="table-layout:fixed;">
                        <colgroup><col style="width:18px"><col style="width:132px"><col></colgroup>
                        <tr>
                            <td class="cb"><span class="chk {{ $f('positionSC') ? 'on' : 'dim' }}">{!! $f('positionSC') ? '&#10003;' : '&nbsp;' !!}</span></td>
                            <td class="ol {{ $f('positionSC') ? '' : 'off' }}">Student Council</td>
                            <td class="ov">{!! $f('positionSC') ? $show($f('selectedPosition')) : '&nbsp;' !!}</td>
                        </tr>
                    </table>

                    <table class="opt" style="table-layout:fixed; margin-bottom:0;">
                        <colgroup><col style="width:18px"><col style="width:132px"><col></colgroup>
                        <tr>
                            <td class="cb"></td>
                            <td class="ol">Department</td>
                            <td class="ov">{!! $val('department') !!}</td>
                        </tr>
                    </table>
                </div>
            </td>
            <td style="width:8px;"></td>
            <td style="vertical-align:top; width:50%;">
                <div class="panel">
                    <div class="ph"><span class="badge">&#9873;</span><span class="t">Political Party Affiliation</span></div>

                    <table class="opt"><tr>
                        <td class="cb"><span class="chk {{ $f('partyIndependent') ? 'on' : '' }}">{!! $f('partyIndependent') ? '&#10003;' : '&nbsp;' !!}</span></td>
                        <td class="ol">Independent</td>
                    </tr></table>

                    <table class="opt"><tr>
                        <td class="cb"><span class="chk {{ $f('partyExisting') ? 'on' : '' }}">{!! $f('partyExisting') ? '&#10003;' : '&nbsp;' !!}</span></td>
                        <td class="ol">
                            Join an Existing Political Party
                            @if($f('partyExisting'))
                            &mdash; <strong>{{ !empty($partylistName) ? $partylistName : 'Existing Partylist' }}</strong>
                            @endif
                        </td>
                    </tr></table>

                    <table class="opt" style="margin-bottom:0;"><tr>
                        <td class="cb"><span class="chk {{ $f('partyCreate') ? 'on' : '' }}">{!! $f('partyCreate') ? '&#10003;' : '&nbsp;' !!}</span></td>
                        <td class="ol">Create a New Political Party</td>
                    </tr></table>

                    @if($f('partyCreate'))
                    <div class="sub-line"><span class="k">Party Name:</span> <span class="v">{{ $f('newPartyName') }}</span></div>
                    @if($f('newPartyDescription'))
                    <div class="sub-line"><span class="k">Description:</span> <span class="v">{{ $f('newPartyDescription') }}</span></div>
                    @endif
                    @endif
                </div>
            </td>
        </tr>
    </table>

    {{-- Present affiliation --}}
    <div class="panel auto">
        <div class="ph"><span class="badge">&#9786;</span><span class="t">Present Affiliation</span></div>
        <table class="aff">
            <colgroup>
                <col style="width:16px"><col style="width:34%"><col style="width:30%"><col>
            </colgroup>
            <tr>
                <th class="no">&nbsp;</th>
                <th>Organization</th>
                <th>Position</th>
                <th>Date of Membership</th>
            </tr>
            @for($i = 1; $i <= 3; $i++)
            <tr>
                <td class="no">{{ $i }}</td>
                <td>{!! $show($f("aff{$i}Org")) !!}</td>
                <td>{!! $show($f("aff{$i}Pos")) !!}</td>
                <td>{!! $show($fmtDate($f("aff{$i}Date"))) !!}</td>
            </tr>
            @endfor
        </table>
    </div>

    {{-- Declaration --}}
    <div class="panel auto declaration">
        <div class="ph"><span class="badge">&#10004;</span><span class="t">Declaration</span></div>
        <div style="font-size:8pt;">I further declare the following:</div>
        <ul>
            <li>I am a bona fide student of Opol Community College.</li>
            <li>I am willing to perform the duties and responsibilities of the position I am applying for.</li>
            <li>All information provided in this application is true and correct.</li>
        </ul>
    </div>

    {{-- Signing line (left) + signature (right) --}}
    <table class="signrow">
        <tr>
            <td>
                <div class="signed-line">
                    Signed on this
                    <span class="blank">{{ $f('signedDay') }}</span>
                    day of
                    <span class="blank" style="min-width:64px;">{{ $f('signedMonth') }}</span>
                    20<span class="blank">{{ $f('signedYear') }}</span>
                    at Opol Community College, Opol, Misamis Oriental.
                </div>
            </td>
            <td class="sig-cell">
                @if(!empty($signature))
                <img class="sig-img" src="{{ $signature }}">
                @else
                <div class="sig-space"></div>
                @endif
                <div class="sig-rule"></div>
                <div class="sig-name">{{ trim($f('firstName') . ' ' . $f('middleInitial') . ' ' . $f('lastName')) }}</div>
                <div class="sig-caption">Signature of Applicant</div>
            </td>
        </tr>
    </table>

    {{-- Campaign platform & qualifications
         - short text: compact card on page 1 (side by side)
         - long text : whole section moves to page 2, full width, flows to more pages --}}
    @php
        // Break any unbroken run of characters so it can never run past the edge
        $wrapLong = fn ($t, $n) => preg_replace('/(\S{' . $n . '})(?=\S)/u', '$1 ', (string) $t);

        // Rough line estimate (chars per line) to decide compact vs. long layout
        $estLines = function ($t, $cpl) {
            $n = 0;
            foreach (preg_split('/\R/', (string) $t) as $para) {
                $n += max(1, (int) ceil(mb_strlen($para) / $cpl));
            }
            return $n;
        };

        $platformText = (string) $f('platform');
        $qualText     = (string) $f('qualifications');
        $compact      = max($estLines($platformText, 42), $estLines($qualText, 42)) <= 5;
    @endphp

    @if($compact)
    <div class="card">
        <h3>Campaign Platform &amp; Qualifications</h3>
        <table class="two">
            <tr>
                <td>
                    <div class="fl">Campaign Platform</div>
                    <div class="box">
                        @if($platformText !== '')
                        <div class="body-text">{{ $wrapLong($platformText, 32) }}</div>
                        @else
                        <div class="empty">No platform provided.</div>
                        @endif
                    </div>
                </td>
                <td class="sp"></td>
                <td>
                    <div class="fl">Qualifications &amp; Achievements</div>
                    <div class="box">
                        @if($qualText !== '')
                        <div class="body-text">{{ $wrapLong($qualText, 32) }}</div>
                        @else
                        <div class="empty">No qualifications provided.</div>
                        @endif
                    </div>
                </td>
            </tr>
        </table>
    </div>
    @else
    <div style="page-break-before: always;">
        <div class="ph"><span class="badge">&#9998;</span><span class="t" style="font-size:10.5pt;">Campaign Platform &amp; Qualifications</span></div>
        <div class="ctx">
            Applicant: <strong>{{ trim($f('firstName') . ' ' . $f('middleInitial') . ' ' . $f('lastName')) }}</strong>
            @if($f('studentNo')) &bull; {{ $f('studentNo') }} @endif
            @if($refNo) &bull; {{ $refNo }} @endif
        </div>

        <div class="fl lg">Campaign Platform</div>
        <div class="box lg">
            @if($platformText !== '')
            <div class="body-text lg">{{ $wrapLong($platformText, 70) }}</div>
            @else
            <div class="empty">No platform provided.</div>
            @endif
        </div>

        <div class="fl lg" style="margin-top:10px;">Qualifications &amp; Achievements</div>
        <div class="box lg">
            @if($qualText !== '')
            <div class="body-text lg">{{ $wrapLong($qualText, 70) }}</div>
            @else
            <div class="empty">No qualifications provided.</div>
            @endif
        </div>
    </div>
    @endif

</body>

</html>