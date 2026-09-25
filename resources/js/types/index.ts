// src/types/index.ts

// ============================================================
// USER & RELATED
// ============================================================

export interface User {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    id_no: string;
    course: string | Course;
    year_level: number;
    role: "admin" | "comelec" | "candidate" | "voter";
    profile_photo?: string;
    is_face_registered?: boolean;

    // Personal info
    birthdate?: string | null;
    age?: number | null;
    present_address?: string | null;
    present_address_2?: string | null;
    no_unit_load?: number | null;
    cellphone?: string | null;
    social_media?: string | null;

    // Optional relations
    course_id?: number;
    section_id?: number;
    section?: CourseSection | null;
    is_active?: boolean;
    full_name?: string;
}

export interface Course {
    course_id: number;
    course_code: string;
    course_name: string;
    department?: string;
    is_active?: boolean;
}

export interface CourseSection {
    section_id: number;
    course_id: number;
    section_code: string;
    section_name: string;
    year_level: number;
    capacity?: number;
    is_active?: boolean;
    course?: Course;
    display_name?: string;
}

// ============================================================
// ELECTIONS
// ============================================================

export interface Election {
    election_id: number;
    title: string;
    election_type: "CSG" | "SBO";
    year?: number;
    department?: string | null;
    description?: string;
    voting_start: string;
    voting_end: string;
    course_id?: number;
    course?: Course;
    is_active?: boolean;
    status?: "upcoming" | "ongoing" | "ended";
    is_ongoing?: boolean;
    total_voters?: number;
    votes_cast?: number;
    positions?: Position[];
    partylists?: Partylist[];
    candidates?: Candidate[];
    created_by?: {
        user_id: number;
        first_name: string;
        last_name: string;
    };
}

export interface Position {
    position_id: number;
    election_id: number;
    title: string;
    category?: string;
    position_type?: string;
    max_winners: number;
    order_in_ballot: number;
    description?: string;
    candidates_count?: number;
    created_at?: string;
}

export interface Partylist {
    partylist_id: number;
    election_id: number;
    name: string;
    description?: string;
    logo_url?: string;
    platform?: string;
    candidates_count?: number;
    created_by_user_id?: number;
    approved_by_user_id?: number;
    creator?: User;
    active_memberships?: PartylistMembership[];
    election?: Election;
}

export interface PartylistMembership {
    membership_id: number;
    partylist_id: number;
    candidate_id: number;
    status: "pending" | "approved" | "rejected";
    approved_at?: string | null;
    approved_by_user_id?: number | null;
    is_active: boolean;
    created_at?: string;
    candidate?: Candidate;
    partylist?: Partylist;
}

export interface Candidate {
    candidate_id: number;
    user_id: number;
    election_id: number;
    position_id: number;
    partylist_id?: number;
    platform?: string;
    qualifications?: string;
    photo_url?: string;
    is_approved: boolean;
    approved_by_user_id?: number;
    approved_at?: string;
    user?: User;
    position?: Position;
    partylist?: Partylist;
    vote_count?: number;
}

// ============================================================
// ✅ VOTING & PARTICIPATION (replaces voter_registries)
// ============================================================

export interface Vote {
    vote_id: number;
    election_id: number;
    user_id: number;
    candidate_id: number;
    position_id: number;
    timestamp: string;
}

