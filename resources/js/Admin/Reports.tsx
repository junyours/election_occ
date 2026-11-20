// resources/js/pages/Admin/Reports.tsx
import React, { useState, useEffect, useRef } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { adminAPI } from "../api/admin";
import { electionAPI } from "../api/elections";
import { useElections } from "../hooks/useElections";
import { RefreshButton } from "../components/common/RefreshButton";
import {
    Download,
    FileText,
    Users,
    Vote,
    TrendingUp,
    BarChart3,
    PieChart as PieChartIcon,
    Award,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    Printer,
    AlertCircle,
    FileJson,
    FileSpreadsheet,
    File,
    Eye,
    ChevronDown,
    ChevronUp,
    School,
    GraduationCap,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Election {
    election_id: number;
    title: string;
    election_type: string;
    voting_start: string;
    voting_end: string;
}

interface TurnoutReport {
    total_voters: number;
    voted_count: number;
    turnout_percentage: number;
    remaining_voters: number;
    breakdown_by_course: Array<{
        course: string;
        total: number;
        voted: number;
    }>;
    last_updated: string;
}

interface SanctionsList {
    total_eligible_voters: number;
    total_non_voters: number;
    non_voters_list: Array<{
        id_no: string;
        first_name: string;
        last_name: string;
        email: string;
        course: string;
        year_level: number;
    }>;
}

interface Results {
    election: Election;
    results: Record<
        string,
        Array<{
            candidate: {
                candidate_id: number;
                user?: { first_name: string; last_name: string };
                partylist?: { name: string };
            };
            votes: number;
        }>
    >;
}

const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
];

// ✅ Enhanced Print Styles - Clean and Professional
const printStyles = `
@media print {
    /* Hide all UI elements */
    .no-print {
        display: none !important;
    }
    
    /* Show print area */
    .print-area {
        display: block !important;
        padding: 10mm !important;
    }
    
    /* Page settings */
    @page {
        margin: 12mm;
        size: A4 portrait;
    }
    
    /* Body reset */
    body {
        background: white !important;
        font-family: 'Times New Roman', Times, serif !important;
    }
    
    /* ===== PRINT HEADER ===== */
    .print-header {
        display: flex !important;
        align-items: center !important;
        gap: 14px !important;
        margin-bottom: 14px !important;
        padding-bottom: 12px !important;
        border-bottom: 3px solid #1a1a1a !important;
    }
    
    .print-header-logo {
        width: 50px !important;
        height: 50px !important;
        border-radius: 50% !important;
        overflow: hidden !important;
        border: 2px solid #1a1a1a !important;
        flex-shrink: 0 !important;
    }
    
    .print-header-logo img {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
    }
    
    .print-header-text {
        flex: 1 !important;
    }
    
    .print-header-text h1 {
        font-size: 18px !important;
        font-weight: 700 !important;
        color: #1a1a1a !important;
        margin: 0 !important;
        letter-spacing: 0.5px !important;
    }
    
    .print-header-text .subtitle {
        font-size: 12px !important;
        color: #555 !important;
        margin: 2px 0 0 0 !important;
    }
    
    .print-header-text .meta {
        font-size: 10px !important;
        color: #888 !important;
        margin: 4px 0 0 0 !important;
    }
    
    /* ===== REPORT TITLE ===== */
    .print-report-title {
        text-align: center !important;
        margin-bottom: 16px !important;
    }
    
    .print-report-title h2 {
        font-size: 22px !important;
        font-weight: 700 !important;
        color: #1a1a1a !important;
        margin: 0 !important;
        letter-spacing: 1px !important;
    }
    
    .print-report-title .election-name {
        font-size: 14px !important;
        color: #444 !important;
        margin: 4px 0 0 0 !important;
    }
    
    .print-report-title .date-range {
        font-size: 11px !important;
        color: #888 !important;
        margin: 2px 0 0 0 !important;
    }
    
    /* ===== STATS CARDS ===== */
    .print-stats-grid {
        display: grid !important;
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 10px !important;
        margin: 14px 0 !important;
    }
    
    .print-stat-card {
        border: 1px solid #ddd !important;
        border-radius: 6px !important;
        padding: 10px !important;
        text-align: center !important;
        background: #fafafa !important;
    }
    
    .print-stat-card .label {
        font-size: 9px !important;
        color: #666 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
        font-weight: 600 !important;
    }
    
    .print-stat-card .value {
        font-size: 22px !important;
        font-weight: 700 !important;
        color: #1a1a1a !important;
        margin-top: 2px !important;
    }
    
    .print-stat-card .value.green { color: #0d7c3f !important; }
    .print-stat-card .value.blue { color: #1a56db !important; }
    .print-stat-card .value.orange { color: #b45309 !important; }
    .print-stat-card .value.purple { color: #6b21a5 !important; }
    .print-stat-card .value.red { color: #b91c1c !important; }
    
    /* ===== SECTION TITLE ===== */
    .print-section-title {
        font-size: 14px !important;
        font-weight: 700 !important;
        color: #1a1a1a !important;
        margin: 16px 0 8px 0 !important;
        padding-bottom: 4px !important;
        border-bottom: 2px solid #1a1a1a !important;
    }
    
    .print-sub-section-title {
        font-size: 12px !important;
        font-weight: 600 !important;
        color: #333 !important;
        margin: 12px 0 6px 0 !important;
    }
    
    /* ===== TABLE STYLES ===== */
    .print-table-container {
        margin: 8px 0 12px 0 !important;
    }
    
    .print-table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 10px !important;
    }
    
    .print-table th {
        background: #f0f0f0 !important;
        border: 1px solid #ccc !important;
        padding: 6px 8px !important;
        text-align: left !important;
        font-weight: 700 !important;
        font-size: 9px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.3px !important;
    }
    
    .print-table td {
        border: 1px solid #ccc !important;
        padding: 5px 8px !important;
        font-size: 10px !important;
    }
    
    .print-table tr:nth-child(even) {
        background: #f9f9f9 !important;
    }
    
    .print-table .total-row {
        background: #e8e8e8 !important;
        font-weight: 700 !important;
    }
    
    /* ===== WINNER BADGE ===== */
    .print-winner-badge {
        display: inline-block !important;
        background: #d1fae5 !important;
        color: #065f46 !important;
        padding: 1px 10px !important;
        border-radius: 9999px !important;
        font-size: 8px !important;
        font-weight: 700 !important;
        letter-spacing: 0.3px !important;
    }
    
    .print-status-badge {
        display: inline-block !important;
        padding: 1px 10px !important;
        border-radius: 9999px !important;
        font-size: 8px !important;
        font-weight: 700 !important;
    }
    .print-status-badge.success { background: #d1fae5 !important; color: #065f46 !important; }
    .print-status-badge.warning { background: #fef3c7 !important; color: #92400e !important; }
    .print-status-badge.danger { background: #fee2e2 !important; color: #991b1b !important; }
    .print-status-badge.info { background: #dbeafe !important; color: #1e40af !important; }
    
    /* ===== PROGRESS BAR ===== */
    .print-progress-bar {
        width: 100% !important;
        height: 6px !important;
        background: #e5e7eb !important;
        border-radius: 999px !important;
        overflow: hidden !important;
        margin-top: 2px !important;
    }
    
    .print-progress-bar .fill {
        height: 100% !important;
        border-radius: 999px !important;
    }
    .print-progress-bar .fill.blue { background: #3b82f6 !important; }
    .print-progress-bar .fill.green { background: #10b981 !important; }
    
    /* ===== RESULTS TABLE ===== */
    .print-results-table td:last-child {
        text-align: center !important;
    }
    
    /* ===== FOOTER ===== */
    .print-footer {
        text-align: center !important;
        font-size: 8px !important;
        color: #999 !important;
        border-top: 1px solid #ddd !important;
        padding-top: 8px !important;
        margin-top: 16px !important;
    }
    
    /* ===== PAGE BREAK ===== */
    .print-page-break {
        page-break-before: always !important;
    }
    
    /* ===== HIDE CHART TOOLTIPS ===== */
    .recharts-tooltip-wrapper {
        display: none !important;
    }
    
    /* ===== CHART CONTAINERS ===== */
    .print-chart-container {
        width: 100% !important;
        height: 180px !important;
        margin: 6px 0 !important;
    }
    
    /* ===== RESPONSIVE GRID FOR CHARTS ===== */
    .print-chart-grid {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 16px !important;
        margin: 10px 0 !important;
    }
}
`;

// ============================================================
// ✅ Professional Print Report Builders
// Each builder returns an HTML string that is placed inside the
// print window created by handlePrint().
// ============================================================
type ReportTab = "turnout" | "results" | "sanctions";

