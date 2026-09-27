// resources/js/api/votes.ts
import axios from "./axios";
import { ApiResponse, Vote, VoteReceipt } from "../types";

export interface CastVoteData {
    votes: Array<{
        position_id: number;
        candidate_id: number;
    }>;
}

export interface VoteStatusResponse {
    success: boolean;
    is_registered: boolean;
    is_eligible?: boolean;
    has_voted: boolean;
    voted_at?: string | null;
    sanction_eligible?: boolean;
}

export const voteAPI = {
    castVote: (
        electionId: number | string,
        votes: CastVoteData,
    ): Promise<ApiResponse<VoteReceipt>> =>
        axios.post(`/elections/${electionId}/vote`, votes),

    checkStatus: (
        electionId: number | string,
    ): Promise<{ data: VoteStatusResponse }> =>
        axios.get(`/elections/${electionId}/vote-status`),

    getReceipt: (
        electionId: number | string,
    ): Promise<ApiResponse<VoteReceipt>> =>
        axios.get(`/elections/${electionId}/receipt`),

    resendReceipt: (electionId: number | string) =>
        axios.post(`/elections/${electionId}/resend-receipt`),

    getHistory: (): Promise<ApiResponse<Vote[]>> =>
        axios.get("/votes/history"),

    /**
     * Get candidate vote tickets for admins/comelec.
     */
    getCandidateVoteTickets: (
        electionId: number | string,
        candidateId: number | string,
    ) =>
        axios.get(
            `/elections/${electionId}/candidates/${candidateId}/tickets`,
        ),

    /**
     * Get election statistics (admin / comelec).
     */
    getStatistics: (electionId: number | string) =>
        axios.get(`/elections/${electionId}/statistics`),

    /**
     * Get turnout summary (admin / comelec).
     */
    getTurnoutSummary: (electionId: number | string) =>
        axios.get(`/elections/${electionId}/turnout-summary`),
};

export const voteService = voteAPI;