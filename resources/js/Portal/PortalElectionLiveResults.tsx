// resources/js/Portal/PortalElectionLiveResults.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import {
    publicResultsAPI,
    LiveResultsPayload,
    LiveCandidateResult,
    PositionProgress,
} from "../api/publicResults";
import {
    Activity,
    ArrowLeft,
    Award,
    BarChart3,
    Calendar,
    CheckCircle,
    Clock,
    Crown,
    Loader2,
    Lock,
    RefreshCw,
    Sparkles,
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

const CHART_COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
];

// ------------------------------------------------------------
// Pie label renderer
// ------------------------------------------------------------
const renderPieLabel = (props: any): string => {
    const { name, percent } = props;
    if (!name) return "";
    return `${name}: ${((percent || 0) * 100).toFixed(0)}%`;
};

// ------------------------------------------------------------
// Main page
// ------------------------------------------------------------
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
                color: "bg-gray-100 text-gray-800",
                icon: CheckCircle,
            };
        if (data.is_ongoing)
            return {
                label: "Ongoing",
                color: "bg-green-100 text-green-800",
                icon: Activity,
            };
        return {
            label: "Upcoming",
            color: "bg-yellow-100 text-yellow-800",
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
                    progress_percentage:
                        progress?.progress_percentage ?? 0,
                    total_candidates: progress?.total_candidates ?? candidates.length,
                };
            },
        );
    }, [data]);

    const summary = data?.summary;

    // ---- Chart data builders ----
    const participationPieData = useMemo(() => {
        if (!summary) return [];
        return [
            {
                name: "Voted",
                value: summary.voted_count || 0,
                color: "#10b981",
            },
            {
                name: "Not Voted",
                value: summary.remaining_voters || 0,
                color: "#ef4444",
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
            <div className="min-h-screen bg-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">
                        Loading results...
                    </p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-blue-50 flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Vote className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Results Not Available
                    </h2>
                    <p className="text-gray-500 mb-5 text-sm">
                        {error ||
                            "We couldn't load results for this election."}
                    </p>
                    <div className="flex gap-2 justify-center">
                        <Button
                            variant="outline"
                            onClick={() => navigate("/live-results")}
                            className="rounded-xl"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            All Elections
                        </Button>
                        <Button
                            onClick={() => fetchResults(true)}
                            className="bg-blue-600 hover:bg-blue-700 rounded-xl"
                        >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Retry
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const StatusIcon = status?.icon ?? Clock;

    return (
        <div className="min-h-screen bg-blue-50">
            {/* ============================================================ */}
            {/* HEADER */}
            {/* ============================================================ */}
            <div className="relative overflow-hidden bg-blue-600 shadow-xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
                <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/live-results")}
                        className="text-white/80 hover:text-white hover:bg-white/10 -ml-2 mb-3"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        All Elections
                    </Button>

                    <div className="flex justify-between items-start flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {status && (
                                    <Badge
                                        className={`${status.color} border-0 px-3 py-1`}
                                    >
                                        <StatusIcon className="w-3 h-3 mr-1" />
                                        {status.label}
                                    </Badge>
                                )}
                                {data.election.election_type && (
                                    <Badge className="bg-white/20 text-white border-0 px-3 py-1">
                                        {data.election.election_type}
                                    </Badge>
                                )}
                                {isOngoing && (
                                    <Badge className="bg-green-500 text-white border-0 px-3 py-1">
                                        <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5 animate-pulse" />
                                        LIVE
                                    </Badge>
                                )}
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white">
                                {data.election.title}
                            </h1>
                            {data.election.description && (
                                <p className="text-blue-100 mt-1 max-w-2xl">
                                    {data.election.description}
                                </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-blue-100 text-xs">
                                <Calendar className="w-3.5 h-3.5" />
                                {data.election.voting_start
                                    ? new Date(
                                          data.election.voting_start,
                                      ).toLocaleString()
                                    : "—"}{" "}
                                –{" "}
                                {data.election.voting_end
                                    ? new Date(
                                          data.election.voting_end,
                                      ).toLocaleString()
                                    : "—"}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchResults(true)}
                                disabled={refreshing}
                                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                            >
                                <RefreshCw
                                    className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                                />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Polling indicator */}
                <div className="text-center text-xs text-gray-400 flex items-center justify-center gap-3">
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        {isOngoing
                            ? "Auto-refreshing every 15s"
                            : "Final results"}
                    </span>
                    <span>•</span>
                    <span>
                        Last updated {lastUpdated.toLocaleTimeString()}
                    </span>
                </div>

                {/* Anonymity notice */}
                {isOngoing && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                            <Lock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-yellow-800">
                                    Anonymous Results Mode
                                </p>
                                <p className="text-sm text-yellow-700">
                                    Candidate names are hidden until the
                                    election ends to keep voting fair.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* STATISTICS — SUMMARY PILLS */}
                {/* ============================================================ */}
                {summary && (
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
                            <Vote className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-gray-600">
                                Votes Cast
                            </span>
                            <span className="text-sm font-bold text-gray-900">
                                {summary.total_votes_cast}
                            </span>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                            <Users className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">
                                Eligible Voters
                            </span>
                            <span className="text-sm font-bold text-green-800">
                                {summary.total_voters}
                            </span>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-full">
                            <TrendingUp className="w-4 h-4 text-purple-600" />
                            <span className="text-sm font-medium text-purple-700">
                                Turnout
                            </span>
                            <span className="text-sm font-bold text-purple-800">
                                {summary.turnout_percentage}%
                            </span>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-full">
                            <Award className="w-4 h-4 text-orange-600" />
                            <span className="text-sm font-medium text-orange-700">
                                Positions
                            </span>
                            <span className="text-sm font-bold text-orange-800">
                                {summary.total_positions}
                            </span>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-full">
                            <User className="w-4 h-4 text-teal-600" />
                            <span className="text-sm font-medium text-teal-700">
                                Candidates
                            </span>
                            <span className="text-sm font-bold text-teal-800">
                                {summary.total_candidates}
                            </span>
                        </div>
                        {isOngoing && (
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-full">
                                <Zap className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-medium text-red-700">
                                    Last 30 min
                                </span>
                                <span className="text-sm font-bold text-red-800">
                                    {summary.recent_votes_30min}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* ============================================================ */}
                {/* STATISTICS — PROGRESS BAR */}
                {/* ============================================================ */}
                {summary && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-blue-600" />
                                Turnout Progress
                            </span>
                            <span className="text-sm font-bold text-blue-600">
                                {summary.turnout_percentage}%
                            </span>
                        </div>
                        <Progress
                            value={summary.turnout_percentage}
                            className="h-3 bg-gray-100"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>Voted: {summary.voted_count}</span>
                            <span>Total: {summary.total_voters}</span>
                            <span>Remaining: {summary.remaining_voters}</span>
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* STATISTICS — CHARTS */}
                {/* ============================================================ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Participation pie */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Vote className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                                Voter Participation
                            </span>
                            {isOngoing && (
                                <Badge className="bg-green-100 text-green-700 text-[10px] border-0 ml-auto">
                                    <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse" />
                                    Live
                                </Badge>
                            )}
                        </div>
                        {participationPieData.length > 0 ? (
                            <div className="h-[260px]">
                                <ResponsiveContainer
                                    width="100%"
                                    height="100%"
                                >
                                    <PieChart>
                                        <Pie
                                            data={participationPieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={95}
                                            paddingAngle={3}
                                            dataKey="value"
                                            label={renderPieLabel}
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
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">
                                No participation data yet
                            </div>
                        )}
                        {summary && (
                            <div className="mt-2 text-center">
                                <span className="text-sm text-gray-600">
                                    Turnout:{" "}
                                </span>
                                <span className="text-xl font-bold text-green-600">
                                    {summary.turnout_percentage}%
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Position progress bar chart */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-purple-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                                Position Progress
                            </span>
                            <Badge className="bg-purple-100 text-purple-700 text-[10px] border-0 ml-auto">
                                {positions.length} positions
                            </Badge>
                        </div>
                        {positionProgressChartData.length > 0 ? (
                            <div className="h-[260px]">
                                <ResponsiveContainer
                                    width="100%"
                                    height="100%"
                                >
                                    <BarChart
                                        data={positionProgressChartData}
                                        layout="vertical"
                                        margin={{ left: 10, right: 10 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            width={90}
                                            tick={{ fontSize: 10 }}
                                        />
                                        <Tooltip />
                                        <Legend />
                                        <Bar
                                            dataKey="votes"
                                            fill="#3b82f6"
                                            name="Votes Cast"
                                            radius={[0, 8, 8, 0]}
                                        />
                                        <Bar
                                            dataKey="candidates"
                                            fill="#10b981"
                                            name="Candidates"
                                            radius={[0, 8, 8, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[260px] flex items-center justify-center text-gray-500 text-sm">
                                No position data yet
                            </div>
                        )}
                    </div>
                </div>

                {/* ============================================================ */}
                {/* STATISTICS — VOTES PER HOUR */}
                {/* ============================================================ */}
                {votesPerHourChartData.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                                <Activity className="w-4 h-4 text-teal-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                                Votes Cast per Hour (Today)
                            </span>
                            <Badge className="bg-teal-100 text-teal-700 text-[10px] border-0 ml-auto">
                                {votesPerHourChartData.reduce(
                                    (sum, r) => sum + r.count,
                                    0,
                                )}{" "}
                                votes
                            </Badge>
                        </div>
                        <div className="h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={votesPerHourChartData}>
                                    <defs>
                                        <linearGradient
                                            id="hourGradient"
                                            x1="0"
                                            y1="0"
                                            x2="0"
                                            y2="1"
                                        >
                                            <stop
                                                offset="0%"
                                                stopColor="#14b8a6"
                                                stopOpacity={0.4}
                                            />
                                            <stop
                                                offset="100%"
                                                stopColor="#14b8a6"
                                                stopOpacity={0}
                                            />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#f0f0f0"
                                    />
                                    <XAxis
                                        dataKey="hour"
                                        tick={{ fontSize: 11 }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11 }}
                                        allowDecimals={false}
                                    />
                                    <Tooltip />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        stroke="#14b8a6"
                                        strokeWidth={2.5}
                                        fill="url(#hourGradient)"
                                        name="Votes"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* STATISTICS — PER-POSITION BREAKDOWN */}
                {/* ============================================================ */}
                {data.position_progress && data.position_progress.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <Award className="w-4 h-4 text-yellow-600" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                                Per-Position Statistics
                            </span>
                            <Badge className="bg-yellow-100 text-yellow-700 text-[10px] border-0 ml-auto">
                                {data.position_progress.length} positions
                            </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {data.position_progress.map((row, idx) => (
                                <div
                                    key={row.position_id}
                                    className={`p-4 rounded-xl border ${
                                        idx % 2 === 0
                                            ? "border-blue-100 bg-blue-50/30"
                                            : "border-purple-100 bg-purple-50/30"
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2 gap-2">
                                        <span className="font-semibold text-sm text-gray-900 truncate">
                                            {row.title}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] flex-shrink-0"
                                        >
                                            {row.progress_percentage}%
                                        </Badge>
                                    </div>
                                    <Progress
                                        value={row.progress_percentage}
                                        className="h-2"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                                        <span className="flex items-center gap-1">
                                            <Vote className="w-3 h-3" />
                                            {row.votes_cast} votes
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {row.total_candidates} candidates
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* CANDIDATE RESULTS PER POSITION */}
                {/* ============================================================ */}
                {positions.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                        <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-3 opacity-50" />
                        <p className="text-gray-500 font-medium">
                            No results available yet
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            {isFinished
                                ? "This election did not have any votes cast."
                                : "Results will appear as soon as voting begins."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {positions.map((position, pIdx) => {
                            const maxVotes =
                                Math.max(
                                    ...position.candidates.map(
                                        (c) => c.votes,
                                    ),
                                    1,
                                ) || 1;
                            return (
                                <div
                                    key={`${position.position_id}-${pIdx}`}
                                    className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
                                >
                                    <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                    pIdx === 0
                                                        ? "bg-yellow-100"
                                                        : "bg-blue-100"
                                                }`}
                                            >
                                                {pIdx === 0 ? (
                                                    <Crown className="w-4 h-4 text-yellow-600" />
                                                ) : (
                                                    <Award className="w-4 h-4 text-blue-600" />
                                                )}
                                            </div>
                                            <h3 className="font-bold text-gray-900">
                                                {position.title}
                                            </h3>
                                            {position.category && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs"
                                                >
                                                    {position.category}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className="bg-white text-xs"
                                            >
                                                {position.total_candidates}{" "}
                                                candidates
                                            </Badge>
                                            <Badge
                                                variant="outline"
                                                className="bg-white text-xs"
                                            >
                                                {position.total_votes} votes
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="p-5 space-y-4">
                                        {[...position.candidates]
                                            .sort(
                                                (a, b) => b.votes - a.votes,
                                            )
                                            .map((candidate, idx) => {
                                                const pct =
                                                    (candidate.votes /
                                                        maxVotes) *
                                                    100;
                                                const isLeading =
                                                    idx === 0 && isOngoing;
                                                const isWinner =
                                                    idx === 0 && isFinished;
                                                const displayName = isOngoing
                                                    ? `Candidate ${String.fromCharCode(65 + idx)}`
                                                    : candidate.candidate_name;

                                                return (
                                                    <div
                                                        key={
                                                            candidate.candidate_id
                                                        }
                                                        className="space-y-2"
                                                    >
                                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-medium text-gray-800">
                                                                    {
                                                                        displayName
                                                                    }
                                                                </span>
                                                                {!isFinished &&
                                                                    isOngoing && (
                                                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                                                            <Lock className="w-3 h-3" />
                                                                            Anonymous
                                                                        </span>
                                                                    )}
                                                                {isLeading && (
                                                                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                                                        <TrendingUp className="w-3 h-3 mr-1" />
                                                                        Leading
                                                                    </Badge>
                                                                )}
                                                                {isWinner && (
                                                                    <Badge className="bg-green-100 text-green-800 text-xs">
                                                                        <Trophy className="w-3 h-3 mr-1" />
                                                                        Winner
                                                                    </Badge>
                                                                )}
                                                                {!isOngoing &&
                                                                    candidate.partylist &&
                                                                    candidate.partylist !==
                                                                        "Independent" && (
                                                                        <span className="text-xs text-gray-500">
                                                                            (
                                                                            {
                                                                                candidate.partylist
                                                                            }
                                                                            )
                                                                        </span>
                                                                    )}
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-bold text-xl text-gray-900">
                                                                    {
                                                                        candidate.votes
                                                                    }
                                                                </span>
                                                                <span className="text-sm text-gray-500 w-12 text-right">
                                                                    {Math.round(
                                                                        pct,
                                                                    )}
                                                                    %
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Progress
                                                            value={pct}
                                                            className={`h-2.5 ${
                                                                idx === 0
                                                                    ? "bg-yellow-500"
                                                                    : ""
                                                            }`}
                                                        />
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer note */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-blue-800">
                                About These Statistics
                            </h4>
                            <ul className="text-sm text-blue-700 mt-2 space-y-1">
                                <li>• Public — no login required</li>
                                <li>
                                    • {isOngoing
                                        ? "Refreshes every 15 seconds"
                                        : "Final, locked results"}
                                </li>
                                <li>
                                    • {isOngoing
                                        ? "Candidate names hidden during voting"
                                        : "Candidate names and partylists shown"}
                                </li>
                                <li>
                                    • All counts are aggregate — individual
                                    ballots stay private
                                </li>
                                <li>
                                    • Statistics shown: turnout, votes per
                                    hour, per-position progress, and recent
                                    activity
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PortalElectionLiveResults;