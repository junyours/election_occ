// resources/js/api/partylists.ts
import axios from "./axios";

export interface Partylist {
    partylist_id: number;
    name: string;
    description?: string;
    logo_url?: string;
    candidates_count?: number;
    election_id: number;
    created_by_user_id?: number;
    created_at?: string;
    creator?: {
        user_id: number;
        first_name: string;
        last_name: string;
        email?: string;
        id_no?: string;
    };
    active_memberships?: Array<{
        membership_id: number;
        status: string;
        approved_at?: string;
        candidate: {
            candidate_id: number;
            user: {
                user_id: number;
                first_name: string;
                last_name: string;
                email?: string;
                id_no?: string;
                course?: {
                    course_code: string;
                    course_name: string;
                };
                year_level?: number;
                profile_photo?: string;
            };
            position?: {
                position_id: number;
                title: string;
                category?: string;
            };
        };
    }>;
    election?: {
        election_id: number;
        title: string;
        election_type: string;
        year: number;
        voting_start: string;
        voting_end: string;
        course?: {
            course_id: number;
            course_code: string;
            course_name: string;
        };
    };
}

export interface MembershipRequest {
    membership_id: number;
    candidate_id: number;
    partylist_id: number;
    status: "pending" | "approved" | "rejected";
    created_at: string;
    candidate?: {
        candidate_id: number;
        user: {
            user_id: number;
            first_name: string;
            last_name: string;
            email: string;
            id_no: string;
            profile_photo?: string;
            course?: { course_code: string; course_name: string };
            year_level?: number;
        };
        position?: {
            position_id: number;
            title: string;
        };
    };
    partylist?: {
        partylist_id: number;
        name: string;
    };
}

export const partylistAPI = {
    // ============================================================
    // Public read methods
    // ============================================================

    getAvailableYears: () => axios.get("/partylists/years"),

    getByYear: (year: number) =>
        axios.get(`/partylists?year=${year}`),

    getAll: (year?: number, electionId?: string | number) => {
        const params = new URLSearchParams();
        if (year) params.append("year", year.toString());
        if (electionId) params.append("election_id", electionId.toString());
        return axios.get(`/partylists?${params.toString()}`);
    },

    getById: (id: number) => axios.get(`/partylists/${id}`),

    getByElection: (electionId: string | number, year?: number) => {
        const params = new URLSearchParams();
        if (year) params.append("year", year.toString());
        return axios.get(
            `/partylists/election/${electionId}?${params.toString()}`,
        );
    },

    getCurrentYear: (electionId?: number) => {
        const params = new URLSearchParams();
        if (electionId) params.append("election_id", electionId.toString());
        return axios.get(`/partylists/current-year?${params.toString()}`);
    },

    // ============================================================
    // ✅ Membership Request methods (used by PartylistRequestManager)
    // ============================================================

    /**
     * Fetch pending membership requests for the current user's partylist.
     * Optional `{ status }` filter.
     */
    getMembershipRequests: (params?: { status?: string }) =>
        axios.get("/partylist/requests/pending", { params }),

    /**
     * Approve a specific membership request.
     */
    approveMembership: (membershipId: number) =>
        axios.put(`/partylist/requests/${membershipId}/approve`),

    /**
     * Reject a specific membership request.
     */
    rejectMembership: (membershipId: number) =>
        axios.put(`/partylist/requests/${membershipId}/reject`),

    /**
     * Get all requests for a specific partylist (admin/creator).
     */
    getPartylistRequests: (partylistId: number) =>
        axios.get(`/partylist/${partylistId}/requests`),

    /**
     * Get current user's membership status for an election.
     */
    getMyMembershipStatus: (electionId: number | string) =>
        axios.get(`/partylist/my-membership/${electionId}`),
};