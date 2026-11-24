// resources/js/Portal/PortalLiveResults.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { publicResultsAPI, PublicElection } from "../api/publicResults";
import {
    Activity,
    ArrowLeft,
    ArrowUpRight,
    Calendar,
    CheckCircle2,
    Clock,
    Lock,
    RefreshCw,
    Search,
    ShieldCheck,
    TrendingUp,
    Trophy,
    Vote,
    X,
} from "lucide-react";

type FilterType = "all" | "CSG" | "SBO" | "ongoing" | "ended";
type StatusLabel = "Upcoming" | "Ended" | "Ongoing";

/* ------------------------------------------------------------------ */
/* Status helpers                                                      */
/* ------------------------------------------------------------------ */

const STATUS_STYLES = {
    Ongoing: {
        icon: Activity,
        chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        rail: "bg-emerald-500",
        bar: "bg-emerald-500",
        cta: "View live results",
        ctaIcon: TrendingUp,
    },
    Ended: {
        icon: CheckCircle2,
        chip: "bg-slate-100 text-slate-600 ring-slate-200",
        rail: "bg-slate-300",
        bar: "bg-slate-400",
        cta: "View final results",
        ctaIcon: Trophy,
    },
    Upcoming: {
        icon: Clock,
        chip: "bg-amber-50 text-amber-700 ring-amber-200",
        rail: "bg-amber-400",
        bar: "bg-amber-400",
        cta: "View election",
        ctaIcon: Calendar,
    },
} as const;

const getStatus = (election: PublicElection) => {
    const now = new Date();
    const start = new Date(election.voting_start);
    const end = new Date(election.voting_end);
    const label: StatusLabel =
        now < start ? "Upcoming" : now > end ? "Ended" : "Ongoing";
    return { label, ...STATUS_STYLES[label] };
};

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

