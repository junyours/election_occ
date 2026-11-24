// resources/js/Portal/PortalElectionLiveResults.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
    publicResultsAPI,
    LiveResultsPayload,
    PositionProgress,
} from "../api/publicResults";
import {
    Activity,
    ArrowLeft,
    Award,
    BarChart3,
    Calendar,
    CheckCircle2,
    Clock,
    Crown,
    Loader2,
    Lock,
    RefreshCw,
    ShieldCheck,
    TrendingUp,
    Trophy,
    User,
    Users,
    Vote,
    Zap,
} from "lucide-react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

const POLL_MS = 15_000;
const HIDDEN_MULTIPLIER = 4;

/* Brand tokens (kept in one place so charts match the Tailwind UI) */
const INK = "#0A1530";
const BLUE = "#2F5BFF";
const GREEN = "#10b981";
const SLATE = "#cbd5e1";
const TEAL = "#0d9488";

const tooltipStyle = {
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 30px rgba(10,21,48,0.12)",
    fontSize: 12,
};

const CARD = "rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm";

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

const PanelHeader: React.FC<{
    icon: React.ElementType;
    title: string;
    tone: string;
    aside?: React.ReactNode;
}> = ({ icon: Icon, title, tone, aside }) => (
    <div className="mb-5 flex items-center gap-3">
        <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}
        >
            <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {aside && <div className="ml-auto">{aside}</div>}
    </div>
);

