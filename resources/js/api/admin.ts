// resources/js/api/admin.ts
import axios from "./axios";

export interface CreateElectionData {
    title: string;
    election_type: string;
    description?: string;
    voting_start: string;
    voting_end: string;
    course_id?: number;
    department?: string;
}

export interface CreatePositionData {
    election_id: string;
    title: string;
    category: string;
    max_winners: number;
    order_in_ballot: number;
}

export interface CreateUserData {
    first_name: string;
    last_name: string;
    email: string;
    id_no: string;
    course_id?: number | null;
    section_id?: number | null;
    year_level?: number | null;
    role: string;
    password?: string;
}

export interface AddBulkCandidatesData {
    election_id: number;
    candidates: Array<{
        user_id: number;
        position_id: number;
        partylist_id?: number | null;
    }>;
}

export interface BulkCandidatesResponse {
    success_count: number;
    fail_count: number;
    errors?: Array<{ user_id: number; error: string }>;
}

export const adminAPI = {
    // Election Management
    createElection: (data: CreateElectionData) =>
        axios.post("/admin/elections", data),
    deleteElection: (id: number) => axios.delete(`/admin/elections/${id}`),
    updateElection: (id: number, data: Partial<CreateElectionData>) =>
        axios.put(`/admin/elections/${id}`, data),

    // Position Management
    createPosition: (data: CreatePositionData) =>
        axios.post("/admin/positions", data),
    updatePosition: (id: number, data: Partial<CreatePositionData>) =>
        axios.put(`/admin/positions/${id}`, data),
    deletePosition: (id: number) => axios.delete(`/admin/positions/${id}`),
    getPositions: (electionId: number | string) =>
        axios.get(`/admin/positions/election/${electionId}`),

    // Partylist Management
    createPartylist: (data: FormData) =>
        axios.post("/admin/partylists", data, {
            headers: { "Content-Type": "multipart/form-data" },
        }),
    updatePartylist: (id: number, data: FormData) =>
        axios.post(`/admin/partylists/${id}`, data, {
            headers: { "Content-Type": "multipart/form-data" },
        }),
    deletePartylist: (id: number) => axios.delete(`/admin/partylists/${id}`),

    // Candidate Management
    updateCandidate: (id: number, data: any) =>
        axios.put(`/admin/candidates/${id}`, data),
    getAllCandidates: (params?: Record<string, unknown>) =>
        axios.get("/admin/candidates", { params }),
    addCandidate: (data: any) => axios.post("/admin/candidates/add", data),
    addBulkCandidates: (data: AddBulkCandidatesData) =>
        axios.post("/admin/candidates/bulk-add", data),
    removeCandidate: (candidateId: number) =>
        axios.delete(`/admin/candidates/${candidateId}`),

    // User Management
    getUsers: (params?: Record<string, unknown>) =>
        axios.get("/admin/users", { params }),
    getUsersPaginated: (params?: Record<string, unknown>) =>
        axios.get("/admin/users", { params }),

    createUser: (data: CreateUserData) => axios.post("/admin/users", data),
    updateUser: (id: number, data: Partial<CreateUserData>) =>
        axios.put(`/admin/users/${id}`, data),
    deleteUser: (id: number) => axios.delete(`/admin/users/${id}`),

    // ============================================================
    // ✅ Voter Management — NEW signatures
    // ============================================================
    /**
     * Get voters (no election id required).
     * Pass `{ page, per_page, search, status, course }` as params.
     */
    getVoters: (params?: Record<string, unknown>) =>
        axios.get("/admin/voters", { params }),

    /**
     * Get voter stats for a specific election.
     */
    getVoterStats: (electionId: number | string) =>
        axios.get(`/admin/voters/stats/${electionId}`),

    /**
     * Import voters from a file.
     */
    importVoters: (formData: FormData) =>
        axios.post("/admin/voters/import", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),

    /**
     * Get a specific user's receipt for an election.
     */
    getVoterReceipt: (
        electionId: number | string,
        userId: number | string,
    ) =>
        axios.get(`/admin/elections/${electionId}/voters/${userId}/receipt`),

    /**
     * Deactivate a voter.
     */
    removeVoter: (userId: number | string) =>
        axios.delete(`/admin/voters/${userId}`),

    // Reports
    getTurnoutReport: (electionId: number | string) =>
        axios.get(`/admin/reports/turnout/${electionId}`),
    getSanctionsList: (electionId: number | string) =>
        axios.get(`/admin/reports/sanctions/${electionId}`),
    getFullResults: (electionId: number | string) =>
        axios.get(`/admin/reports/results/${electionId}`),

    // Audit Logs
    getAuditLogs: (params?: Record<string, unknown>) =>
        axios.get("/admin/audit-logs", { params }),

    // Monitoring
    getMonitoringDashboard: (electionId: number | string) =>
        axios.get(`/monitoring/dashboard/${electionId}`),

    // Partylists
    getPartylists: (electionId: number | string) =>
        axios.get(`/admin/partylists/election/${electionId}`),

    getElectionAuditTrail: (electionId: number | string) =>
        axios.get(`/admin/audit-logs/election/${electionId}`),
};