const REPORT_META: Record<
    ReportTab,
    { title: string; code: string; confidential: boolean }
> = {
    turnout: {
        title: "Voter Turnout Report",
        code: "TURNOUT",
        confidential: false,
    },
    results: {
        title: "Election Results Report",
        code: "RESULTS",
        confidential: false,
    },
    sanctions: {
        title: "Non-Voters (Sanctions) Report",
        code: "SANCTIONS",
        confidential: true,
    },
};

const OCC_LOGO_DATA_URI =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%231e3a8a' width='100' height='100'/%3E%3Ctext x='50' y='57' font-family='Arial' font-size='28' font-weight='bold' fill='white' text-anchor='middle'%3EOCC%3C/text%3E%3C/svg%3E";

// ---------- small formatting helpers ----------
const esc = (value: unknown): string =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const fmtNum = (n: number | null | undefined): string =>
    (Number(n) || 0).toLocaleString("en-US");

const pctNum = (part: number, whole: number): number =>
    whole > 0 ? (part / whole) * 100 : 0;

const fmtPct = (part: number, whole: number, digits = 1): string =>
    `${pctNum(part, whole).toFixed(digits)}%`;

const truncate = (text: string, max: number): string =>
    text.length > max ? `${text.slice(0, max - 1)}…` : text;

const fmtDate = (
    value?: string | Date | null,
    withTime = false,
): string => {
    if (!value) return "—";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(
        "en-US",
        withTime
            ? {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
              }
            : { year: "numeric", month: "long", day: "numeric" },
    );
};

const candidateName = (c?: {
    user?: { first_name: string; last_name: string };
}): string =>
    `${c?.user?.first_name || ""} ${c?.user?.last_name || ""}`.trim() ||
    "Unknown Candidate";

