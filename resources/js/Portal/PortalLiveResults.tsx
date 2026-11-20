// resources/js/Portal/PortalLiveResults.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { publicResultsAPI, PublicElection } from "../api/publicResults";
import {
    Activity,
    ArrowLeft,
    ArrowRight,
    Calendar,
    CheckCircle,
    Clock,
    Loader2,
    RefreshCw,
    Search,
    Sparkles,
    TrendingUp,
    Trophy,
    Vote,
    X,
} from "lucide-react";

type FilterType = "all" | "CSG" | "SBO" | "ongoing" | "ended";

const getStatus = (election: PublicElection) => {
    const now = new Date();
    const start = new Date(election.voting_start);
    const end = new Date(election.voting_end);
    if (now < start)
        return {
            label: "Upcoming",
            color: "bg-yellow-100 text-yellow-800",
            icon: Clock,
        };
    if (now > end)
        return {
            label: "Ended",
            color: "bg-gray-100 text-gray-800",
            icon: CheckCircle,
        };
    return {
        label: "Ongoing",
        color: "bg-green-100 text-green-800",
        icon: Activity,
    };
};

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
        return list.sort((a, b) => {
            const order = { Ongoing: 0, Ended: 1, Upcoming: 2 } as const;
            const sa = getStatus(a).label as keyof typeof order;
            const sb = getStatus(b).label as keyof typeof order;
            if (order[sa] !== order[sb]) return order[sa] - order[sb];
            return (
                new Date(b.voting_end).getTime() -
                new Date(a.voting_end).getTime()
            );
        });
    }, [elections, filter, search]);

    const counts = useMemo(() => {
        return {
            total: elections.length,
            ongoing: elections.filter((e) => getStatus(e).label === "Ongoing")
                .length,
            ended: elections.filter((e) => getStatus(e).label === "Ended")
                .length,
            upcoming: elections.filter(
                (e) => getStatus(e).label === "Upcoming",
            ).length,
        };
    }, [elections]);

    return (
        <div className="min-h-screen bg-blue-50">
            {/* Header */}
            <div className="relative overflow-hidden bg-blue-600 shadow-xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-2xl" />
                <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate("/")}
                                className="text-white/80 hover:text-white hover:bg-white/10 -ml-2 mb-2"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Portal
                            </Button>
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-5 h-5 text-yellow-300" />
                                <Badge className="bg-white/20 text-white border-0">
                                    Public Live Results
                                </Badge>
                            </div>
                            <h1 className="text-3xl font-bold text-white">
                                Election Live Results
                            </h1>
                            <p className="text-blue-100 mt-1">
                                Watch the counts update in real time. No login
                                required.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge className="bg-white/20 text-white border-0 px-4 py-2">
                                <Vote className="w-4 h-4 mr-1" />
                                {counts.total} Elections
                            </Badge>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchElections(true)}
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
                {/* Stats pills */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
                        <Vote className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-600">
                            Total
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                            {counts.total}
                        </span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                        <Activity className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                            Ongoing
                        </span>
                        <span className="text-sm font-bold text-green-800">
                            {counts.ongoing}
                        </span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-full">
                        <CheckCircle className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                            Ended
                        </span>
                        <span className="text-sm font-bold text-gray-800">
                            {counts.ended}
                        </span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-full">
                        <Clock className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-700">
                            Upcoming
                        </span>
                        <span className="text-sm font-bold text-yellow-800">
                            {counts.upcoming}
                        </span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm ml-auto">
                        <span className="text-xs text-gray-500">
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
                    <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                        <Tabs
                            value={filter}
                            onValueChange={(v) => setFilter(v as FilterType)}
                        >
                            <TabsList className="bg-gray-100 p-1 rounded-xl flex-wrap h-auto">
                                {[
                                    ["all", "All"],
                                    ["ongoing", "Ongoing"],
                                    ["ended", "Ended"],
                                    ["CSG", "CSG"],
                                    ["SBO", "SBO"],
                                ].map(([val, label]) => (
                                    <TabsTrigger
                                        key={val}
                                        value={val}
                                        className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                                    >
                                        {label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                        <div className="relative flex-1 md:max-w-sm ml-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search elections..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 rounded-xl bg-gray-50 border-gray-200"
                            />
                            {search && (
                                <button
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                    onClick={() => setSearch("")}
                                >
                                    <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div
                                key={i}
                                className="h-52 bg-white border border-gray-200 rounded-2xl animate-pulse"
                            />
                        ))}
                    </div>
                ) : filteredElections.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Vote className="w-10 h-10 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">
                            No elections match your filters
                        </h3>
                        <p className="text-gray-500">
                            Try clearing the search or switching filters.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-4 rounded-xl"
                            onClick={() => {
                                setFilter("all");
                                setSearch("");
                            }}
                        >
                            Clear filters
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredElections.map((election) => {
                            const status = getStatus(election);
                            const StatusIcon = status.icon;
                            return (
                                <div
                                    key={election.election_id}
                                    className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer group overflow-hidden"
                                    onClick={() =>
                                        navigate(
                                            `/live-results/${election.election_id}`,
                                        )
                                    }
                                >
                                    <div
                                        className={`h-1.5 ${
                                            election.election_type === "CSG"
                                                ? "bg-blue-600"
                                                : "bg-green-600"
                                        }`}
                                    />
                                    <div className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                    <Badge
                                                        className={`${status.color} border-0`}
                                                    >
                                                        <StatusIcon className="w-3 h-3 mr-1" />
                                                        {status.label}
                                                    </Badge>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-xs"
                                                    >
                                                        {election.election_type}
                                                    </Badge>
                                                    {election.course && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {
                                                                election.course
                                                                    .course_code
                                                            }
                                                        </Badge>
                                                    )}
                                                </div>
                                                <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                                                    {election.title}
                                                </h3>
                                                {election.description && (
                                                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                                                        {election.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center text-xs text-gray-500">
                                            <Calendar className="w-3.5 h-3.5 mr-1.5" />
                                            {new Date(
                                                election.voting_start,
                                            ).toLocaleDateString()}{" "}
                                            –{" "}
                                            {new Date(
                                                election.voting_end,
                                            ).toLocaleDateString()}
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                                            <span className="text-sm font-bold text-blue-600 flex items-center gap-1">
                                                {status.label === "Ended" ? (
                                                    <>
                                                        <Trophy className="w-4 h-4" />
                                                        View Final Results
                                                    </>
                                                ) : status.label ===
                                                  "Ongoing" ? (
                                                    <>
                                                        <TrendingUp className="w-4 h-4" />
                                                        View Live Results
                                                    </>
                                                ) : (
                                                    <>
                                                        <Calendar className="w-4 h-4" />
                                                        View Election
                                                    </>
                                                )}
                                            </span>
                                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-blue-800">
                                About Public Live Results
                            </h4>
                            <ul className="text-sm text-blue-700 mt-2 space-y-1">
                                <li>
                                    • Open to the public — no login required
                                </li>
                                <li>
                                    • Ongoing elections refresh every 15
                                    seconds automatically
                                </li>
                                <li>
                                    • Ended elections show the final, locked
                                    count
                                </li>
                                <li>
                                    • Candidate names are hidden while an
                                    election is ongoing to keep voting fair
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PortalLiveResults;