export interface ElectionParticipation {
    participation_id: number;
    election_id: number;
    user_id: number;
    has_voted: boolean;
    voted_at?: string | null;
    sanction_eligible: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface DigitalReceipt {
    receipt_id: number;
    election_id: number;
    user_id: number;
    receipt_code: string;
    sent_to_email: string;
    generated_at: string;
}

export interface VoteReceipt {
    receipt_id?: number;
    receipt_code: string;
    election_title: string;
    votes_cast: Array<{
        position: string;
        candidate_name: string;
        partylist?: string;
        timestamp: string;
    }>;
    generated_at: string;
    sent_to_email: string;
}

/**
 * ✅ Voter — a user who is eligible to vote in an election.
 * Computed from users + election_participations, no registry needed.
 */
export interface Voter {
    user_id: number;
    id_no: string;
    first_name: string;
    last_name: string;
    email: string;
    course?: Course | string | null;
    year_level?: number | null;
    has_voted?: boolean;
    voted_at?: string | null;
}

// ============================================================
// MONITORING / STATS
// ============================================================

export interface LiveResults {
    election: {
        election_id: number;
        title: string;
    };
    is_ongoing: boolean;
    results?: Record<
        string,
        Array<{
            candidate_id: number;
            candidate_name: string;
            partylist: string;
            votes: number;
        }>
    >;
    live_results?: Record<
        string,
        Array<{
            candidate_id: number;
            candidate_name: string;
            partylist: string;
            votes: number;
        }>
    >;
    summary?: {
        total_votes_cast: number;
        total_voters: number;
        voted_count?: number;
        turnout_percentage: number;
    };
}

export interface CandidateResult {
    candidate_id: number;
    candidate_name: string;
    partylist: string;
    votes: number;
    partylist_id?: number;
    photo_url?: string;
}

export interface PositionResult {
    position_id: number;
    position_title: string;
    category: string;
    candidates: CandidateResult[];
    total_votes: number;
}

export interface MonitoringData {
    election: {
        election_id: number;
        title: string;
    };
    is_ongoing: boolean;
    statistics: {
        turnout_percentage: number;
        total_voters: number;
        voted_count: number;
        turnover_percentage?: number;
        remaining_voters: number;
        total_candidates?: number;
        total_positions?: number;
    };
    position_progress: Array<{
        position_id: number;
        title: string;
        total_candidates: number;
        votes_cast: number;
        progress_percentage: number;
    }>;
    recent_activity: {
        last_30_minutes: number;
    };
    last_updated?: string;
}

export interface TurnoutByCourse {
    course: string | Course;
    total: number;
    voted: number;
    percentage?: number;
}

export interface TurnoutReport {
    total_voters: number;
    voted_count: number;
    turnout_percentage: number;
    remaining_voters: number;
    breakdown_by_course?: TurnoutByCourse[];
    breakdown_by_year?: Array<{
        year_level: number;
        total: number;
        voted: number;
    }>;
    breakdown?: {
        by_course: TurnoutByCourse[];
        by_year: Array<{
            year_level: number;
            total: number;
            voted: number;
            percentage?: number;
        }>;
    };
    last_updated?: string;
}

export interface VoterStats {
    total_voters: number;
    voted_count: number;
    not_voted_count: number;
    turnout_percentage: number;
    breakdown_by_course?: TurnoutByCourse[];
}

export interface SanctionsList {
    total_eligible_voters: number;
    total_non_voters: number;
    non_voters_list: NonVoter[];
}

export interface NonVoter {
    id_no: string;
    first_name: string;
    last_name: string;
    email: string;
    course: string | Course;
    year_level: number;
}

// ============================================================
// FEEDBACK
// ============================================================

export interface Feedback {
    feedback_id: number;
    user_id: number;
    election_id: number;
    category_id?: number;
    rating: number;
    title?: string;
    comment: string;
    is_public: boolean;
    is_anonymous: boolean;
    helpful_count: number;
    admin_response?: string;
    responded_by?: number;
    responded_at?: string;
    status?: "pending" | "approved" | "rejected" | "featured";
    created_at: string;
    user?: User;
    election?: Election;
    category?: FeedbackCategory;
}

export interface FeedbackCategory {
    category_id: number;
    category_name: string;
    description?: string;
    display_order: number;
    is_active: boolean;
}

// ============================================================
// COMMENTS
// ============================================================

export interface Comment {
    comment_id: number;
    election_id: number;
    user_id: number;
    comment_text: string;
    is_visible: boolean;
    created_at: string;
    moderated_by_user_id?: number;
    moderated_at?: string;
    user?: User;
}

// ============================================================
// CAMPAIGN
// ============================================================

export interface CampaignSchedule {
    schedule_id: number;
    election_id: number;
    section_id: number;
    start_time: string;
    end_time: string;
    candidate_id?: number;
    notes?: string;
    status?: "pending" | "ongoing" | "completed" | "cancelled";
    created_by_user_id?: number;
}

// ============================================================
// AUTH
// ============================================================

export interface PasswordChangeData {
    current_password: string;
    new_password: string;
    confirm_password: string;
}

export interface ForgotPasswordData {
    email: string;
}

export interface ResetPasswordData {
    email: string;
    token: string;
    password: string;
    password_confirmation: string;
}

// ============================================================
// AUDIT LOG
// ============================================================

export interface AuditLog {
    log_id: number;
    user_id?: number;
    action_type: string;
    target_table?: string;
    target_id?: number;
    old_value?: any;
    new_value?: any;
    ip_address?: string;
    user_agent?: string;
    timestamp: string;
    user?: User;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T = any> {
    message?: string;
    data?: T;
    errors?: Record<string, string[]>;
}

export interface AuthResponse {
    success: boolean;
    message?: string;
    token: string;
    user: User;
    role?: string;
}

export interface PaginatedResponse<T = any> {
    current_page: number;
    data: T[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    links: Array<{ url: string | null; label: string; active: boolean }>;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
}

export interface ApiError {
    response?: {
        data?: {
            message?: string;
            errors?: Record<string, string[]>;
            success?: boolean;
        };
        status?: number;
    };
    message?: string;
}