const formatSpan = (ms: number) => {
    const mins = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(mins / 1440);
    const hours = Math.floor((mins % 1440) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
};

const getProgress = (election: PublicElection) => {
    const start = new Date(election.voting_start).getTime();
    const end = new Date(election.voting_end).getTime();
    const now = Date.now();
    if (end <= start) return 0;
    return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
};

const getTimeNote = (election: PublicElection, label: StatusLabel) => {
    const now = Date.now();
    if (label === "Ongoing")
        return `Closes in ${formatSpan(new Date(election.voting_end).getTime() - now)}`;
    if (label === "Upcoming")
        return `Opens in ${formatSpan(new Date(election.voting_start).getTime() - now)}`;
    return `Closed ${formatDate(election.voting_end)}`;
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const PortalLiveResults: React.FC = () => {
    const navigate = useNavigate();
    const [elections, setElections] = useState<PublicElection[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");
    const [search, setSearch] = useState("");
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchElections = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError("");
        try {
            const res = await publicResultsAPI.getElections();
            let data: any = res.data;
            if (data?.data) data = data.data;
            setElections(Array.isArray(data) ? data : []);
            setLastUpdated(new Date());
        } catch (err: any) {
            console.error("Failed to load elections:", err);
            setError(
                err.response?.data?.message ||
                    "Could not load elections. Please try again.",
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchElections();
    }, []);

    const filteredElections = useMemo(() => {
        let list = elections;
        if (filter === "CSG" || filter === "SBO") {
            list = list.filter((e) => e.election_type === filter);
        } else if (filter === "ongoing") {
            list = list.filter((e) => getStatus(e).label === "Ongoing");
        } else if (filter === "ended") {
            list = list.filter((e) => getStatus(e).label === "Ended");
        }
        if (search.trim()) {
            const term = search.toLowerCase();
            list = list.filter(
                (e) =>
                    e.title.toLowerCase().includes(term) ||
                    (e.description ?? "").toLowerCase().includes(term) ||
                    (e.course?.course_code ?? "").toLowerCase().includes(term),
            );
        }
        return [...list].sort((a, b) => {
            const order = { Ongoing: 0, Ended: 1, Upcoming: 2 } as const;
            const sa = getStatus(a).label;
            const sb = getStatus(b).label;
            if (order[sa] !== order[sb]) return order[sa] - order[sb];
            return (
                new Date(b.voting_end).getTime() -
                new Date(a.voting_end).getTime()
            );
        });
    }, [elections, filter, search]);

    const counts = useMemo(
        () => ({
            total: elections.length,
            ongoing: elections.filter((e) => getStatus(e).label === "Ongoing")
                .length,
            ended: elections.filter((e) => getStatus(e).label === "Ended")
                .length,
            upcoming: elections.filter(
                (e) => getStatus(e).label === "Upcoming",
            ).length,
        }),
        [elections],
    );

    const filterOptions: [FilterType, string][] = [
        ["all", "All"],
        ["ongoing", "Ongoing"],
        ["ended", "Ended"],
        ["CSG", "CSG"],
        ["SBO", "SBO"],
    ];

    const statCells = [
        { label: "Total", value: counts.total, icon: Vote, tone: "text-slate-900", iconTone: "text-blue-600 bg-blue-50" },
        { label: "Ongoing", value: counts.ongoing, icon: Activity, tone: "text-emerald-700", iconTone: "text-emerald-600 bg-emerald-50" },
        { label: "Ended", value: counts.ended, icon: CheckCircle2, tone: "text-slate-700", iconTone: "text-slate-600 bg-slate-100" },
        { label: "Upcoming", value: counts.upcoming, icon: Clock, tone: "text-amber-700", iconTone: "text-amber-600 bg-amber-50" },
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* ============================ HERO ============================ */}
            <header className="relative overflow-hidden bg-[#0F2A6B]">
                <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-16 sm:pb-20">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/")}
                        className="-ml-3 text-slate-300 hover:text-white hover:bg-white/10"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Portal
                    </Button>

                    <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-slate-200 ring-1 ring-white/15">
                                <span className="relative flex h-2.5 w-2.5">
                                    {counts.ongoing > 0 && (
                                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
                                    )}
                                    <span
                                        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                                            counts.ongoing > 0
                                                ? "bg-emerald-400"
                                                : "bg-slate-400"
                                        }`}
                                    />
                                </span>
                                {counts.ongoing > 0
                                    ? `${counts.ongoing} ${counts.ongoing === 1 ? "election" : "elections"} open for voting`
                                    : "No elections open right now"}
                            </div>

                            <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-[1.1]">
                                Election live results
                            </h1>
                            <p className="mt-2 max-w-xl text-sm sm:text-base leading-relaxed text-slate-300">
                                Follow the count as it happens. Open to
                                everyone, no login needed.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 lg:pb-1">
                            <div className="text-right leading-tight">
                                <div className="text-xs text-slate-400">
                                    Last updated
                                </div>
                                <div className="text-sm font-medium tabular-nums text-slate-100">
                                    {lastUpdated.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                    })}
                                </div>
                            </div>
                            <Button
                                onClick={() => fetchElections(true)}
                                disabled={refreshing}
                                className="h-11 rounded-xl bg-white px-5 font-medium text-[#0F2A6B] shadow-lg shadow-black/20 hover:bg-slate-100"
                            >
                                <RefreshCw
                                    className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                                />
                                {refreshing ? "Refreshing" : "Refresh"}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ============================ BODY ============================ */}
            <main className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 -mt-10 pb-16 space-y-6">
                {/* Stats: one connected strip */}
                <section
                    aria-label="Election summary"
                    className="grid grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-200"
                >
                    {statCells.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <div
                                key={s.label}
                                className={`flex items-center gap-4 p-5 sm:p-6 ${
                                    i % 2 === 1 ? "border-l border-slate-100" : ""
                                } ${i >= 2 ? "border-t lg:border-t-0 border-slate-100" : ""} ${
                                    i > 0 ? "lg:border-l" : ""
                                }`}
                            >
                                <span
                                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.iconTone}`}
                                >
                                    <Icon className="w-5 h-5" />
                                </span>
                                <div>
                                    <div
                                        className={`text-3xl font-semibold tabular-nums leading-none ${s.tone}`}
                                    >
                                        {loading ? "–" : s.value}
                                    </div>
                                    <div className="mt-1.5 text-sm text-slate-500">
                                        {s.label}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </section>

                {/* Filters */}
                <section className="flex flex-col gap-3 md:flex-row md:items-center">
                    <Tabs
                        value={filter}
                        onValueChange={(v) => setFilter(v as FilterType)}
                    >
                        <TabsList className="h-auto flex-wrap rounded-xl bg-slate-200/60 p-1">
                            {filterOptions.map(([val, label]) => (
                                <TabsTrigger
                                    key={val}
                                    value={val}
                                    className="rounded-lg px-4 py-2 text-slate-600 data-[state=active]:bg-[#123A8C] data-[state=active]:text-white data-[state=active]:shadow-md"
                                >
                                    {label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>

                    <div className="relative md:ml-auto md:w-full md:max-w-sm">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            aria-label="Search elections"
                            placeholder="Search by title or course"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-10 shadow-sm focus-visible:ring-blue-500"
                        />
                        {search && (
                            <button
                                type="button"
                                aria-label="Clear search"
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                                onClick={() => setSearch("")}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </section>

                {error && (
                    <div
                        role="alert"
                        className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                    >
                        {error}
                    </div>
                )}

                {/* Elections list (flat rows, no cards) */}
                {loading ? (
                    <div className="border-y border-slate-200 divide-y divide-slate-200">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex animate-pulse items-center gap-6 py-6">
                                <div className="h-4 w-1/3 rounded bg-slate-200" />
                                <div className="ml-auto h-4 w-24 rounded bg-slate-200" />
                            </div>
                        ))}
                    </div>
                ) : filteredElections.length === 0 ? (
                    <div className="border-y border-slate-200 py-16 text-center">
                        <Vote className="mx-auto h-9 w-9 text-slate-300" />
                        <h3 className="mt-4 text-lg font-semibold text-slate-800">
                            No elections match your filters
                        </h3>
                        <p className="mt-1 text-slate-500">
                            Clear the search or switch to another filter.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-5 rounded-xl"
                            onClick={() => {
                                setFilter("all");
                                setSearch("");
                            }}
                        >
                            Clear filters
                        </Button>
                    </div>
                ) : (
                    <section aria-label="Elections">
                        {/* column labels (desktop) */}
                        <div className="hidden lg:grid lg:grid-cols-[minmax(0,2.6fr)_110px_210px_190px_32px] lg:gap-6 px-4 pb-3 text-xs font-medium text-slate-500">
                            <span>Election</span>
                            <span>Type</span>
                            <span>Voting period</span>
                            <span>Status</span>
                            <span />
                        </div>

                        <ul className="border-y border-slate-200 divide-y divide-slate-200">
                            {filteredElections.map((election) => {
                                const status = getStatus(election);
                                const StatusIcon = status.icon;
                                const isLive = status.label === "Ongoing";
                                const isCSG = election.election_type === "CSG";
                                const go = () =>
                                    navigate(`/live-results/${election.election_id}`);

                                return (
                                    <li key={election.election_id}>
                                        <div
                                            role="link"
                                            tabIndex={0}
                                            aria-label={`${election.title}: ${status.cta}`}
                                            onClick={go}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    go();
                                                }
                                            }}
                                            className="group relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 px-4 py-5 transition-colors hover:bg-white focus-visible:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 lg:grid-cols-[minmax(0,2.6fr)_110px_210px_190px_32px]"
                                        >
                                            {/* status marker on the left edge */}
                                            <span
                                                aria-hidden
                                                className={`absolute inset-y-3 left-0 w-1 rounded-full ${status.rail}`}
                                            />

                                            {/* Election */}
                                            <div className="min-w-0 col-span-1">
                                                <h3 className="truncate text-base font-semibold text-slate-900 transition-colors group-hover:text-blue-700">
                                                    {election.title}
                                                </h3>
                                                {election.description && (
                                                    <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">
                                                        {election.description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* arrow (mobile sits top-right, desktop last column) */}
                                            <span className="row-start-1 col-start-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors group-hover:bg-blue-600 group-hover:text-white lg:col-start-5">
                                                <ArrowUpRight className="h-4 w-4" />
                                            </span>

                                            {/* Type */}
                                            <div className="col-span-2 flex items-center gap-2 text-sm lg:col-span-1 lg:col-start-2 lg:row-start-1">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 font-semibold ${
                                                        isCSG ? "text-blue-700" : "text-violet-700"
                                                    }`}
                                                >
                                                    <span
                                                        aria-hidden
                                                        className={`h-2 w-2 rounded-full ${
                                                            isCSG ? "bg-blue-600" : "bg-violet-600"
                                                        }`}
                                                    />
                                                    {election.election_type}
                                                </span>
                                                {election.course && (
                                                    <span className="text-slate-500">
                                                        {election.course.course_code}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Dates */}
                                            <div className="col-span-2 flex items-center gap-2 text-sm tabular-nums text-slate-600 lg:col-span-1 lg:col-start-3 lg:row-start-1">
                                                <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                                                <span>
                                                    {formatDate(election.voting_start)}
                                                    {" – "}
                                                    {formatDate(election.voting_end)}
                                                </span>
                                            </div>

                                            {/* Status */}
                                            <div className="col-span-2 lg:col-span-1 lg:col-start-4 lg:row-start-1">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${status.chip}`}
                                                    >
                                                        {isLive ? (
                                                            <span className="relative flex h-2 w-2">
                                                                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 motion-safe:animate-ping" />
                                                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                                            </span>
                                                        ) : (
                                                            <StatusIcon className="h-3.5 w-3.5" />
                                                        )}
                                                        {isLive ? "Live" : status.label}
                                                    </span>
                                                    <span className="text-xs tabular-nums text-slate-500">
                                                        {getTimeNote(election, status.label)}
                                                    </span>
                                                </div>
                                                {isLive && (
                                                    <div
                                                        role="progressbar"
                                                        aria-label="Voting period elapsed"
                                                        aria-valuemin={0}
                                                        aria-valuemax={100}
                                                        aria-valuenow={Math.round(getProgress(election))}
                                                        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-200"
                                                    >
                                                        <div
                                                            className={`h-full rounded-full ${status.bar}`}
                                                            style={{ width: `${getProgress(election)}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}

                {/* About */}
                <section className="rounded-2xl bg-[#0F2A6B] p-6 sm:p-8 text-slate-300">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                            <ShieldCheck className="h-5 w-5 text-emerald-300" />
                        </span>
                        <h2 className="text-lg font-semibold text-white">
                            How public results work
                        </h2>
                    </div>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            { icon: Vote, text: "Open to the public. No login required." },
                            { icon: RefreshCw, text: "Ongoing elections refresh every 15 seconds." },
                            { icon: Lock, text: "Ended elections show the final, locked count." },
                            { icon: ShieldCheck, text: "Candidate names stay hidden while voting is open, to keep it fair." },
                        ].map(({ icon: Icon, text }) => (
                            <div key={text} className="flex items-start gap-3">
                                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                                <p className="text-sm leading-relaxed">{text}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
};

export default PortalLiveResults;