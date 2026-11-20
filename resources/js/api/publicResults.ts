// resources/js/api/publicResults.ts
import axios from "./axios";

export interface PublicElection {
    election_id: number;
    title: string;
    election_type: "CSG" | "SBO";
    description?: string | null;
    voting_start: string;
    voting_end: string;
    course?: {
        course_id: number;
        course_code: string;
        course_name: string;
    } | null;
    status?: "upcoming" | "ongoing" | "ended";
    is_ongoing?: boolean;
}

export interface LiveCandidateResult {
    candidate_id: number;
    candidate_name: string;
    partylist: string;
    votes: number;
    photo_url?: string | null;
}

export interface PositionProgress {
    position_id: number;
    title: string;
    category: string;
    total_candidates: number;
    votes_cast: number;
    progress_percentage: number;
}

export interface VotesPerHour {
    hour: number;
    count: number;
}

export interface LiveSummary {
    total_voters: number;
    voted_count: number;
    remaining_voters: number;
    total_votes_cast: number;
    turnout_percentage: number;
    total_positions: number;
    total_candidates: number;
    recent_votes_30min: number;
}

export interface LiveResultsPayload {
    election: {
        election_id: number;
        title: string;
        election_type?: string;
        description?: string | null;
        voting_start?: string;
        voting_end?: string;
        is_ongoing?: boolean;
        is_finished?: boolean;
        course?: {
            course_id: number;
            course_code: string;
            course_name: string;
        } | null;
    };
    is_ongoing: boolean;
    is_finished: boolean;
    live_results: Record<string, LiveCandidateResult[]>;
    summary: LiveSummary;
    position_progress: PositionProgress[];
    votes_per_hour: VotesPerHour[];
    last_updated: string;
}

export const publicResultsAPI = {
    getElections: (): Promise<{ data: PublicElection[] }> =>
        axios.get("/public/elections"),

    getLiveResults: (id: number): Promise<{ data: LiveResultsPayload }> =>
        axios.get(`/public/elections/${id}/live-results`),

    getFinalResults: (id: number): Promise<{ data: LiveResultsPayload }> =>
        axios.get(`/public/elections/${id}/results`),
};