function countBy<T>(
    items: T[],
    keyFn: (item: T) => string,
): Array<[string, number]> {
    const map = new Map<string, number>();
    items.forEach((item) => {
        const key = keyFn(item);
        map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
}

// ---------- reusable HTML fragments ----------
const section = (num: number, title: string, body: string): string =>
    `<section class="section"><h2><span class="sec-no">${num}.</span> ${esc(title)}</h2>${body}</section>`;

const statCard = (
    label: string,
    value: string,
    sub: string,
    tone: string,
): string => `
    <div class="stat ${tone}">
        <div class="stat-label">${esc(label)}</div>
        <div class="stat-value">${esc(value)}</div>
        <div class="stat-sub">${esc(sub)}</div>
    </div>`;

const barCell = (value: number, tone = ""): string => {
    const width = Math.max(0, Math.min(100, value)).toFixed(1);
    return `<div class="cell-bar"><span class="t">${value.toFixed(1)}%</span><div class="bar ${tone}"><span style="width:${width}%"></span></div></div>`;
};

// ---------- inline SVG charts (print safely, no JS needed) ----------
const buildDonutSvg = (voted: number, total: number): string => {
    const size = 160;
    const c = size / 2;
    const r = 56;
    const stroke = 22;
    const circ = 2 * Math.PI * r;
    const ratio = total > 0 ? Math.min(voted / total, 1) : 0;
    const votedLen = circ * ratio;
    return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Voter participation">
        <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="${stroke}"/>
        <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#15803d" stroke-width="${stroke}"
            stroke-dasharray="${votedLen.toFixed(2)} ${(circ - votedLen).toFixed(2)}"
            transform="rotate(-90 ${c} ${c})"/>
        <text x="${c}" y="${c + 2}" text-anchor="middle" font-size="24" font-weight="700" fill="#111827" font-family="Georgia, serif">${(ratio * 100).toFixed(1)}%</text>
        <text x="${c}" y="${c + 18}" text-anchor="middle" font-size="8" letter-spacing="1" fill="#6b7280">TURNOUT</text>
    </svg>`;
};

const buildCourseBarSvg = (
    rows: Array<{ label: string; rate: number; voted: number; total: number }>,
    average: number,
): string => {
    const width = 700;
    const labelW = 175;
    const rightPad = 120;
    const rowH = 24;
    const top = 22;
    const bottom = 24;
    const barW = width - labelW - rightPad;
    const height = top + rows.length * rowH + bottom;
    const xAt = (p: number) =>
        labelW + (Math.max(0, Math.min(100, p)) / 100) * barW;

    const grid = [0, 25, 50, 75, 100]
        .map(
            (tick) =>
                `<line x1="${xAt(tick)}" y1="${top - 6}" x2="${xAt(tick)}" y2="${height - bottom}" stroke="#e5e7eb" stroke-width="1"/>
                 <text x="${xAt(tick)}" y="${height - 8}" text-anchor="middle" font-size="8" fill="#6b7280">${tick}%</text>`,
        )
        .join("");

    const bars = rows
        .map((r, i) => {
            const y = top + i * rowH;
            const color = r.rate >= average ? "#1d4ed8" : "#d97706";
            return `
            <text x="${labelW - 8}" y="${y + 14}" text-anchor="end" font-size="9.5" fill="#111827">${esc(truncate(r.label, 30))}</text>
            <rect x="${labelW}" y="${y + 3}" width="${barW}" height="15" rx="2" fill="#f3f4f6"/>
            <rect x="${labelW}" y="${y + 3}" width="${Math.max(xAt(r.rate) - labelW, 0)}" height="15" rx="2" fill="${color}"/>
            <text x="${labelW + barW + 8}" y="${y + 14}" font-size="9" fill="#111827"><tspan font-weight="700">${r.rate.toFixed(1)}%</tspan><tspan fill="#6b7280"> (${fmtNum(r.voted)}/${fmtNum(r.total)})</tspan></text>`;
        })
        .join("");

    const avg = `
        <line x1="${xAt(average)}" y1="${top - 8}" x2="${xAt(average)}" y2="${height - bottom}" stroke="#b91c1c" stroke-width="1.2" stroke-dasharray="4 3"/>
        <text x="${xAt(average)}" y="${top - 11}" text-anchor="middle" font-size="8" font-weight="700" fill="#b91c1c">Overall ${average.toFixed(1)}%</text>`;

    return `<svg width="100%" viewBox="0 0 ${width} ${height}" style="max-width:100%;height:auto" role="img" aria-label="Turnout by course">${grid}${bars}${avg}</svg>`;
};

// ============================================================
// TURNOUT REPORT
// ============================================================
const buildTurnoutContent = (t: TurnoutReport): string => {
    const total = Number(t.total_voters) || 0;
    const voted = Number(t.voted_count) || 0;
    const remaining = Math.max(total - voted, 0);
    const rate = pctNum(voted, total);

    const courses = (t.breakdown_by_course || [])
        .map((c) => {
            const cTotal = Number(c.total) || 0;
            const cVoted = Number(c.voted) || 0;
            return {
                course: c.course || "No Course",
                total: cTotal,
                voted: cVoted,
                notVoted: Math.max(cTotal - cVoted, 0),
                rate: pctNum(cVoted, cTotal),
                share: pctNum(cVoted, voted),
            };
        })
        .sort((a, b) => b.rate - a.rate || b.total - a.total);

    const ranked = courses.filter((c) => c.total > 0);
    const highest = ranked[0];
    const lowest = ranked[ranked.length - 1];
    const belowAvg = ranked.filter((c) => c.rate < rate);
    const noVotes = ranked.filter((c) => c.voted === 0);
    const biggest = [...courses].sort((a, b) => b.voted - a.voted)[0];

    // ----- Executive summary -----
    const findings: string[] = [];
    if (highest && lowest && highest !== lowest) {
        findings.push(
            `Highest turnout: <strong>${esc(highest.course)}</strong> at ${highest.rate.toFixed(1)}% (${fmtNum(highest.voted)} of ${fmtNum(highest.total)} voters).`,
        );
        findings.push(
            `Lowest turnout: <strong>${esc(lowest.course)}</strong> at ${lowest.rate.toFixed(1)}% (${fmtNum(lowest.voted)} of ${fmtNum(lowest.total)} voters).`,
        );
    } else if (highest) {
        findings.push(
            `Only one course is represented: <strong>${esc(highest.course)}</strong> at ${highest.rate.toFixed(1)}%.`,
        );
    }
    if (ranked.length > 0) {
        findings.push(
            `${belowAvg.length} of ${ranked.length} course(s) recorded turnout below the overall rate of ${rate.toFixed(1)}%.`,
        );
    }
    if (noVotes.length > 0) {
        findings.push(
            `No votes were recorded for: <strong>${noVotes.map((c) => esc(c.course)).join(", ")}</strong>.`,
        );
    }
    if (biggest && biggest.voted > 0) {
        findings.push(
            `<strong>${esc(biggest.course)}</strong> contributed the most votes (${fmtNum(biggest.voted)}, or ${biggest.share.toFixed(1)}% of all votes cast).`,
        );
    }

    const summary = `
        <div class="summary">
            A total of <strong>${fmtNum(voted)}</strong> out of
            <strong>${fmtNum(total)}</strong> registered voters
            (<strong>${rate.toFixed(1)}%</strong>) cast their votes in this election,
            while <strong>${fmtNum(remaining)}</strong>
            (${(total > 0 ? 100 - rate : 0).toFixed(1)}%) did not vote.
        </div>
        ${
            findings.length
                ? `<ul class="findings">${findings.map((f) => `<li>${f}</li>`).join("")}</ul>`
                : ""
        }`;

    // ----- Key metrics -----
    const metrics = `
        <div class="stats">
            ${statCard("Registered Voters", fmtNum(total), "Eligible to vote", "blue")}
            ${statCard("Votes Cast", fmtNum(voted), "Ballots submitted", "green")}
            ${statCard("Turnout Rate", `${rate.toFixed(1)}%`, "Votes cast ÷ registered", "purple")}
            ${statCard("Did Not Vote", fmtNum(remaining), fmtPct(remaining, total) + " of registered", "orange")}
        </div>
        <div class="chart-row">
            <div class="donut">${buildDonutSvg(voted, total)}</div>
            <div class="legend-table">
                <table class="data compact">
                    <thead><tr><th>Participation</th><th class="r">Voters</th><th class="r">Share</th></tr></thead>
                    <tbody>
                        <tr><td><span class="dot" style="background:#15803d"></span>Voted</td><td class="r">${fmtNum(voted)}</td><td class="r">${fmtPct(voted, total)}</td></tr>
                        <tr><td><span class="dot" style="background:#e5e7eb;border:1px solid #9ca3af"></span>Did not vote</td><td class="r">${fmtNum(remaining)}</td><td class="r">${fmtPct(remaining, total)}</td></tr>
                    </tbody>
                    <tfoot><tr><td>Total registered</td><td class="r">${fmtNum(total)}</td><td class="r">100.0%</td></tr></tfoot>
                </table>
            </div>
        </div>`;

    // ----- Chart by course -----
    let chartHtml = `<p class="muted">No course breakdown is available.</p>`;
    if (courses.length > 0) {
        const MAX_CHART_ROWS = 18;
        const chartRows = (
            courses.length > MAX_CHART_ROWS
                ? [...courses]
                      .sort((a, b) => b.total - a.total)
                      .slice(0, MAX_CHART_ROWS)
                      .sort((a, b) => b.rate - a.rate)
                : courses
        ).map((c) => ({
            label: c.course,
            rate: c.rate,
            voted: c.voted,
            total: c.total,
        }));
        chartHtml = `
            <div class="chart-box">${buildCourseBarSvg(chartRows, rate)}</div>
            <div class="legend">
                <span><span class="dot" style="background:#1d4ed8"></span>At or above overall turnout</span>
                <span><span class="dot" style="background:#d97706"></span>Below overall turnout</span>
                <span><span class="dash"></span>Overall turnout</span>
            </div>
            ${
                courses.length > MAX_CHART_ROWS
                    ? `<p class="note">Chart shows the ${MAX_CHART_ROWS} courses with the most registered voters. All courses are listed in the table below.</p>`
                    : ""
            }`;
    }

    // ----- Detailed table -----
    const tableHtml =
        courses.length > 0
            ? `
        <table class="data">
            <thead>
                <tr>
                    <th class="c" style="width:34px">Rank</th>
                    <th>Course / Program</th>
                    <th class="r">Registered</th>
                    <th class="r">Voted</th>
                    <th class="r">Not Voted</th>
                    <th style="width:120px">Turnout</th>
                    <th class="r">vs. Overall</th>
                    <th class="r">Share of Votes</th>
                </tr>
            </thead>
            <tbody>
                ${courses
                    .map((c, i) => {
                        const diff = c.rate - rate;
                        const diffCls =
                            c.total === 0
                                ? ""
                                : diff >= 0
                                  ? "pos"
                                  : "neg";
                        const diffTxt =
                            c.total === 0
                                ? "—"
                                : `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)} pp`;
                        return `
                    <tr>
                        <td class="c">${i + 1}</td>
                        <td><strong>${esc(c.course)}</strong></td>
                        <td class="r">${fmtNum(c.total)}</td>
                        <td class="r">${fmtNum(c.voted)}</td>
                        <td class="r">${fmtNum(c.notVoted)}</td>
                        <td>${barCell(c.rate)}</td>
                        <td class="r ${diffCls}">${diffTxt}</td>
                        <td class="r">${c.share.toFixed(1)}%</td>
                    </tr>`;
                    })
                    .join("")}
            </tbody>
            <tfoot>
                <tr>
                    <td></td>
                    <td>TOTAL</td>
                    <td class="r">${fmtNum(total)}</td>
                    <td class="r">${fmtNum(voted)}</td>
                    <td class="r">${fmtNum(remaining)}</td>
                    <td>${rate.toFixed(1)}%</td>
                    <td class="r">—</td>
                    <td class="r">100.0%</td>
                </tr>
            </tfoot>
        </table>`
            : `<p class="muted">No course breakdown is available.</p>`;

    const notes = `
        <ul class="notes">
            <li><strong>Turnout</strong> = votes cast ÷ registered voters × 100.</li>
            <li><strong>vs. Overall</strong> = difference between a course's turnout and the overall turnout, in percentage points (pp).</li>
            <li><strong>Share of Votes</strong> = a course's votes ÷ total votes cast in the election.</li>
            <li>Courses are ranked from highest to lowest turnout.</li>
        </ul>`;

    return [
        section(1, "Executive Summary", summary),
        section(2, "Key Metrics", metrics),
        section(3, "Turnout by Course", chartHtml),
        section(4, "Detailed Turnout Breakdown", tableHtml),
        section(5, "Notes", notes),
    ].join("");
};

// ============================================================
// RESULTS REPORT
// ============================================================
const buildResultsContent = (
    res: Results,
    turnout: TurnoutReport | null,
): string => {
    const votesOf = (c: { votes: number }) => Number(c.votes) || 0;

    const positions = Object.entries(res.results || {}).map(
        ([position, cands]) => {
            const sorted = [...(cands || [])].sort(
                (a, b) => votesOf(b) - votesOf(a),
            );
            const totalVotes = sorted.reduce((s, c) => s + votesOf(c), 0);
            const top = sorted.length ? votesOf(sorted[0]) : 0;
            const winners = top > 0 ? sorted.filter((c) => votesOf(c) === top) : [];
            const runnerUp = sorted.find((c) => votesOf(c) < top);
            const isTie = winners.length > 1;
            const margin = isTie
                ? 0
                : top > 0
                  ? top - (runnerUp ? votesOf(runnerUp) : 0)
                  : 0;
            return {
                position,
                sorted,
                totalVotes,
                top,
                winners,
                isTie,
                margin,
                unopposed: sorted.length === 1,
            };
        },
    );

    const totalCandidates = positions.reduce((s, p) => s + p.sorted.length, 0);
    const totalVotesCounted = positions.reduce((s, p) => s + p.totalVotes, 0);
    const tiedPositions = positions.filter((p) => p.isTie);
    const noVotePositions = positions.filter((p) => p.top === 0);

    const tVoters = Number(turnout?.total_voters) || 0;
    const tVoted = Number(turnout?.voted_count) || 0;

    // ----- Executive summary -----
    const sentences: string[] = [
        `This report presents the tally of votes for <strong>${positions.length}</strong> position(s) contested by <strong>${fmtNum(totalCandidates)}</strong> candidate(s).`,
    ];
    if (turnout && tVoters > 0) {
        sentences.push(
            `Voter turnout was <strong>${fmtPct(tVoted, tVoters)}</strong> (${fmtNum(tVoted)} of ${fmtNum(tVoters)} registered voters).`,
        );
    }
    if (tiedPositions.length > 0) {
        sentences.push(
            `<strong>${tiedPositions.length}</strong> position(s) ended in a tie and require resolution by the Election Committee: ${tiedPositions.map((p) => esc(p.position)).join(", ")}.`,
        );
    }
    if (noVotePositions.length > 0) {
        sentences.push(
            `No votes were recorded for: ${noVotePositions.map((p) => esc(p.position)).join(", ")}.`,
        );
    }

    const summary = `<div class="summary">${sentences.join(" ")}</div>`;

    const metrics = `
        <div class="stats">
            ${statCard("Positions", fmtNum(positions.length), "Contested", "blue")}
            ${statCard("Candidates", fmtNum(totalCandidates), "Across all positions", "purple")}
            ${statCard("Votes Counted", fmtNum(totalVotesCounted), "All positions combined", "green")}
            ${statCard("Voter Turnout", turnout && tVoters > 0 ? fmtPct(tVoted, tVoters) : "—", turnout && tVoters > 0 ? `${fmtNum(tVoted)} of ${fmtNum(tVoters)} voters` : "Not available", "orange")}
        </div>`;

    // ----- Winners summary -----
    const winnersTable = `
        <table class="data">
            <thead>
                <tr>
                    <th>Position</th>
                    <th>Winner</th>
                    <th>Partylist</th>
                    <th class="r">Votes</th>
                    <th class="r">Share</th>
                    <th class="r">Margin</th>
                </tr>
            </thead>
            <tbody>
                ${positions
                    .map((p) => {
                        if (p.top === 0) {
                            return `<tr><td><strong>${esc(p.position)}</strong></td><td colspan="5" class="muted">No votes recorded</td></tr>`;
                        }
                        const names = p.winners
                            .map((w) => esc(candidateName(w.candidate)))
                            .join(" / ");
                        const parties = p.winners
                            .map((w) => esc(w.candidate?.partylist?.name || "Independent"))
                            .join(" / ");
                        const marginTxt = p.isTie
                            ? "Tie"
                            : p.unopposed
                              ? "Unopposed"
                              : `${fmtNum(p.margin)} vote(s)`;
                        return `
                    <tr class="${p.isTie ? "tie" : "winner"}">
                        <td><strong>${esc(p.position)}</strong></td>
                        <td>${names}${p.isTie ? ' <span class="badge tie">TIE</span>' : ""}</td>
                        <td>${parties}</td>
                        <td class="r">${fmtNum(p.top)}</td>
                        <td class="r">${fmtPct(p.top, p.totalVotes)}</td>
                        <td class="r">${marginTxt}</td>
                    </tr>`;
                    })
                    .join("")}
            </tbody>
        </table>`;

    // ----- Detailed results by position -----
    const detailed = positions
        .map((p) => {
            const rowsHtml = p.sorted
                .map((c) => {
                    const v = votesOf(c);
                    const rank =
                        p.sorted.findIndex((x) => votesOf(x) === v) + 1;
                    const isWinner = p.top > 0 && v === p.top;
                    const status = isWinner
                        ? p.isTie
                            ? '<span class="badge tie">TIED</span>'
                            : '<span class="badge win">WINNER</span>'
                        : "";
                    return `
                    <tr class="${isWinner ? (p.isTie ? "tie" : "winner") : ""}">
                        <td class="c">${rank}</td>
                        <td><strong>${esc(candidateName(c.candidate))}</strong></td>
                        <td>${esc(c.candidate?.partylist?.name || "Independent")}</td>
                        <td class="r">${fmtNum(v)}</td>
                        <td>${barCell(pctNum(v, p.totalVotes), isWinner ? "green" : "")}</td>
                        <td class="c">${status}</td>
                    </tr>`;
                })
                .join("");
            return `
            <div class="position-block">
                <div class="pos-head">
                    <span>${esc(p.position)}</span>
                    <small>${fmtNum(p.sorted.length)} candidate(s) &nbsp;•&nbsp; ${fmtNum(p.totalVotes)} vote(s) counted</small>
                </div>
                <table class="data">
                    <thead>
                        <tr>
                            <th class="c" style="width:34px">Rank</th>
                            <th>Candidate</th>
                            <th>Partylist</th>
                            <th class="r">Votes</th>
                            <th style="width:130px">Share of Votes</th>
                            <th class="c" style="width:70px">Status</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml || '<tr><td colspan="6" class="muted c">No candidates</td></tr>'}</tbody>
                </table>
            </div>`;
        })
        .join("");

    const notes = `
        <ul class="notes">
            <li><strong>Share of Votes</strong> = a candidate's votes ÷ total votes counted for that position.</li>
            <li><strong>Winner</strong> = candidate with the highest number of votes in a position. Ties are flagged for resolution by the Election Committee.</li>
            <li><strong>Margin</strong> = vote difference between the winner and the runner-up.</li>
            <li>Candidates are ranked by votes received; tied candidates share the same rank.</li>
        </ul>`;

    return [
        section(1, "Executive Summary", summary + metrics),
        section(2, "Summary of Winners", winnersTable),
        section(3, "Detailed Results by Position", detailed),
        section(4, "Notes", notes),
    ].join("");
};

// ============================================================
// SANCTIONS REPORT
// ============================================================
const buildSanctionsContent = (s: SanctionsList): string => {
    const list = [...(s.non_voters_list || [])].sort(
        (a, b) =>
            (a.course || "").localeCompare(b.course || "") ||
            (Number(a.year_level) || 0) - (Number(b.year_level) || 0) ||
            (a.last_name || "").localeCompare(b.last_name || "") ||
            (a.first_name || "").localeCompare(b.first_name || ""),
    );

    const eligible = Number(s.total_eligible_voters) || 0;
    const nonVoters = Number(s.total_non_voters ?? list.length) || 0;
    const voters = Math.max(eligible - nonVoters, 0);

    const byCourse = countBy(list, (v) => v.course || "No Course");
    const byYear = countBy(list, (v) =>
        v.year_level ? `Year ${v.year_level}` : "Not specified",
    ).sort((a, b) => {
        const na = parseInt(a[0].replace(/\D/g, ""), 10);
        const nb = parseInt(b[0].replace(/\D/g, ""), 10);
        return (Number.isNaN(na) ? 99 : na) - (Number.isNaN(nb) ? 99 : nb);
    });

    // ----- Executive summary -----
    let summary: string;
    if (nonVoters === 0) {
        summary = `<div class="summary success">All <strong>${fmtNum(eligible)}</strong> eligible voters cast their votes. There are no non-voters to be reported.</div>`;
    } else {
        const topCourse = byCourse[0];
        summary = `
        <div class="summary">
            Of <strong>${fmtNum(eligible)}</strong> eligible voters,
            <strong>${fmtNum(nonVoters)}</strong> (${fmtPct(nonVoters, eligible)})
            did not vote and are listed in this report for the appropriate sanctions.
            ${
                topCourse
                    ? `The largest number of non-voters belongs to <strong>${esc(topCourse[0])}</strong> (${fmtNum(topCourse[1])}, or ${fmtPct(topCourse[1], list.length)} of the list).`
                    : ""
            }
        </div>`;
    }

    const metrics = `
        <div class="stats">
            ${statCard("Eligible Voters", fmtNum(eligible), "Registered in the system", "blue")}
            ${statCard("Voted", fmtNum(voters), fmtPct(voters, eligible) + " compliance", "green")}
            ${statCard("Non-Voters", fmtNum(nonVoters), "Subject to sanctions", "red")}
            ${statCard("Non-Voter Rate", fmtPct(nonVoters, eligible), "Non-voters ÷ eligible", "orange")}
        </div>`;

    const groupTable = (
        title: string,
        rows: Array<[string, number]>,
    ): string => `
        <div>
            <div class="sub-title">${esc(title)}</div>
            <table class="data compact">
                <thead><tr><th>${esc(title.replace("Non-Voters by ", ""))}</th><th class="r">Count</th><th style="width:110px">Share</th></tr></thead>
                <tbody>
                    ${rows
                        .map(
                            ([label, count]) =>
                                `<tr><td>${esc(label)}</td><td class="r">${fmtNum(count)}</td><td>${barCell(pctNum(count, list.length), "red")}</td></tr>`,
                        )
                        .join("")}
                </tbody>
                <tfoot><tr><td>Total</td><td class="r">${fmtNum(list.length)}</td><td>100.0%</td></tr></tfoot>
            </table>
        </div>`;

    const distribution =
        list.length > 0
            ? `<div class="two-col">${groupTable("Non-Voters by Course", byCourse)}${groupTable("Non-Voters by Year Level", byYear)}</div>`
            : `<p class="muted">No non-voters to summarize.</p>`;

    // ----- Full list -----
    const mismatch =
        list.length !== nonVoters
            ? `<p class="note">Note: this list contains ${fmtNum(list.length)} of ${fmtNum(nonVoters)} recorded non-voters.</p>`
            : "";

    const listTable =
        list.length > 0
            ? `
        <table class="data">
            <thead>
                <tr>
                    <th class="c" style="width:30px">No.</th>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Course</th>
                    <th class="c">Year</th>
                    <th>Email</th>
                </tr>
            </thead>
            <tbody>
                ${list
                    .map(
                        (v, i) => `
                    <tr>
                        <td class="c">${i + 1}</td>
                        <td class="mono">${esc(v.id_no || "—")}</td>
                        <td><strong>${esc((v.last_name || "").toUpperCase())}</strong>, ${esc(v.first_name || "")}</td>
                        <td>${esc(v.course || "—")}</td>
                        <td class="c">${v.year_level ? esc(v.year_level) : "—"}</td>
                        <td>${esc(v.email || "—")}</td>
                    </tr>`,
                    )
                    .join("")}
            </tbody>
        </table>${mismatch}`
            : `<div class="summary success">No non-voters found. Everyone voted.</div>`;

    const notes = `
        <ul class="notes">
            <li>A <strong>non-voter</strong> is a registered, eligible voter with no vote recorded for this election.</li>
            <li>The list is sorted by course, year level, then surname.</li>
            <li>Names on this list are subject to verification and approval by the proper authority before any sanction is imposed.</li>
        </ul>`;

    return [
        section(1, "Executive Summary", summary + metrics),
        section(2, "Distribution of Non-Voters", distribution),
        section(3, "List of Non-Voters", listTable),
        section(4, "Notes", notes),
    ].join("");
};

// ============================================================
// DOCUMENT SHELL (letterhead, details, signatures, footer, CSS)
// ============================================================
const buildPrintCss = (ref: string): string => `
    @page {
        size: A4 portrait;
        margin: 16mm 14mm 18mm 14mm;
        @bottom-left {
            content: "OCC Election System  |  ${ref}";
            font-family: Arial, sans-serif; font-size: 7.5pt; color: #6b7280;
        }
        @bottom-right {
            content: "Page " counter(page) " of " counter(pages);
            font-family: Arial, sans-serif; font-size: 7.5pt; color: #6b7280;
        }
    }
    :root { --ink:#111827; --muted:#6b7280; --line:#d1d5db; --brand:#1e3a8a; --soft:#f3f4f6; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        font-size: 10pt; line-height: 1.45; color: var(--ink); background: #fff;
        padding: 12mm;
    }
    @media print { body { padding: 0; } }

    /* Letterhead */
    .letterhead { display: flex; align-items: center; gap: 14px; padding-bottom: 10px; border-bottom: 4px double var(--brand); }
    .letterhead .logo { width: 58px; height: 58px; border-radius: 50%; overflow: hidden; border: 2px solid var(--brand); flex-shrink: 0; }
    .letterhead .logo img { width: 100%; height: 100%; display: block; }
    .letterhead .org { flex: 1; }
    .letterhead .org h1 { font-family: Georgia, "Times New Roman", serif; font-size: 18pt; color: var(--brand); letter-spacing: .4px; line-height: 1.1; }
    .letterhead .org .sub { font-size: 9.5pt; color: #374151; margin-top: 2px; }
    .letterhead .ref { text-align: right; font-size: 8pt; color: var(--muted); line-height: 1.5; }
    .letterhead .ref strong { color: var(--ink); }

    /* Title */
    .title-block { text-align: center; margin: 16px 0 12px; }
    .eyebrow { font-size: 8pt; letter-spacing: 3px; color: var(--muted); font-weight: 600; }
    .title-block h2 { font-family: Georgia, "Times New Roman", serif; font-size: 21pt; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
    .title-block .election-name { font-size: 12.5pt; color: #1f2937; margin-top: 3px; font-weight: 600; }
    .title-block .rule { width: 90px; height: 3px; background: var(--brand); margin: 8px auto 0; }

    .banner { border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; padding: 5px 10px; font-size: 8.5pt; font-weight: 600; text-align: center; margin-bottom: 10px; }

    /* Details table */
    table.meta { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 4px; }
    table.meta td { border: 1px solid var(--line); padding: 4px 8px; vertical-align: top; width: 16.66%; }
    table.meta td.k { background: var(--soft); color: #374151; font-weight: 700; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .5px; }

    /* Sections */
    .section { margin-top: 16px; }
    .section h2 { font-family: Georgia, "Times New Roman", serif; font-size: 12pt; color: var(--brand); border-bottom: 1px solid var(--line); padding-bottom: 3px; margin-bottom: 9px; break-after: avoid; }
    .section h2 .sec-no { display: inline-block; min-width: 18px; }
    .sub-title { font-weight: 700; font-size: 9.5pt; margin-bottom: 4px; }

    .summary { border-left: 4px solid var(--brand); background: #f8fafc; padding: 8px 12px; text-align: justify; margin-bottom: 8px; }
    .summary.success { border-left-color: #15803d; background: #f0fdf4; }
    ul.findings, ul.notes { margin: 6px 0 0 18px; }
    ul.findings li, ul.notes li { margin-bottom: 3px; }
    ul.notes { font-size: 8.5pt; color: #374151; }
    .muted { color: var(--muted); }
    .note { font-size: 8pt; color: var(--muted); margin-top: 5px; font-style: italic; }

    /* Stat cards */
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0; }
    .stat { border: 1px solid var(--line); border-left: 4px solid var(--brand); background: #fafafa; padding: 7px 9px; break-inside: avoid; }
    .stat-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); font-weight: 700; }
    .stat-value { font-family: Georgia, serif; font-size: 18pt; font-weight: 700; line-height: 1.15; }
    .stat-sub { font-size: 7.5pt; color: var(--muted); }
    .stat.blue { border-left-color: #1d4ed8; } .stat.blue .stat-value { color: #1d4ed8; }
    .stat.green { border-left-color: #15803d; } .stat.green .stat-value { color: #15803d; }
    .stat.purple { border-left-color: #7e22ce; } .stat.purple .stat-value { color: #7e22ce; }
    .stat.orange { border-left-color: #b45309; } .stat.orange .stat-value { color: #b45309; }
    .stat.red { border-left-color: #b91c1c; } .stat.red .stat-value { color: #b91c1c; }

    /* Charts */
    .chart-row { display: grid; grid-template-columns: 170px 1fr; gap: 16px; align-items: center; margin-top: 8px; break-inside: avoid; }
    .donut { text-align: center; }
    .chart-box { border: 1px solid var(--line); padding: 8px; break-inside: avoid; }
    .legend { display: flex; gap: 16px; font-size: 8pt; color: #374151; margin-top: 5px; }
    .dot { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }
    .dash { display: inline-block; width: 14px; border-top: 2px dashed #b91c1c; margin-right: 5px; vertical-align: middle; }

    /* Data tables */
    table.data { width: 100%; border-collapse: collapse; font-size: 9pt; }
    table.data.compact { font-size: 8.5pt; }
    table.data th { background: var(--brand); color: #fff; padding: 5px 7px; text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .4px; }
    table.data td { padding: 4px 7px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
    table.data tbody tr:nth-child(even) td { background: #f9fafb; }
    table.data thead { display: table-header-group; }
    table.data tr { break-inside: avoid; }
    table.data tfoot td { font-weight: 700; background: #e5e7eb; border-top: 2px solid var(--ink); }
    table.data .r { text-align: right; font-variant-numeric: tabular-nums; }
    table.data .c { text-align: center; }
    table.data .mono { font-family: "Courier New", monospace; }
    table.data .pos { color: #15803d; font-weight: 600; }
    table.data .neg { color: #b91c1c; font-weight: 600; }
    table.data tr.winner td { background: #ecfdf5 !important; }
    table.data tr.tie td { background: #fffbeb !important; }

    .cell-bar { display: flex; align-items: center; gap: 6px; }
    .cell-bar .t { min-width: 38px; text-align: right; font-variant-numeric: tabular-nums; }
    .bar { flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; min-width: 40px; }
    .bar > span { display: block; height: 100%; background: #1d4ed8; }
    .bar.green > span { background: #15803d; }
    .bar.red > span { background: #b91c1c; }

    .badge { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 7pt; font-weight: 700; letter-spacing: .3px; }
    .badge.win { background: #d1fae5; color: #065f46; }
    .badge.tie { background: #fef3c7; color: #92400e; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
    .position-block { margin-bottom: 12px; break-inside: avoid; }
    .pos-head { display: flex; justify-content: space-between; align-items: baseline; background: #e0e7ff; border: 1px solid #c7d2fe; border-bottom: none; padding: 5px 8px; font-weight: 700; color: #1e3a8a; }
    .pos-head small { font-weight: 400; color: #4b5563; font-size: 8pt; }
    .legend-table { max-width: 360px; }
    .legend-table .dot { margin-right: 6px; }

    /* Signatures */
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 30px; break-inside: avoid; }
    .sig .label { font-size: 8pt; color: var(--muted); }
    .sig .line { border-top: 1px solid var(--ink); margin-top: 38px; padding-top: 3px; text-align: center; font-weight: 600; font-size: 9pt; }
    .sig .role { text-align: center; font-size: 8pt; color: var(--muted); }
    .sig .date { margin-top: 8px; font-size: 8pt; color: var(--muted); }

    .end-note { text-align: center; font-size: 8pt; color: var(--muted); letter-spacing: 2px; margin-top: 22px; }
    .disclaimer { text-align: center; font-size: 7.5pt; color: var(--muted); border-top: 1px solid var(--line); padding-top: 6px; margin-top: 6px; }
`;

const buildPrintDocument = (opts: {
    tab: ReportTab;
    election?: Election | null;
    turnout: TurnoutReport | null;
    results: Results | null;
    sanctions: SanctionsList | null;
}): string | null => {
    const { tab, election, turnout, results, sanctions } = opts;
    const meta = REPORT_META[tab] ?? REPORT_META.turnout;

    let body = "";
    if (tab === "turnout" && turnout) {
        body = buildTurnoutContent(turnout);
    } else if (
        tab === "results" &&
        results?.results &&
        Object.keys(results.results).length > 0
    ) {
        body = buildResultsContent(results, turnout);
    } else if (tab === "sanctions" && sanctions) {
        body = buildSanctionsContent(sanctions);
    }
    if (!body) return null;

    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const ref = `OCC-ELEC-${String(election?.election_id ?? "0").replace(/[^A-Za-z0-9]/g, "")}-${meta.code}-${stamp}`;

    const electionTitle = election?.title || "Election Report";
    const startDate = fmtDate(election?.voting_start);
    const endDate = fmtDate(election?.voting_end);
    const votingPeriod =
        startDate === endDate ? startDate : `${startDate} – ${endDate}`;
    const dataAsOf =
        tab === "turnout" && turnout?.last_updated
            ? fmtDate(turnout.last_updated, true)
            : fmtDate(now, true);

    const signatures = `
        <div class="signatures">
            <div class="sig">
                <div class="label">Prepared by:</div>
                <div class="line">&nbsp;</div>
                <div class="role">Signature over Printed Name</div>
                <div class="date">Designation: ____________________<br/>Date: ____________________</div>
            </div>
            <div class="sig">
                <div class="label">Reviewed and certified correct by:</div>
                <div class="line">&nbsp;</div>
                <div class="role">Signature over Printed Name</div>
                <div class="date">Designation: ____________________<br/>Date: ____________________</div>
            </div>
            <div class="sig">
                <div class="label">Approved by:</div>
                <div class="line">&nbsp;</div>
                <div class="role">Signature over Printed Name</div>
                <div class="date">Designation: ____________________<br/>Date: ____________________</div>
            </div>
        </div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${esc(meta.title)} - ${esc(electionTitle)}</title>
    <style>${buildPrintCss(ref)}</style>
</head>
<body>
    <header class="letterhead">
        <div class="logo"><img src="${OCC_LOGO_DATA_URI}" alt="OCC Logo" /></div>
        <div class="org">
            <h1>Opol Community College</h1>
            <div class="sub">Election System &mdash; Official Report</div>
        </div>
        <div class="ref">
            <div>Ref. No.: <strong>${esc(ref)}</strong></div>
            <div>Generated: ${esc(fmtDate(now, true))}</div>
        </div>
    </header>

    <div class="title-block">
        <div class="eyebrow">OFFICIAL REPORT</div>
        <h2>${esc(meta.title)}</h2>
        <div class="election-name">${esc(electionTitle)}</div>
        <div class="rule"></div>
    </div>

    ${
        meta.confidential
            ? `<div class="banner">CONFIDENTIAL &mdash; This report contains personal information of students. Limit distribution to authorized personnel in accordance with the Data Privacy Act of 2012 (RA 10173).</div>`
            : ""
    }

    <table class="meta">
        <tr>
            <td class="k">Election</td><td>${esc(electionTitle)}</td>
            <td class="k">Election Type</td><td>${esc(election?.election_type || "—")}</td>
            <td class="k">Voting Period</td><td>${esc(votingPeriod)}</td>
        </tr>
        <tr>
            <td class="k">Report</td><td>${esc(meta.title)}</td>
            <td class="k">Reference No.</td><td>${esc(ref)}</td>
            <td class="k">Data As Of</td><td>${esc(dataAsOf)}</td>
        </tr>
    </table>

    ${body}

    ${signatures}

    <div class="end-note">&mdash; END OF REPORT &mdash;</div>
    <div class="disclaimer">
        This is a system-generated report from the OCC Election System. Copies without signatures are for reference only.<br/>
        &copy; ${now.getFullYear()} Opol Community College. All rights reserved.
    </div>

    <script>
        window.onload = function () {
            setTimeout(function () {
                window.print();
            }, 250);
            window.onafterprint = function () {
                window.close();
            };
        };
    </script>
</body>
</html>`;
};

const Reports: React.FC = () => {
    const {
        data: elections = [],
        isLoading: electionsLoading,
        refetch: refetchElections,
    } = useElections();
    const [selectedElection, setSelectedElection] = useState<string>("");
    const [turnoutReport, setTurnoutReport] = useState<TurnoutReport | null>(
        null,
    );
    const [sanctionsList, setSanctionsList] = useState<SanctionsList | null>(
        null,
    );
    const [results, setResults] = useState<Results | null>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [activeTab, setActiveTab] = useState("turnout");
    const [error, setError] = useState("");
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (elections.length > 0 && !selectedElection) {
            setSelectedElection(elections[0].election_id.toString());
        }
    }, [elections]);

    useEffect(() => {
        if (selectedElection) {
            fetchReports();
        }
    }, [selectedElection]);

    const fetchReports = async (): Promise<void> => {
        if (!selectedElection) return;
        setLoading(true);
        setError("");
        try {
            try {
                const turnoutRes =
                    await adminAPI.getTurnoutReport(selectedElection);
                let turnoutData = turnoutRes.data;
                if (turnoutData?.data) turnoutData = turnoutData.data;
                setTurnoutReport(turnoutData || null);
            } catch (err) {
                console.error("Failed to fetch turnout:", err);
                setTurnoutReport(null);
            }

            try {
                const sanctionsRes =
                    await adminAPI.getSanctionsList(selectedElection);
                let sanctionsData = sanctionsRes.data;
                if (sanctionsData?.data) sanctionsData = sanctionsData.data;
                setSanctionsList(sanctionsData || null);
            } catch (err) {
                console.error("Failed to fetch sanctions:", err);
                setSanctionsList(null);
            }

            try {
                const resultsRes =
                    await electionAPI.getResults(selectedElection);
                let resultsData = resultsRes.data;
                if (resultsData?.data) resultsData = resultsData.data;
                if (resultsData && typeof resultsData === "object") {
                    setResults(resultsData as Results);
                } else {
                    setResults(null);
                }
            } catch (err) {
                console.error("Failed to fetch results:", err);
                setResults(null);
            }
        } catch (error) {
            console.error("Failed to fetch reports:", error);
            setError("Failed to load reports data");
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async (): Promise<void> => {
        await fetchReports();
        await refetchElections();
    };

    // ✅ Professional Print Function (builds a full report for the active tab)
    const handlePrint = () => {
        const election = elections.find(
            (e: any) => e.election_id?.toString() === selectedElection,
        );

        const html = buildPrintDocument({
            tab: activeTab as ReportTab,
            election,
            turnout: turnoutReport,
            results,
            sanctions: sanctionsList,
        });

        if (!html) {
            alert("There is no data available to print for this report.");
            return;
        }

        const printWindow = window.open("", "_blank", "width=900,height=700");
        if (!printWindow) {
            alert("Please allow popups to print the report");
            return;
        }

        printWindow.document.write(html);
        printWindow.document.close();
    };

    // ✅ Export to CSV
    const exportToCSV = (
        data: unknown[] | null,
        filename: string,
        headers?: string[],
    ): void => {
        if (!data || (Array.isArray(data) && data.length === 0)) {
            alert("No data to export");
            return;
        }

        const dataArray = Array.isArray(data) ? data : [data];
        const csvHeaders = headers || Object.keys(dataArray[0] || {});
        const csvRows = [
            csvHeaders.join(","),
            ...dataArray.map((row) =>
                csvHeaders
                    .map((h) => {
                        let value = (row as Record<string, unknown>)[h];
                        if (value === undefined || value === null) value = "";
                        if (typeof value === "object")
                            value = JSON.stringify(value);
                        return `"${String(value).replace(/"/g, '""')}"`;
                    })
                    .join(","),
            ),
        ];

        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const prepareTurnoutChartData = (): Array<{
        course: string;
        total: number;
        voted: number;
        percentage: number;
    }> => {
        if (!turnoutReport?.breakdown_by_course) return [];
        return turnoutReport.breakdown_by_course.map((item) => ({
            course: item.course || "No Course",
            total: item.total || 0,
            voted: item.voted || 0,
            percentage:
                item.total > 0
                    ? Math.round((item.voted / item.total) * 100)
                    : 0,
        }));
    };

    const preparePieChartData = (): Array<{
        name: string;
        value: number;
        color: string;
    }> => {
        if (!turnoutReport) return [];
        const voted = turnoutReport.voted_count || 0;
        const notVoted = (turnoutReport.total_voters || 0) - voted;
        return [
            { name: "Voted", value: voted, color: "#10b981" },
            { name: "Not Voted", value: notVoted, color: "#ef4444" },
        ];
    };

    if (electionsLoading && !elections.length) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const currentElection = elections.find(
        (e: any) => e.election_id?.toString() === selectedElection,
    );
    const turnoutChartData = prepareTurnoutChartData();
    const pieData = preparePieChartData();

    return (
        <div className="space-y-6">
            {/* ✅ Print Styles Injection */}
            <style>{printStyles}</style>

            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4 no-print">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Election Reports & Analytics
                    </h1>
                    <p className="text-gray-600">
                        Comprehensive reports, statistics, and data
                        visualization
                    </p>
                </div>
                <div className="flex space-x-2 flex-wrap gap-2">
                    <RefreshButton
                        onClick={handleRefresh}
                        isLoading={loading}
                    />
                    <Button
                        onClick={handlePrint}
                        variant="outline"
                        className="bg-gray-50 hover:bg-gray-100 border-2"
                    >
                        <Printer className="w-4 h-4 mr-2" />
                        Print Report
                    </Button>
                </div>
            </div>

            {error && (
                <Card className="border-red-200 bg-red-50 no-print">
                    <CardContent className="p-4 flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <span className="text-red-600">{error}</span>
                    </CardContent>
                </Card>
            )}

            {/* Election Selector - Hidden on Print */}
            <Card className="no-print">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <span className="text-sm font-medium text-gray-700">
                                Select Election:
                            </span>
                            <select
                                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[250px]"
                                value={selectedElection}
                                onChange={(e) =>
                                    setSelectedElection(e.target.value)
                                }
                            >
                                <option value="">Select an election</option>
                                {elections.map((election: any) => (
                                    <option
                                        key={election.election_id}
                                        value={election.election_id}
                                    >
                                        {election.title} -{" "}
                                        {new Date(
                                            election.voting_start,
                                        ).toLocaleDateString()}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {currentElection && (
                            <Badge className="bg-blue-100 text-blue-800">
                                {currentElection.election_type} Election
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Tabs - Hidden on Print */}
            <div className="no-print">
                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="space-y-4"
                >
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="turnout">
                            <TrendingUp className="w-4 h-4 mr-2" /> Voter
                            Turnout
                        </TabsTrigger>
                        <TabsTrigger value="results">
                            <BarChart3 className="w-4 h-4 mr-2" /> Election
                            Results
                        </TabsTrigger>
                        <TabsTrigger value="sanctions">
                            <FileText className="w-4 h-4 mr-2" /> Sanctions List
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* ===== TURNOUT TAB ===== */}
            <div className={activeTab === "turnout" ? "block" : "hidden"}>
                <div className="no-print flex justify-end space-x-2 flex-wrap gap-2 mb-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                        className="bg-red-50 hover:bg-red-100"
                    >
                        <Printer className="w-4 h-4 mr-2" /> Print Report
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const summaryData = [
                                {
                                    Metric: "Total Voters",
                                    Value: turnoutReport?.total_voters || 0,
                                },
                                {
                                    Metric: "Votes Cast",
                                    Value: turnoutReport?.voted_count || 0,
                                },
                                {
                                    Metric: "Turnout Percentage",
                                    Value: `${turnoutReport?.turnout_percentage || 0}%`,
                                },
                            ];
                            exportToCSV(summaryData, "turnout_summary");
                        }}
                        disabled={!turnoutReport}
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Export
                        Summary
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            exportToCSV(
                                turnoutReport?.breakdown_by_course || null,
                                "turnout_by_course",
                            )
                        }
                        disabled={!turnoutReport?.breakdown_by_course?.length}
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Export
                        Breakdown
                    </Button>
                </div>

                {turnoutReport ? (
                    <>
                        {/* Stats Pills */}
                        <div className="flex flex-wrap items-center gap-3 py-1 no-print">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
                                <Users className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-600">
                                    Total Voters
                                </span>
                                <span className="text-sm font-bold text-gray-900">
                                    {turnoutReport.total_voters || 0}
                                </span>
                            </div>
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                                <Vote className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium text-green-700">
                                    Votes Cast
                                </span>
                                <span className="text-sm font-bold text-green-800">
                                    {turnoutReport.voted_count || 0}
                                </span>
                            </div>
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-full">
                                <TrendingUp className="w-4 h-4 text-purple-600" />
                                <span className="text-sm font-medium text-purple-700">
                                    Turnout
                                </span>
                                <span className="text-sm font-bold text-purple-800">
                                    {turnoutReport.turnout_percentage || 0}%
                                </span>
                            </div>
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-full">
                                <Clock className="w-4 h-4 text-orange-600" />
                                <span className="text-sm font-medium text-orange-700">
                                    Remaining
                                </span>
                                <span className="text-sm font-bold text-orange-800">
                                    {(turnoutReport.total_voters || 0) -
                                        (turnoutReport.voted_count || 0)}
                                </span>
                            </div>
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <PieChartIcon className="w-5 h-5 text-blue-600" />
                                        Voter Participation
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {pieData.length > 0 &&
                                        pieData[0].value > 0 ? (
                                        <div className="h-[300px]">
                                            <ResponsiveContainer
                                                width="100%"
                                                height="100%"
                                            >
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={100}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                        label={(entry: any) => {
                                                            const name =
                                                                entry.name ||
                                                                "";
                                                            const percent =
                                                                entry.percent ||
                                                                0;
                                                            return `${name}: ${(percent * 100).toFixed(0)}%`;
                                                        }}
                                                    >
                                                        {pieData.map(
                                                            (entry, index) => (
                                                                <Cell
                                                                    key={`cell-${index}`}
                                                                    fill={
                                                                        entry.color
                                                                    }
                                                                />
                                                            ),
                                                        )}
                                                    </Pie>
                                                    <Tooltip />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="h-[300px] flex items-center justify-center text-gray-500">
                                            No data available
                                        </div>
                                    )}
                                    <div className="mt-4 text-center">
                                        <p className="text-sm text-gray-600">
                                            Overall Turnout
                                        </p>
                                        <p className="text-3xl font-bold text-green-600">
                                            {turnoutReport.turnout_percentage ||
                                                0}
                                            %
                                        </p>
                                        <Progress
                                            value={
                                                turnoutReport.turnout_percentage ||
                                                0
                                            }
                                            className="mt-2 h-2"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-green-600" />
                                        Turnout by Course
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {turnoutChartData.length > 0 ? (
                                        <div className="h-[300px]">
                                            <ResponsiveContainer
                                                width="100%"
                                                height="100%"
                                            >
                                                <BarChart
                                                    data={turnoutChartData}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="course" />
                                                    <YAxis />
                                                    <Tooltip />
                                                    <Legend />
                                                    <Bar
                                                        dataKey="voted"
                                                        fill="#3b82f6"
                                                        name="Voted"
                                                    />
                                                    <Bar
                                                        dataKey="total"
                                                        fill="#10b981"
                                                        name="Total Voters"
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="h-[300px] flex items-center justify-center text-gray-500">
                                            No course data available
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Detailed Breakdown Table */}
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    Detailed Turnout Breakdown
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="p-3 text-left">
                                                    Category
                                                </th>
                                                <th className="p-3 text-left">
                                                    Total Voters
                                                </th>
                                                <th className="p-3 text-left">
                                                    Voted
                                                </th>
                                                <th className="p-3 text-left">
                                                    Not Voted
                                                </th>
                                                <th className="p-3 text-left">
                                                    Turnout
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {turnoutReport.breakdown_by_course?.map(
                                                (item, index) => (
                                                    <tr
                                                        key={index}
                                                        className="border-t"
                                                    >
                                                        <td className="p-3 font-medium">
                                                            {item.course}
                                                        </td>
                                                        <td className="p-3">
                                                            {item.total}
                                                        </td>
                                                        <td className="p-3 text-green-600">
                                                            {item.voted}
                                                        </td>
                                                        <td className="p-3 text-red-600">
                                                            {item.total -
                                                                item.voted}
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex items-center space-x-2">
                                                                <span className="font-semibold">
                                                                    {item.total >
                                                                        0
                                                                        ? Math.round(
                                                                            (item.voted /
                                                                                item.total) *
                                                                            100,
                                                                        )
                                                                        : 0}
                                                                    %
                                                                </span>
                                                                <Progress
                                                                    value={
                                                                        item.total >
                                                                            0
                                                                            ? (item.voted /
                                                                                item.total) *
                                                                            100
                                                                            : 0
                                                                    }
                                                                    className="w-24 h-2"
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                        </tbody>
                                        <tfoot className="bg-gray-50 font-semibold">
                                            <tr className="border-t">
                                                <td className="p-3">TOTAL</td>
                                                <td className="p-3">
                                                    {turnoutReport.total_voters ||
                                                        0}
                                                </td>
                                                <td className="p-3 text-green-600">
                                                    {turnoutReport.voted_count ||
                                                        0}
                                                </td>
                                                <td className="p-3 text-red-600">
                                                    {(turnoutReport.total_voters ||
                                                        0) -
                                                        (turnoutReport.voted_count ||
                                                            0)}
                                                </td>
                                                <td className="p-3">
                                                    {turnoutReport.turnout_percentage ||
                                                        0}
                                                    %
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                ) : (
                    <Card>
                        <CardContent className="text-center py-12">
                            <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                            <p className="text-gray-500">
                                No turnout data available for this election
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ===== RESULTS TAB ===== */}
            <div className={activeTab === "results" ? "block" : "hidden"}>
                <div className="no-print flex justify-end space-x-2 flex-wrap gap-2 mb-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                        className="bg-red-50 hover:bg-red-100"
                    >
                        <Printer className="w-4 h-4 mr-2" /> Print Report
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (!results?.results) return;
                            const resultsData: Array<{
                                Position: string;
                                Candidate: string;
                                Partylist: string;
                                Votes: number;
                            }> = [];
                            Object.entries(results.results).forEach(
                                ([position, candidates]) => {
                                    candidates.forEach((candidate) => {
                                        resultsData.push({
                                            Position: position,
                                            Candidate:
                                                `${candidate.candidate?.user?.first_name || ""} ${candidate.candidate?.user?.last_name || ""}`.trim(),
                                            Partylist:
                                                candidate.candidate?.partylist
                                                    ?.name || "Independent",
                                            Votes: candidate.votes || 0,
                                        });
                                    });
                                },
                            );
                            exportToCSV(resultsData, "election_results");
                        }}
                        disabled={!results?.results}
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Export CSV
                    </Button>
                </div>

                {results?.results && Object.keys(results.results).length > 0 ? (
                    Object.entries(results.results).map(
                        ([position, candidates]) => {
                            const maxVotes = Math.max(
                                ...(candidates?.map((c) => c.votes) || [0]),
                            );
                            return (
                                <Card key={position}>
                                    <CardHeader className="bg-gray-50">
                                        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                                            <div className="flex items-center">
                                                <Award className="w-5 h-5 mr-2 text-yellow-500" />
                                                {position}
                                            </div>
                                            <Badge className="bg-green-100 text-green-800">
                                                Winner:{" "}
                                                {candidates[0]?.candidate?.user
                                                    ?.first_name || ""}{" "}
                                                {candidates[0]?.candidate?.user
                                                    ?.last_name || ""}
                                            </Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        <div className="space-y-4">
                                            {candidates?.map(
                                                (candidate, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="space-y-2"
                                                    >
                                                        <div className="flex justify-between items-center flex-wrap gap-2">
                                                            <div>
                                                                <span className="font-medium">
                                                                    {candidate
                                                                        .candidate
                                                                        ?.user
                                                                        ?.first_name ||
                                                                        ""}{" "}
                                                                    {candidate
                                                                        .candidate
                                                                        ?.user
                                                                        ?.last_name ||
                                                                        ""}
                                                                </span>
                                                                {candidate
                                                                    .candidate
                                                                    ?.partylist && (
                                                                        <span className="text-sm text-gray-500 ml-2">
                                                                            (
                                                                            {
                                                                                candidate
                                                                                    .candidate
                                                                                    .partylist
                                                                                    .name
                                                                            }
                                                                            )
                                                                        </span>
                                                                    )}
                                                                {idx === 0 &&
                                                                    maxVotes >
                                                                    0 &&
                                                                    candidate.votes ===
                                                                    maxVotes && (
                                                                        <Badge className="ml-2 bg-yellow-100 text-yellow-800">
                                                                            🏆
                                                                            Winner
                                                                        </Badge>
                                                                    )}
                                                            </div>
                                                            <div className="flex items-center space-x-4">
                                                                <span className="font-bold text-xl text-gray-900">
                                                                    {candidate.votes ||
                                                                        0}
                                                                </span>
                                                                <span className="text-sm text-gray-500">
                                                                    votes
                                                                </span>
                                                                <span className="text-sm text-gray-500 w-16">
                                                                    {maxVotes >
                                                                        0
                                                                        ? `${Math.round(((candidate.votes || 0) / maxVotes) * 100)}%`
                                                                        : "0%"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Progress
                                                            value={
                                                                maxVotes > 0
                                                                    ? ((candidate.votes ||
                                                                        0) /
                                                                        maxVotes) *
                                                                    100
                                                                    : 0
                                                            }
                                                            className="h-2"
                                                        />
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        },
                    )
                ) : (
                    <Card>
                        <CardContent className="text-center py-12">
                            <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                            <p className="text-gray-500">
                                No results available for this election yet
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                                Results will appear after the election ends
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ===== SANCTIONS TAB ===== */}
            <div className={activeTab === "sanctions" ? "block" : "hidden"}>
                {sanctionsList ? (
                    <>
                        <div className="no-print flex justify-end space-x-2 flex-wrap gap-2 mb-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrint}
                                className="bg-red-50 hover:bg-red-100"
                            >
                                <Printer className="w-4 h-4 mr-2" /> Print
                                Report
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    exportToCSV(
                                        sanctionsList.non_voters_list,
                                        "sanctions_list",
                                    )
                                }
                            >
                                <Download className="w-4 h-4 mr-2" /> Export CSV
                            </Button>
                        </div>

                        {/* Stats Pills */}
                        <div className="flex flex-wrap items-center gap-3 py-1 no-print">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
                                <Users className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-600">
                                    Total Eligible
                                </span>
                                <span className="text-sm font-bold text-gray-900">
                                    {sanctionsList.total_eligible_voters || 0}
                                </span>
                            </div>
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-full">
                                <XCircle className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-medium text-red-700">
                                    Non-Voters
                                </span>
                                <span className="text-sm font-bold text-red-800">
                                    {sanctionsList.total_non_voters || 0}
                                </span>
                            </div>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-red-600" />
                                    Sanctions List - Non-Voters
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {sanctionsList.non_voters_list &&
                                    sanctionsList.non_voters_list.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="p-3 text-left">
                                                        Student ID
                                                    </th>
                                                    <th className="p-3 text-left">
                                                        Name
                                                    </th>
                                                    <th className="p-3 text-left">
                                                        Course
                                                    </th>
                                                    <th className="p-3 text-left">
                                                        Year Level
                                                    </th>
                                                    <th className="p-3 text-left">
                                                        Email
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sanctionsList.non_voters_list.map(
                                                    (voter, index) => (
                                                        <tr
                                                            key={index}
                                                            className="border-t"
                                                        >
                                                            <td className="p-3 font-mono">
                                                                {voter.id_no ||
                                                                    "-"}
                                                            </td>
                                                            <td className="p-3 font-medium">
                                                                {
                                                                    voter.first_name
                                                                }{" "}
                                                                {
                                                                    voter.last_name
                                                                }
                                                            </td>
                                                            <td className="p-3">
                                                                {voter.course ||
                                                                    "-"}
                                                            </td>
                                                            <td className="p-3">
                                                                {voter.year_level
                                                                    ? `Year ${voter.year_level}`
                                                                    : "-"}
                                                            </td>
                                                            <td className="p-3">
                                                                {voter.email ||
                                                                    "-"}
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                        <p>
                                            No non-voters found! Everyone voted.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </>
                ) : (
                    <Card>
                        <CardContent className="text-center py-12">
                            <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                            <p className="text-gray-500">
                                No sanctions data available
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default Reports;