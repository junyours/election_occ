// resources/js/pages/Candidacy/CandidacyAvailableElection.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { candidacyAPI } from "../api/candidacy";
import {
    Calendar,
    UserPlus,
    Clock,
    CheckCircle,
    AlertCircle,
    Loader2,
    Award,
    Eye,
    Sparkles,
    Lock,
} from "lucide-react";

interface AvailableElection {
    election_id: number;
    title: string;
    election_type: string;
    description?: string;
    voting_start: string;
    voting_end: string;
    course?: {
        course_id: number;
        course_code: string;
        course_name: string;
    };
    is_available: boolean;
}

const CandidacyAvailableElection: React.FC = () => {
    const navigate = useNavigate();
    const [elections, setElections] = useState<AvailableElection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchAvailableElections();
    }, []);

    const fetchAvailableElections = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await candidacyAPI.getAvailableElections();
            const data = response.data.available || response.data || [];
            setElections(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error("Failed to fetch available elections:", err);
            setError(
                err.response?.data?.message ||
                    "Failed to load available elections",
            );
        } finally {
            setLoading(false);
        }
    };

    // ✅ Only elections whose voting hasn't started are open for applications
    const isElectionOpen = (election: AvailableElection): boolean => {
        const now = Date.now();
        const start = new Date(election.voting_start).getTime();
        return now < start;
    };

    const openElections = elections.filter(isElectionOpen);
    const closedElections = elections.filter((e) => !isElectionOpen(e));

    const handleApply = (electionId: number) => {
        window.open(`/apply-candidacy/${electionId}`, "_blank");
    };

    if (loading) {
        return (
            <div className="min-h-[400px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="relative rounded-2xl overflow-hidden bg-blue-600 shadow-xl">
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="relative px-6 py-8">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-yellow-300" />
                        <Badge className="bg-white/20 text-white border-0">
                            Candidacy Applications
                        </Badge>
                    </div>
                    <h1 className="text-3xl font-bold text-white">
                        Available Elections
                    </h1>
                    <p className="text-blue-100 mt-1">
                        Browse and apply for candidacy in open elections
                    </p>
                </div>
            </div>

            {/* Error Alert */}
            {error && (
                <Alert variant="destructive" className="rounded-xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Stats Pills */}
            <div className="flex flex-wrap items-center gap-3 py-1">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm">
                    <Award className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">
                        Total Elections
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                        {elections.length}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
                        Open
                    </span>
                    <span className="text-sm font-bold text-green-800">
                        {openElections.length}
                    </span>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-full">
                    <Lock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-600">
                        Closed
                    </span>
                    <span className="text-sm font-bold text-gray-700">
                        {closedElections.length}
                    </span>
                </div>
            </div>

            {/* Open Elections */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h2 className="text-lg font-bold text-gray-900">
                        Open for Applications
                    </h2>
                    <Badge className="bg-green-100 text-green-700">
                        {openElections.length}
                    </Badge>
                </div>

                {openElections.length === 0 ? (
                    <Card className="border-0 shadow-lg rounded-xl">
                        <CardContent className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Award className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-1">
                                No Open Elections
                            </h3>
                            <p className="text-gray-500 text-sm">
                                There are no elections currently accepting
                                candidacy applications.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {openElections.map((election) => (
                            <Card
                                key={election.election_id}
                                className="border-0 shadow-lg rounded-xl overflow-hidden hover:shadow-xl transition-shadow"
                            >
                                <div className="h-1.5 bg-blue-600" />
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-900 text-lg">
                                                {election.title}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <Badge variant="outline">
                                                    {election.election_type}
                                                </Badge>
                                                {election.course && (
                                                    <Badge
                                                        variant="outline"
                                                        className="bg-gray-50"
                                                    >
                                                        {
                                                            election.course
                                                                .course_code
                                                        }
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Badge className="bg-green-100 text-green-700 border-0">
                                            <UserPlus className="w-3 h-3 mr-1" />
                                            Open
                                        </Badge>
                                    </div>

                                    {election.description && (
                                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                                            {election.description}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(
                                                election.voting_start,
                                            ).toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(
                                                election.voting_end,
                                            ).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-3 border-t">
                                        <Button
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl"
                                            size="sm"
                                            onClick={() =>
                                                handleApply(
                                                    election.election_id,
                                                )
                                            }
                                        >
                                            <UserPlus className="w-4 h-4 mr-2" />
                                            Apply Now
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-xl"
                                            onClick={() =>
                                                navigate(
                                                    `/elections/${election.election_id}`,
                                                )
                                            }
                                        >
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Closed Elections (voting already started/ended) */}
            {closedElections.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Lock className="w-5 h-5 text-gray-500" />
                        <h2 className="text-lg font-bold text-gray-900">
                            Applications Closed
                        </h2>
                        <Badge className="bg-gray-100 text-gray-700">
                            {closedElections.length}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {closedElections.map((election) => (
                            <Card
                                key={election.election_id}
                                className="border-0 shadow-md rounded-xl overflow-hidden opacity-75"
                            >
                                <div className="h-1.5 bg-gray-400" />
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-700 text-lg">
                                                {election.title}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <Badge variant="outline">
                                                    {election.election_type}
                                                </Badge>
                                                {election.course && (
                                                    <Badge
                                                        variant="outline"
                                                        className="bg-gray-50"
                                                    >
                                                        {
                                                            election.course
                                                                .course_code
                                                        }
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Badge className="bg-gray-100 text-gray-700 border-0">
                                            <Lock className="w-3 h-3 mr-1" />
                                            Closed
                                        </Badge>
                                    </div>

                                    {election.description && (
                                        <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                                            {election.description}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(
                                                election.voting_start,
                                            ).toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(
                                                election.voting_end,
                                            ).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full rounded-xl"
                                            onClick={() =>
                                                navigate(
                                                    `/elections/${election.election_id}`,
                                                )
                                            }
                                        >
                                            <Eye className="w-4 h-4 mr-2" />
                                            View Election
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CandidacyAvailableElection;