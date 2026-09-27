{{-- resources/views/pdf/candidacy_platform.blade.php --}}
<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>Application for Candidacy</title>
    <style>
        @page {
            margin: 12mm 1in;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 10.5px;
            color: #1a1a1a;
            line-height: 1.45;
        }

        .letterhead {
            width: 100%;
            border: 2px solid #1e3a8a;
            border-collapse: collapse;
            margin-bottom: 14px;
        }

        .letterhead td {
            vertical-align: middle;
            padding: 8px 10px;
        }

        .letterhead .id-cell {
            border-right: 2px solid #1e3a8a;
            width: 68%;
        }

        .seal {
            width: 44px;
            height: 44px;
            border: 1.5px solid #1e3a8a;
            border-radius: 50%;
            text-align: center;
            vertical-align: middle;
            font-size: 7px;
            font-weight: 700;
            color: #1e3a8a;
            line-height: 1.1;
        }

        .id-text {
            text-align: center;
        }

        .id-text .country {
            font-size: 9px;
            font-weight: 700;
            color: #1e3a8a;
        }

        .id-text .school {
            font-size: 13px;
            font-weight: 700;
            color: #111827;
        }

        .id-text .place {
            font-size: 9px;
            color: #4b5563;
        }

        .app-cell {
            background: #1e3a8a;
            color: #ffffff;
            text-align: center;
        }

        .app-cell .app-title {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.4px;
        }

        .app-cell .sy-row {
            margin-top: 6px;
            font-size: 9.5px;
        }

        .sy-blank {
            display: inline-block;
            min-width: 70px;
            border-bottom: 1px solid #bfdbfe;
            color: #ffffff;
            font-weight: 700;
            padding: 0 4px;
        }

        .value-line {
            border-bottom: 1px solid #6b7280;
            display: block;
            min-height: 13px;
            padding: 1px 2px;
        }

        .caption {
            text-align: center;
            font-size: 8.5px;
            font-style: italic;
            color: #6b7280;
            margin-top: 1px;
        }

        .field-row {
            width: 100%;
            margin-bottom: 5px;
        }

        .field-row .flabel {
            font-weight: 700;
            color: #1f2937;
            white-space: nowrap;
            padding-right: 6px;
        }

        .req {
            color: #b91c1c;
        }

        table.top-block {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }

        table.top-block>tbody>tr>td {
            vertical-align: top;
        }

        .details-col {
            width: 76%;
            padding-right: 14px;
        }

        .photo-col {
            width: 24%;
            text-align: center;
        }

        .photo-box {
            width: 90px;
            height: 90px;
            border: 1.5px dashed #b45309;
            background: #fffbeb;
            margin: 0 auto;
            text-align: center;
            font-size: 8.5px;
            line-height: 90px;
            color: #b45309;
        }

        .photo-box img {
            width: 88px;
            height: 88px;
        }

        .photo-caption {
            font-size: 8px;
            color: #6b7280;
            width: 100px;
            margin: 4px auto 0;
            text-align: center;
        }

        table.namegrid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6px;
        }

        table.namegrid td {
            width: 33.33%;
            padding: 0 4px;
        }

        table.namegrid td:first-child {
            padding-left: 0;
        }

        table.kv {
            width: 100%;
            border-collapse: collapse;
        }

        table.kv td {
            padding: 2px 0;
            font-size: 10.5px;
        }

        table.kv td.k {
            width: 32%;
            font-weight: 700;
            color: #1f2937;
            white-space: nowrap;
        }

        table.kv td.v {
            border-bottom: 1px solid #6b7280;
            padding-left: 4px;
        }

        .box {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 5px;
            padding: 9px 12px;
            margin-bottom: 10px;
        }

        .box-title {
            font-size: 10.5px;
            font-weight: 700;
            color: #1e3a8a;
            margin-bottom: 6px;
        }

        .box-note {
            font-size: 8.5px;
            color: #6b7280;
            margin-bottom: 5px;
        }

        .chk {
            display: inline-block;
            width: 10px;
            height: 10px;
            border: 1.2px solid #1e3a8a;
            text-align: center;
            line-height: 9px;
            font-size: 8.5px;
            font-weight: 700;
            color: #1e3a8a;
            margin-right: 5px;
        }

        .chk.on {
            background: #1e3a8a;
            color: #ffffff;
        }

        .opt-row {
            margin-bottom: 4px;
        }

        .opt-label {
            font-size: 10.5px;
        }

        .plain-section {
            border: 1px solid #d1d5db;
            border-radius: 5px;
            padding: 9px 12px;
            margin-bottom: 10px;
        }

        .plain-title {
            font-size: 10.5px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }

        .body-text {
            white-space: pre-wrap;
            font-size: 10.5px;
            color: #1f2937;
        }

        .empty {
            color: #9ca3af;
            font-style: italic;
        }

        table.aff {
            width: 100%;
            border-collapse: collapse;
            margin-top: 2px;
        }

        table.aff th {
            font-size: 9px;
            text-align: left;
            color: #1f2937;
            border-bottom: 1px solid #9ca3af;
            padding: 3px 4px;
        }

        table.aff td {
            font-size: 10px;
            padding: 4px 4px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: top;
        }

        table.aff td.num {
            width: 5%;
            color: #6b7280;
        }

        .declaration ul {
            margin: 4px 0 0 16px;
            padding: 0;
        }

        .declaration li {
            font-size: 10px;
            margin-bottom: 2px;
        }

        .signed-line {
            font-size: 10.5px;
            margin: 10px 0 2px;
        }

        .signed-blank {
            display: inline-block;
            min-width: 26px;
            border-bottom: 1px solid #6b7280;
            text-align: center;
            font-weight: 700;
            padding: 0 3px;
        }

        table.sigblock {
            width: 100%;
            margin-top: 22px;
        }

        table.sigblock td {
            vertical-align: bottom;
        }

        .sig-right {
            width: 220px;
            text-align: center;
        }

        .sig-img {
            max-height: 55px;
            max-width: 200px;
        }

        .sig-line {
            border-bottom: 1.5px solid #1a1a1a;
            height: 40px;
            width: 200px;
            margin: 0 auto;
        }

        .sig-caption {
            font-size: 9px;
            color: #4b5563;
            margin-top: 3px;
        }

        .footer {
            margin-top: 18px;
            padding-top: 6px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 8px;
            color: #9ca3af;
        }
    </style>
