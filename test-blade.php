<?php
// test-blade.php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$form = [
    'schoolYear' => '2026-2027',
    'lastName' => 'Abayon', 'firstName' => 'Mae Ann', 'middleInitial' => '',
    'age' => '18', 'course' => 'BEED',
    'presentAddress' => 'Poblacion, Opol', 'presentAddress2' => '',
    'studentNo' => '2024-1-06462', 'currentYear' => '1',
    'noUnitLoad' => '18', 'cellphone' => '09171234567', 'socialMedia' => '',
    'positionCSG' => false, 'positionSC' => true, 'selectedPosition' => 'Governor',
    'department' => '',
    'partyIndependent' => true, 'partyExisting' => false, 'partyCreate' => false,
    'aff1Org' => '', 'aff1Pos' => '', 'aff1Date' => '',
    'aff2Org' => '', 'aff2Pos' => '', 'aff2Date' => '',
    'aff3Org' => '', 'aff3Pos' => '', 'aff3Date' => '',
    'signedDay' => '27', 'signedMonth' => 'September', 'signedYear' => '26',
    'platform' => 'Sample platform text.',
    'qualifications' => 'Sample qualifications.',
    'signature' => '',
];

/**
 * Renders only the given slice of the template and reports whether
 * dompdf crashes. Slices are labeled so we can bisect.
 */
$slices = [
    'letterhead'        => '<table class="letterhead"><tr><td class="id-cell"><table style="width:100%;"><tr><td style="width:44px;"><div class="seal">OCC</div></td><td class="id-text"><div class="country">Republic</div><div class="school">OCC</div><div class="place">Opol</div></td><td style="width:44px;"><div class="seal">CSG</div></td></tr></table></td><td class="app-cell"><div class="app-title">APPLICATION</div><div class="sy-row">SY <span class="sy-blank">&nbsp;</span></div></td></tr></table>',

    'top-block'         => '<table class="top-block"><tr><td class="details-col"><div>Name:</div><table class="namegrid"><tr><td><span class="value-line">&nbsp;</span></td><td><span class="value-line">&nbsp;</span></td><td><span class="value-line">&nbsp;</span></td></tr></table></td><td class="photo-col"><div class="photo-box">2 X 2</div></td></tr></table>',

    'kv-basic'          => '<table class="kv"><tr><td class="k">Age:</td><td class="v">&nbsp;</td></tr><tr><td class="k">Course:</td><td class="v">&nbsp;</td></tr></table>',

    'position-box'      => '<div class="box"><div class="box-title">Position</div><div class="opt-row"><span class="chk">&nbsp;</span><span class="opt-label">CSG</span></div><table class="kv"><tr><td class="k">Dept:</td><td class="v">&nbsp;</td></tr></table></div>',

    'party-box'         => '<div class="box"><div class="box-title">Party</div><div class="opt-row"><span class="chk">&nbsp;</span><span class="opt-label">Indep</span></div></div>',

    'platform-section'  => '<div class="plain-section"><div class="plain-title">Platform</div><div class="body-text">text</div></div>',

    'affiliation-table' => '<div class="box"><div class="box-title">Aff</div><table class="aff"><tr><th class="num">&nbsp;</th><th>Organization</th><th>Position</th><th>Date</th></tr><tr><td class="num">1</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table></div>',

    'declaration'       => '<div class="box declaration"><div class="box-title">Decl</div><ul><li>I declare.</li></ul></div>',

    'signature-table'   => '<table class="sigblock"><tr><td>&nbsp;</td><td class="sig-right"><div class="sig-line"></div><div class="sig-caption">Signature</div></td></tr></table>',
];

// Grab the CSS block from the real template so we test the real styling
$blade = file_get_contents(__DIR__ . '/resources/views/pdf/candidacy_platform.blade.php');
preg_match('#<style>(.*?)</style>#s', $blade, $m);
$css = $m[1] ?? '';

echo "Testing " . count($slices) . " slices...\n\n";

foreach ($slices as $name => $html) {
    $full = "<!DOCTYPE html><html><head><meta charset='UTF-8'><style>{$css}</style></head><body>{$html}</body></html>";

    // Write a temp blade-compiled view manually is overkill; use dompdf directly
    try {
        $dompdf = new \Dompdf\Dompdf();
        $dompdf->loadHtml($full);
        $dompdf->setPaper('letter', 'portrait');
        $dompdf->render();
        $bytes = strlen($dompdf->output());
        echo "  OK   {$name} ({$bytes} bytes)\n";
    } catch (\Throwable $e) {
        echo "  FAIL {$name}: {$e->getMessage()}\n";
    }
}