const Pill: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = "bg-slate-100 text-slate-600",
}) => (
    <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${className}`}
    >
        {children}
    </span>
);

const LiveDot: React.FC<{ className?: string }> = ({
    className = "bg-emerald-500",
}) => (
    <span className="relative flex h-2 w-2">
        <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping ${className}`}
        />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${className}`} />
    </span>
);

const Bar2: React.FC<{ value: number; className?: string; height?: string }> = ({
    value,
    className = "bg-blue-600",
    height = "h-2",
}) => (
    <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(100, Math.max(0, value)))}
        className={`w-full overflow-hidden rounded-full bg-slate-100 ${height}`}
    >
        <div
            className={`h-full rounded-full transition-[width] duration-700 ease-out ${className}`}
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
    </div>
);

const formatDateTime = (value?: string) =>
    value
        ? new Date(value).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
          })
        : "—";

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */
const PortalElectionLiveResults: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [data, setData] = useState<LiveResultsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // --------------------------------------------------------
    // Data fetching
    // --------------------------------------------------------
    const fetchResults = async (isRefresh = false) => {
        if (!id) return;
        if (isRefresh) setRefreshing(true);
        try {
            let res;
            try {
                res = await publicResultsAPI.getLiveResults(parseInt(id));
            } catch {
                res = await publicResultsAPI.getFinalResults(parseInt(id));
            }
            let payload: any = res.data;
            if (payload?.data) payload = payload.data;
            setData(payload);
            setLastUpdated(new Date());
            setError("");
        } catch (err: any) {
            setError(
                err.response?.data?.message ||
                    "Failed to load results for this election.",
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (id) fetchResults();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Polling for live updates
    useEffect(() => {
        if (!id) return;
        const tick = async () => {
            await fetchResults();
            const interval = document.hidden
                ? POLL_MS * HIDDEN_MULTIPLIER
                : POLL_MS;
            timer = setTimeout(tick, interval);
        };
        let timer = setTimeout(tick, POLL_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // --------------------------------------------------------
    // Derived state
    // --------------------------------------------------------
    const isOngoing = data?.is_ongoing === true;
    const isFinished = data?.is_finished === true;

    const status = useMemo(() => {
        if (!data) return null;
        if (data.is_finished)
            return {
                label: "Ended",
                chip: "bg-white/10 text-slate-200 ring-white/20",
                icon: CheckCircle2,
            };
        if (data.is_ongoing)
            return {
                label: "Ongoing",
                chip: "bg-emerald-400/15 text-emerald-300 ring-emerald-300/30",
                icon: Activity,
            };
        return {
            label: "Upcoming",
            chip: "bg-amber-400/15 text-amber-200 ring-amber-300/30",
            icon: Clock,
        };
    }, [data]);

    // Convert live_results object to a normalized array
    const positions = useMemo(() => {
        if (!data?.live_results) return [];
        const progressMap = new Map<number, PositionProgress>();
        (data.position_progress ?? []).forEach((p) =>
            progressMap.set(p.position_id, p),
        );
        return Object.entries(data.live_results).map(
            ([title, candidates], idx) => {
                const progress = data.position_progress?.find(
                    (p) => p.title === title,
                );
                const totalVotes = (candidates ?? []).reduce(
                    (sum, c) => sum + (c.votes ?? 0),
                    0,
                );
                return {
                    position_id: progress?.position_id ?? idx,
                    title,
                    category: progress?.category ?? "General",
                    candidates,
                    total_votes: totalVotes,
                    progress_percentage: progress?.progress_percentage ?? 0,
                    total_candidates:
                        progress?.total_candidates ?? candidates.length,
                };
            },
        );
    }, [data]);

    const summary = data?.summary;

    // ---- Chart data builders ----
    const participationPieData = useMemo(() => {
        if (!summary) return [];
        return [
            { name: "Voted", value: summary.voted_count || 0, color: BLUE },
            {
                name: "Not voted",
                value: summary.remaining_voters || 0,
                color: SLATE,
            },
        ].filter((d) => d.value > 0);
    }, [summary]);

    const positionProgressChartData = useMemo(() => {
        return positions
            .slice()
            .sort((a, b) => b.total_votes - a.total_votes)
            .map((p) => ({
                name:
                    p.title.length > 20
                        ? p.title.substring(0, 20) + "…"
                        : p.title,
                votes: p.total_votes,
                candidates: p.total_candidates,
                progress: p.progress_percentage,
            }));
    }, [positions]);

    const votesPerHourChartData = useMemo(() => {
        if (!data?.votes_per_hour) return [];
        return data.votes_per_hour.map((row) => ({
            hour: `${String(row.hour).padStart(2, "0")}:00`,
            count: row.count,
        }));
    }, [data]);

    // ---- Loading / error ----
    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="mx-auto mb-3 h-9 w-9 animate-spin text-blue-600" />
                    <p className="font-medium text-slate-600">
                        Loading results…
                    </p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
                <div
                    role="alert"
                    className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl shadow-slate-900/10 ring-1 ring-slate-200"
                >
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                        <Vote className="h-7 w-7 text-red-500" />
                    </div>
                    <h2 className="mb-2 text-xl font-semibold text-slate-900">
                        Results not available
                    </h2>
                    <p className="mb-6 text-sm text-slate-500">
                        {error || "We couldn't load results for this election."}
                    </p>
                    <div className="flex justify-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => navigate("/live-results")}
                            className="rounded-xl"
                        >
                            <ArrowLeft className="mr-1.5 h-4 w-4" />
                            All elections
                        </Button>
                        <Button
                            onClick={() => fetchResults(true)}
                            className="rounded-xl bg-[#123A8C] hover:bg-[#0F2A6B]"
                        >
                            <RefreshCw className="mr-1.5 h-4 w-4" />
                            Retry
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const StatusIcon = status?.icon ?? Clock;

    const statCells = summary
        ? [
              { label: "Votes cast", value: summary.total_votes_cast, icon: Vote, iconTone: "bg-blue-50 text-blue-600" },
              { label: "Eligible voters", value: summary.total_voters, icon: Users, iconTone: "bg-emerald-50 text-emerald-600" },
              { label: "Turnout", value: `${summary.turnout_percentage}%`, icon: TrendingUp, iconTone: "bg-violet-50 text-violet-600" },
              { label: "Positions", value: summary.total_positions, icon: Award, iconTone: "bg-amber-50 text-amber-600" },
              { label: "Candidates", value: summary.total_candidates, icon: User, iconTone: "bg-teal-50 text-teal-600" },
              ...(isOngoing
                  ? [{ label: "Last 30 min", value: summary.recent_votes_30min, icon: Zap, iconTone: "bg-rose-50 text-rose-600" }]
                  : []),
          ]
        : [];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* ============================ HERO ============================ */}
            <header className="relative overflow-hidden bg-[#0F2A6B]">
                <div className="relative container mx-auto px-4 pb-16 pt-4 sm:px-6 sm:pb-20 lg:px-8">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/live-results")}
                        className="-ml-3 text-slate-300 hover:bg-white/10 hover:text-white"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        All elections
                    </Button>

                    <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                        <div className="max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                                {status && (
                                    <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${status.chip}`}
                                    >
                                        {isOngoing ? (
                                            <LiveDot className="bg-emerald-400" />
                                        ) : (
                                            <StatusIcon className="h-3.5 w-3.5" />
                                        )}
                                        {isOngoing ? "Live" : status.label}
                                    </span>
                                )}
                                {data.election.election_type && (
                                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-slate-200 ring-1 ring-inset ring-white/15">
                                        {data.election.election_type}
                                    </span>
                                )}
                            </div>

                            <h1 className="mt-3 text-2xl font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl">
                                {data.election.title}
                            </h1>
                            {data.election.description && (
                                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                                    {data.election.description}
                                </p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                                <Calendar className="h-4 w-4" />
                                <span className="tabular-nums">
                                    {formatDateTime(data.election.voting_start)}
                                    {" – "}
                                    {formatDateTime(data.election.voting_end)}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-right leading-tight">
                                <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
                                    {isOngoing && <LiveDot className="bg-blue-400" />}
                                    {isOngoing
                                        ? "Auto-refreshing every 15s"
                                        : "Final results"}
                                </div>
                                <div className="mt-1 text-sm font-medium tabular-nums text-slate-100">
                                    {lastUpdated.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                    })}
                                </div>
                            </div>
                            <Button
                                onClick={() => fetchResults(true)}
                                disabled={refreshing}
                                className="h-11 rounded-xl bg-white px-5 font-medium text-[#0F2A6B] shadow-lg shadow-black/20 hover:bg-slate-100"
                            >
                                <RefreshCw
                                    className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                                />
                                {refreshing ? "Refreshing" : "Refresh"}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ============================ BODY ============================ */}
            <main className="relative z-10 container mx-auto -mt-10 space-y-6 px-4 pb-16 sm:px-6 lg:px-8">
                {/* Summary strip */}
                {summary && (
                    <section
                        aria-label="Election summary"
                        className={`grid grid-cols-2 overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-200 ${
                            statCells.length === 6 ? "lg:grid-cols-6" : "lg:grid-cols-5"
                        }`}
                    >
                        {statCells.map((s, i) => {
                            const Icon = s.icon;
                            return (
                                <div
                                    key={s.label}
                                    className={`flex flex-col gap-3 p-5 sm:p-6 ${
                                        i % 2 === 1 ? "border-l border-slate-100" : ""
                                    } ${i >= 2 ? "border-t border-slate-100" : ""} lg:border-t-0 ${
                                        i > 0 ? "lg:border-l lg:border-slate-100" : "lg:border-l-0"
                                    }`}
                                >
                                    <span
                                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.iconTone}`}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <div>
                                        <div className="text-3xl font-semibold leading-none tabular-nums text-slate-900">
                                            {s.value}
                                        </div>
                                        <div className="mt-1.5 text-sm text-slate-500">
                                            {s.label}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </section>
                )}

                {/* Anonymity notice */}
                {isOngoing && (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                            <p className="text-sm font-semibold text-amber-900">
                                Anonymous results mode
                            </p>
                            <p className="text-sm text-amber-800">
                                Candidate names stay hidden until the election
                                ends, to keep voting fair.
                            </p>
                        </div>
                    </div>
                )}

                {/* Turnout progress */}
                {summary && (
                    <section className={`${CARD} p-6`}>
                        <PanelHeader
                            icon={BarChart3}
                            title="Turnout progress"
                            tone="bg-blue-50 text-blue-600"
                            aside={
                                <span className="text-2xl font-semibold tabular-nums text-slate-900">
                                    {summary.turnout_percentage}%
                                </span>
                            }
                        />
                        <Bar2
                            value={summary.turnout_percentage}
                            className="bg-blue-600"
                            height="h-3.5"
                        />
                        <div className="mt-4 grid grid-cols-3 text-sm">
                            <div>
                                <div className="font-semibold tabular-nums text-slate-900">
                                    {summary.voted_count}
                                </div>
                                <div className="text-slate-500">Voted</div>
                            </div>
                            <div className="text-center">
                                <div className="font-semibold tabular-nums text-slate-900">
                                    {summary.remaining_voters}
                                </div>
                                <div className="text-slate-500">Remaining</div>
                            </div>
                            <div className="text-right">
                                <div className="font-semibold tabular-nums text-slate-900">
                                    {summary.total_voters}
                                </div>
                                <div className="text-slate-500">Eligible</div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Charts row */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Participation donut */}
                    <section className={`${CARD} p-6`}>
                        <PanelHeader
                            icon={Vote}
                            title="Voter participation"
                            tone="bg-blue-50 text-blue-600"
                            aside={
                                isOngoing && (
                                    <Pill className="bg-emerald-50 text-emerald-700">
                                        <LiveDot />
                                        Live
                                    </Pill>
                                )
                            }
                        />
                        {participationPieData.length > 0 ? (
                            <div className="relative h-[260px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={participationPieData}
                                            cx="50%"
                                            cy="46%"
                                            innerRadius={72}
                                            outerRadius={100}
                                            paddingAngle={3}
                                            cornerRadius={6}
                                            stroke="none"
                                            dataKey="value"
                                        >
                                            {participationPieData.map(
                                                (entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={entry.color}
                                                    />
                                                ),
                                            )}
                                        </Pie>
                                        <Tooltip contentStyle={tooltipStyle} />
                                        <Legend
                                            iconType="circle"
                                            wrapperStyle={{ fontSize: 12 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                {summary && (
                                    <div
                                        className="pointer-events-none absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 text-center"
                                        aria-hidden
                                    >
                                        <div className="text-3xl font-semibold tabular-nums text-slate-900">
                                            {summary.turnout_percentage}%
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            turnout
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex h-[260px] items-center justify-center text-sm text-slate-500">
                                No participation data yet
                            </div>
                        )}
                    </section>

                    {/* Position progress */}
                    <section className={`${CARD} p-6`}>
                        <PanelHeader
                            icon={BarChart3}
                            title="Position progress"
                            tone="bg-violet-50 text-violet-600"
                            aside={
                                <Pill className="bg-violet-50 text-violet-700">
                                    {positions.length} positions
                                </Pill>
                            }
                        />
                        {positionProgressChartData.length > 0 ? (
                            <div className="h-[260px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={positionProgressChartData}
                                        layout="vertical"
                                        margin={{ left: 0, right: 10 }}
                                        barCategoryGap={10}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="#eef2f7"
                                            horizontal={false}
                                        />
                                        <XAxis
                                            type="number"
                                            tick={{ fontSize: 11, fill: "#64748b" }}
                                            axisLine={false}
                                            tickLine={false}
                                            allowDecimals={false}
                                        />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            width={100}
                                            tick={{ fontSize: 11, fill: "#475569" }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            contentStyle={tooltipStyle}
                                            cursor={{ fill: "#f1f5f9" }}
                                        />
                                        <Legend
                                            iconType="circle"
                                            wrapperStyle={{ fontSize: 12 }}
                                        />
                                        <Bar
                                            dataKey="votes"
                                            fill={BLUE}
                                            name="Votes cast"
                                            radius={[0, 6, 6, 0]}
                                        />
                                        <Bar
                                            dataKey="candidates"
                                            fill={SLATE}
                                            name="Candidates"
                                            radius={[0, 6, 6, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex h-[260px] items-center justify-center text-sm text-slate-500">
                                No position data yet
                            </div>
                        )}
                    </section>
                </div>

                {/* Votes per hour */}
                {votesPerHourChartData.length > 0 && (
                    <section className={`${CARD} p-6`}>
                        <PanelHeader
                            icon={Activity}
                            title="Votes cast per hour (today)"
                            tone="bg-teal-50 text-teal-600"
                            aside={
                                <Pill className="bg-teal-50 text-teal-700">
                                    {votesPerHourChartData.reduce(
                                        (sum, r) => sum + r.count,
                                        0,
                                    )}{" "}
                                    votes
                                </Pill>
                            }
                        />
                        <div className="h-[230px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={votesPerHourChartData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#eef2f7"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="hour"
                                        tick={{ fontSize: 11, fill: "#64748b" }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: "#64748b" }}
                                        axisLine={false}
                                        tickLine={false}
                                        allowDecimals={false}
                                    />
                                    <Tooltip contentStyle={tooltipStyle} />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        stroke={TEAL}
                                        strokeWidth={2.5}
                                        fill={TEAL}
                                        fillOpacity={0.14}
                                        name="Votes"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </section>
                )}

                {/* Per-position statistics */}
                {data.position_progress && data.position_progress.length > 0 && (
                    <section className={`${CARD} p-6`}>
                        <PanelHeader
                            icon={Award}
                            title="Per-position statistics"
                            tone="bg-amber-50 text-amber-600"
                            aside={
                                <Pill className="bg-amber-50 text-amber-700">
                                    {data.position_progress.length} positions
                                </Pill>
                            }
                        />
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {data.position_progress.map((row) => (
                                <div
                                    key={row.position_id}
                                    className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/70"
                                >
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <span className="truncate text-sm font-semibold text-slate-900">
                                            {row.title}
                                        </span>
                                        <span className="shrink-0 text-sm font-semibold tabular-nums text-blue-700">
                                            {row.progress_percentage}%
                                        </span>
                                    </div>
                                    <Bar2 value={row.progress_percentage} />
                                    <div className="mt-3 flex justify-between text-xs text-slate-500">
                                        <span className="flex items-center gap-1.5">
                                            <Vote className="h-3.5 w-3.5" />
                                            {row.votes_cast} votes
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Users className="h-3.5 w-3.5" />
                                            {row.total_candidates} candidates
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Candidate results */}
                {positions.length === 0 ? (
                    <div className={`${CARD} p-12 text-center`}>
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                            <BarChart3 className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="font-semibold text-slate-700">
                            No results available yet
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            {isFinished
                                ? "This election did not have any votes cast."
                                : "Results will appear as soon as voting begins."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {positions.map((position, pIdx) => {
                            const maxVotes =
                                Math.max(
                                    ...position.candidates.map((c) => c.votes),
                                    1,
                                ) || 1;
                            return (
                                <section
                                    key={`${position.position_id}-${pIdx}`}
                                    className={`${CARD} overflow-hidden`}
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                                                    pIdx === 0
                                                        ? "bg-amber-100 text-amber-600"
                                                        : "bg-blue-50 text-blue-600"
                                                }`}
                                            >
                                                {pIdx === 0 ? (
                                                    <Crown className="h-4 w-4" />
                                                ) : (
                                                    <Award className="h-4 w-4" />
                                                )}
                                            </span>
                                            <div>
                                                <h3 className="font-semibold leading-tight text-slate-900">
                                                    {position.title}
                                                </h3>
                                                {position.category && (
                                                    <div className="text-xs text-slate-500">
                                                        {position.category}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Pill className="bg-white text-slate-600 ring-1 ring-slate-200">
                                                <Users className="h-3 w-3" />
                                                {position.total_candidates} candidates
                                            </Pill>
                                            <Pill className="bg-white text-slate-600 ring-1 ring-slate-200">
                                                <Vote className="h-3 w-3" />
                                                {position.total_votes} votes
                                            </Pill>
                                        </div>
                                    </div>

                                    <ol className="divide-y divide-slate-100">
                                        {[...position.candidates]
                                            .sort((a, b) => b.votes - a.votes)
                                            .map((candidate, idx) => {
                                                const barPct =
                                                    (candidate.votes / maxVotes) * 100;
                                                const share =
                                                    position.total_votes > 0
                                                        ? (candidate.votes /
                                                              position.total_votes) *
                                                          100
                                                        : 0;
                                                const isLeading = idx === 0 && isOngoing;
                                                const isWinner = idx === 0 && isFinished;
                                                const displayName = isOngoing
                                                    ? `Candidate ${String.fromCharCode(65 + idx)}`
                                                    : candidate.candidate_name;

                                                const top = isLeading || isWinner;
                                                const barTone = isWinner
                                                    ? "bg-emerald-500"
                                                    : isLeading
                                                      ? "bg-amber-400"
                                                      : "bg-slate-300";

                                                return (
                                                    <li
                                                        key={candidate.candidate_id}
                                                        className={`px-6 py-4 ${
                                                            isWinner
                                                                ? "bg-emerald-50/50"
                                                                : isLeading
                                                                  ? "bg-amber-50/40"
                                                                  : ""
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <span
                                                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                                                                    isWinner
                                                                        ? "bg-emerald-500 text-white"
                                                                        : isLeading
                                                                          ? "bg-amber-400 text-white"
                                                                          : "bg-slate-100 text-slate-500"
                                                                }`}
                                                            >
                                                                {isWinner ? (
                                                                    <Trophy className="h-4 w-4" />
                                                                ) : (
                                                                    idx + 1
                                                                )}
                                                            </span>

                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                                    <span
                                                                        className={`truncate ${
                                                                            top
                                                                                ? "font-semibold text-slate-900"
                                                                                : "font-medium text-slate-700"
                                                                        }`}
                                                                    >
                                                                        {displayName}
                                                                    </span>
                                                                    {!isFinished && isOngoing && (
                                                                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                                                            <Lock className="h-3 w-3" />
                                                                            Anonymous
                                                                        </span>
                                                                    )}
                                                                    {isLeading && (
                                                                        <Pill className="bg-amber-100 text-amber-800">
                                                                            <TrendingUp className="h-3 w-3" />
                                                                            Leading
                                                                        </Pill>
                                                                    )}
                                                                    {isWinner && (
                                                                        <Pill className="bg-emerald-100 text-emerald-800">
                                                                            <Trophy className="h-3 w-3" />
                                                                            Winner
                                                                        </Pill>
                                                                    )}
                                                                    {!isOngoing &&
                                                                        candidate.partylist &&
                                                                        candidate.partylist !== "Independent" && (
                                                                            <span className="text-xs text-slate-500">
                                                                                {candidate.partylist}
                                                                            </span>
                                                                        )}
                                                                </div>
                                                                <div className="mt-2">
                                                                    <Bar2
                                                                        value={barPct}
                                                                        className={barTone}
                                                                        height="h-2.5"
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="w-20 shrink-0 text-right">
                                                                <div className="text-xl font-semibold leading-none tabular-nums text-slate-900">
                                                                    {candidate.votes}
                                                                </div>
                                                                <div className="mt-1 text-xs tabular-nums text-slate-500">
                                                                    {Math.round(share)}%
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                    </ol>
                                </section>
                            );
                        })}
                    </div>
                )}

                {/* Footer note */}
                <section className="rounded-2xl bg-[#0F2A6B] p-6 text-slate-300 sm:p-8">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                            <ShieldCheck className="h-5 w-5 text-emerald-300" />
                        </span>
                        <h2 className="text-lg font-semibold text-white">
                            About these statistics
                        </h2>
                    </div>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            { icon: Vote, text: "Public. No login required." },
                            {
                                icon: RefreshCw,
                                text: isOngoing
                                    ? "Refreshes every 15 seconds."
                                    : "Final, locked results.",
                            },
                            {
                                icon: Lock,
                                text: isOngoing
                                    ? "Candidate names are hidden during voting."
                                    : "Candidate names and partylists are shown.",
                            },
                            {
                                icon: ShieldCheck,
                                text: "All counts are aggregate. Individual ballots stay private.",
                            },
                        ].map(({ icon: Icon, text }) => (
                            <div key={text} className="flex items-start gap-3">
                                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                                <p className="text-sm leading-relaxed">{text}</p>
                            </div>
                        ))}
                    </div>
                    <p className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-400">
                        Statistics shown: turnout, votes per hour, per-position
                        progress and recent activity.
                    </p>
                </section>
            </main>
        </div>
    );
};

export default PortalElectionLiveResults;