</head>

<body>

    {{-- Letterhead --}}
    <table class="letterhead">
        <tr>
            <td class="id-cell">
                <table style="width:100%; border-collapse:collapse;">
                    <tr>
                        <td style="width:44px;">
                            <div class="seal">OCC<br>LOGO</div>
                        </td>
                        <td class="id-text">
                            <div class="country">Republic of the Philippines</div>
                            <div class="school">Opol Community College</div>
                            <div class="place">Opol, Misamis Oriental</div>
                        </td>
                        <td style="width:44px;">
                            <div class="seal">CSG<br>SEAL</div>
                        </td>
                    </tr>
                </table>
            </td>
            <td class="app-cell">
                <div class="app-title">APPLICATION FOR CANDIDACY</div>
                <div class="sy-row">
                    SCHOOL YEAR
                    <span class="sy-blank">{{ !empty($form['schoolYear']) ? $form['schoolYear'] : '&nbsp;' }}</span>
                </div>
            </td>
        </tr>
    </table>

    @if(!empty($electionTitle))
    <div style="text-align:center; font-size:10px; color:#4b5563; margin:-6px 0 12px;">{{ $electionTitle }}</div>
    @endif

    {{-- Name / details + photo --}}
    <table class="top-block">
        <tr>
            <td class="details-col">

                <div style="font-size:10.5px; font-weight:700; margin-bottom:2px;">Name:</div>
                <table class="namegrid">
                    <tr>
                        <td>
                            <span class="value-line">{{ !empty($form['lastName']) ? $form['lastName'] : '&nbsp;' }}</span>
                            <div class="caption">Last Name</div>
                        </td>
                        <td>
                            <span class="value-line">{{ !empty($form['firstName']) ? $form['firstName'] : '&nbsp;' }}</span>
                            <div class="caption">First Name</div>
                        </td>
                        <td>
                            <span class="value-line">{{ !empty($form['middleInitial']) ? $form['middleInitial'] : '&nbsp;' }}</span>
                            <div class="caption">M.I.</div>
                        </td>
                    </tr>
                </table>

                <table class="kv" style="margin-top:6px;">
                    <tr>
                        <td class="k">Age <span class="req">*</span>:</td>
                        <td class="v">{{ !empty($form['age']) ? $form['age'] : '&nbsp;' }}</td>
                    </tr>
                    <tr>
                        <td class="k">Course <span class="req">*</span>:</td>
                        <td class="v">{{ !empty($form['course']) ? $form['course'] : '&nbsp;' }}</td>
                    </tr>
                    <tr>
                        <td class="k">Present Address <span class="req">*</span>:</td>
                        <td class="v">{{ !empty($form['presentAddress']) ? $form['presentAddress'] : '&nbsp;' }}</td>
                    </tr>
                    @if(!empty($form['presentAddress2']))
                    <tr>
                        <td class="k">&nbsp;</td>
                        <td class="v">{{ $form['presentAddress2'] }}</td>
                    </tr>
                    @endif
                </table>
            </td>
            <td class="photo-col">
                <div class="photo-box">
                    @if(!empty($photoUrl))
                    <img src="{{ $photoUrl }}" style="vertical-align: middle;">
                    @else
                    <span style="vertical-align: middle;">2 X 2 Photo</span>
                    @endif
                </div>
                <div class="photo-caption">Photo from face registration</div>
            </td>
        </tr>
    </table>

    <table class="kv" style="margin-bottom:12px;">
        <tr>
            <td class="k">Student No. <span class="req">*</span>:</td>
            <td class="v">{{ !empty($form['studentNo']) ? $form['studentNo'] : '&nbsp;' }}</td>
        </tr>
        <tr>
            <td class="k">Current Year <span class="req">*</span>:</td>
            <td class="v">{{ !empty($form['currentYear']) ? $form['currentYear'] : '&nbsp;' }}</td>
        </tr>
        <tr>
            <td class="k">No. Unit Load <span class="req">*</span>:</td>
            <td class="v">{{ isset($form['noUnitLoad']) && $form['noUnitLoad'] !== '' ? $form['noUnitLoad'] : '&nbsp;' }}</td>
        </tr>
        <tr>
            <td class="k">Cellphone <span class="req">*</span>:</td>
            <td class="v">{{ !empty($form['cellphone']) ? $form['cellphone'] : '&nbsp;' }}</td>
        </tr>
        <tr>
            <td class="k">Social Media Account:</td>
            <td class="v">{{ !empty($form['socialMedia']) ? $form['socialMedia'] : '&nbsp;' }}</td>
        </tr>
    </table>

    {{-- Position applied for --}}
    <div class="box">
        <div class="box-title">Position applied for</div>
        <div class="box-note">The organization is auto-selected based on the election type.</div>

        <div class="opt-row">
            <span class="chk {{ !empty($form['positionCSG']) ? 'on' : '' }}">{{ !empty($form['positionCSG']) ? '&#10003;' : '' }}</span>
            <span class="opt-label" style="font-weight:600;">Central Student Government</span>
            @if(!empty($form['positionCSG']))
            <span class="value-line" style="display:inline-block; min-width:220px; margin-left:8px;">{{ !empty($form['selectedPosition']) ? $form['selectedPosition'] : '&nbsp;' }}</span>
            @endif
        </div>

        <div class="opt-row">
            <span class="chk {{ !empty($form['positionSC']) ? 'on' : '' }}">{{ !empty($form['positionSC']) ? '&#10003;' : '' }}</span>
            <span class="opt-label" style="font-weight:600;">Student Council</span>
            @if(!empty($form['positionSC']))
            <span class="value-line" style="display:inline-block; min-width:220px; margin-left:8px;">{{ !empty($form['selectedPosition']) ? $form['selectedPosition'] : '&nbsp;' }}</span>
            @endif
        </div>

        <table class="kv" style="margin-top:6px; width:60%;">
            <tr>
                <td class="k">Department:</td>
                <td class="v">{{ !empty($form['department']) ? $form['department'] : '&nbsp;' }}</td>
            </tr>
        </table>
    </div>

    {{-- Political party --}}
    <div class="box">
        <div class="box-title">Political Party Affiliation</div>
        <div class="box-note">Select only one option.</div>

        <div class="opt-row">
            <span class="chk {{ !empty($form['partyIndependent']) ? 'on' : '' }}">{{ !empty($form['partyIndependent']) ? '&#10003;' : '' }}</span>
            <span class="opt-label">Independent</span>
        </div>

        <div class="opt-row">
            <span class="chk {{ !empty($form['partyExisting']) ? 'on' : '' }}">{{ !empty($form['partyExisting']) ? '&#10003;' : '' }}</span>
            <span class="opt-label">Join an Existing Political Party</span>
            @if(!empty($form['partyExisting']))
            <span class="value-line" style="display:inline-block; min-width:220px; margin-left:8px;">{{ !empty($partylistName) ? $partylistName : 'Existing Partylist' }}</span>
            @endif
        </div>

        <div class="opt-row">
            <span class="chk {{ !empty($form['partyCreate']) ? 'on' : '' }}">{{ !empty($form['partyCreate']) ? '&#10003;' : '' }}</span>
            <span class="opt-label">Create a New Political Party</span>
        </div>
        @if(!empty($form['partyCreate']))
        <table class="kv" style="margin-top:2px; width:80%; margin-left:15px;">
            <tr>
                <td class="k">Party Name:</td>
                <td class="v">{{ !empty($form['newPartyName']) ? $form['newPartyName'] : '&nbsp;' }}</td>
            </tr>
            @if(!empty($form['newPartyDescription']))
            <tr>
                <td class="k">Description:</td>
                <td class="v">{{ $form['newPartyDescription'] }}</td>
            </tr>
            @endif
        </table>
        @endif
    </div>

    {{-- Platform --}}
    <div class="plain-section">
        <div class="plain-title">Campaign Platform</div>
        @if(!empty($form['platform']))
        <div class="body-text">{{ $form['platform'] }}</div>
        @else
        <div class="empty">No platform provided.</div>
        @endif
    </div>

    {{-- Qualifications --}}
    <div class="plain-section">
        <div class="plain-title">Qualifications &amp; Achievements</div>
        @if(!empty($form['qualifications']))
        <div class="body-text">{{ $form['qualifications'] }}</div>
        @else
        <div class="empty">No qualifications provided.</div>
        @endif
    </div>

    {{-- Present affiliations --}}
    <div class="box">
        <div class="box-title">Present Affiliation</div>
        <table class="aff">
            <tr>
                <th class="num">&nbsp;</th>
                <th>Organization</th>
                <th>Position</th>
                <th>Date of Membership</th>
            </tr>
            @for($i = 1; $i <= 3; $i++)
                @php
                $org=$form["aff{$i}Org"] ?? '' ;
                $pos=$form["aff{$i}Pos"] ?? '' ;
                $date=$form["aff{$i}Date"] ?? '' ;
                @endphp
                <tr>
                <td class="num">{{ $i }}</td>
                <td>{{ $org  !== '' ? $org  : '&nbsp;' }}</td>
                <td>{{ $pos  !== '' ? $pos  : '&nbsp;' }}</td>
                <td>{{ $date !== '' ? $date : '&nbsp;' }}</td>
                </tr>
                @endfor
        </table>
    </div>

    {{-- Declaration --}}
    <div class="box declaration">
        <div class="box-title">Declaration</div>
        <div style="font-size:10.5px;">I further declare the following:</div>
        <ul>
            <li>I am a bona fide student of Opol Community College.</li>
            <li>I am willing to perform the duties and responsibilities of the position I am applying for.</li>
            <li>All information provided in this application is true and correct.</li>
        </ul>
    </div>

    {{-- Signed line --}}
    <div class="signed-line">
        Signed on this
        <span class="signed-blank">{{ !empty($form['signedDay']) ? $form['signedDay'] : '&nbsp;' }}</span>
        day of
        <span class="signed-blank" style="min-width:70px;">{{ !empty($form['signedMonth']) ? $form['signedMonth'] : '&nbsp;' }}</span>
        20<span class="signed-blank">{{ !empty($form['signedYear']) ? $form['signedYear'] : '&nbsp;' }}</span>
        at Opol Community College, Opol, Misamis Oriental.
    </div>

    {{-- Signature --}}
    <table class="sigblock">
        <tr>
            <td>&nbsp;</td>
            <td class="sig-right">
                @if(!empty($signature))
                <img class="sig-img" src="{{ $signature }}">
                @else
                <div class="sig-line"></div>
                @endif
                <div class="sig-caption">Signature of Applicant</div>
            </td>
        </tr>
    </table>

    {{-- Footer --}}
    <div class="footer">
        This is a system-generated document from the OCC Election System, generated {{ $generatedAt }}.<br>
        &copy; {{ date('Y') }} Opol Community College. All rights reserved.
    </div>

</body>

</html>