// resources/js/pages/Timeline.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../components/ui/dialog";
import { campaignPostAPI, CampaignPost } from "../api/campaignPosts";
import { electionAPI } from "../api/elections";
import { RefreshButton } from "../components/common/RefreshButton";
import {
    MessageCircle,
    ThumbsUp,
    Pin,
    Calendar,
    Send,
    X,
    Loader2,
    Sparkles,
    ChevronDown,
    Heart,
} from "lucide-react";
import thumbsup from "../assets/emojis/ThumbsUp.png";
import redheart from "../assets/emojis/Red Heart.png";
import facetears from "../assets/emojis/Face with Tears of Joy.png";
import facewow from "../assets/emojis/Face with Open Mouth.png";
import cryface from "../assets/emojis/Crying Face.png";
import angryface from "../assets/emojis/Angry Face.png";

interface Election {
    election_id: number;
    title: string;
}

// ✅ Reaction types with animated emojis and colors
const REACTION_TYPES = {
    like: {
        label: "Like",
        emoji: "👍",
        emojiUrl: thumbsup,
        color: "text-blue-500",
        bg: "bg-blue-50",
    },
    heart: {
        label: "Love",
        emoji: "❤️",
        emojiUrl: redheart,
        color: "text-red-500",
        bg: "bg-red-50",
    },
    laugh: {
        label: "Haha",
        emoji: "😂",
        emojiUrl: facetears,
        color: "text-yellow-500",
        bg: "bg-yellow-50",
    },
    wow: {
        label: "Wow",
        emoji: "😮",
        emojiUrl: facewow,
        color: "text-purple-500",
        bg: "bg-purple-50",
    },
    sad: {
        label: "Sad",
        emoji: "😢",
        emojiUrl: cryface,
        color: "text-blue-400",
        bg: "bg-blue-50",
    },
    angry: {
        label: "Angry",
        emoji: "😡",
        emojiUrl: angryface,
        color: "text-red-600",
        bg: "bg-red-50",
    },
};

// Small helper so every reaction image degrades to the plain unicode
// character if the animated asset ever fails to load (offline, blocked host, etc).
const ReactionEmoji: React.FC<{
    type: ReactionType;
    className?: string;
    style?: React.CSSProperties;
}> = ({ type, className, style }) => {
    const reaction = REACTION_TYPES[type];
    const [failed, setFailed] = useState(false);
    if (failed) {
        return (
            <span className={className} style={style}>
                {reaction.emoji}
            </span>
        );
    }
    return (
        <img
            src={reaction.emojiUrl}
            alt={reaction.label}
            draggable={false}
            className={className}
            style={style}
            onError={() => setFailed(true)}
        />
    );
};

type ReactionType = keyof typeof REACTION_TYPES;

const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "Just now";
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;
    return date.toLocaleDateString();
};

// ✅ Reaction picker component - positioned above the button.
// Supports both a real mouse hover (desktop) and a JS-driven "hoveredKey"
// so a finger dragging across it on touch devices highlights the same way.
const ReactionPicker: React.FC<{
    onSelect: (type: ReactionType) => void;
    onClose: () => void;
    currentReaction?: ReactionType;
    isVisible: boolean;
    buttonRef: React.RefObject<HTMLButtonElement | null>;
    hoveredKey: ReactionType | null;
    onHoverKey: (key: ReactionType | null) => void;
    onMouseEnterPicker: () => void;
    onMouseLeavePicker: () => void;
}> = ({
    onSelect,
    onClose,
    currentReaction,
    isVisible,
    buttonRef,
    hoveredKey,
    onHoverKey,
    onMouseEnterPicker,
    onMouseLeavePicker,
}) => {
        const pickerRef = useRef<HTMLDivElement>(null);
        const [position, setPosition] = useState({ x: 0, y: 0 });

        useEffect(() => {
            if (isVisible && buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                // Position above the button, centered
                setPosition({
                    x: rect.left + rect.width / 2,
                    y: rect.top - 12,
                });
            }
        }, [isVisible, buttonRef]);

        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (
                    pickerRef.current &&
                    !pickerRef.current.contains(event.target as Node) &&
                    !(
                        buttonRef.current &&
                        buttonRef.current.contains(event.target as Node)
                    )
                ) {
                    onClose();
                }
            };
            const handleEscape = (event: KeyboardEvent) => {
                if (event.key === "Escape") onClose();
            };
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleEscape);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
                document.removeEventListener("keydown", handleEscape);
            };
        }, [onClose, buttonRef]);

        if (!isVisible) return null;

        return (
            <div
                ref={pickerRef}
                onMouseEnter={onMouseEnterPicker}
                onMouseLeave={onMouseLeavePicker}
                className="fixed bg-white rounded-2xl shadow-2xl border border-gray-200 px-3 py-2 flex gap-1 z-[999] animate-in fade-in zoom-in-95 duration-150"
                style={{
                    left: position.x,
                    top: position.y,
                    transform: "translateX(-50%) translateY(-100%)",
                }}
            >
                {Object.entries(REACTION_TYPES).map(([key, reaction], index) => {
                    const typedKey = key as ReactionType;
                    const isActive = currentReaction === key;
                    const isHovered = hoveredKey === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            data-reaction-key={key}
                            onClick={() => {
                                onSelect(typedKey);
                                onClose();
                            }}
                            onMouseEnter={() => onHoverKey(typedKey)}
                            onMouseLeave={() => onHoverKey(null)}
                            className={`relative w-11 h-11 rounded-full transition-transform duration-150 ease-out flex items-center justify-center text-3xl ${isActive ? "ring-2 ring-blue-500 bg-blue-50" : ""
                                }`}
                            style={{
                                transform: isHovered
                                    ? "translateY(-14px) scale(1.35)"
                                    : isActive
                                        ? "scale(1.1)"
                                        : "scale(1)",
                            }}
                            title={reaction.label}
                            aria-label={reaction.label}
                        >
                            {isHovered && (
                                <span className="pointer-events-none absolute -top-8 bg-gray-900 text-white text-[11px] font-bold px-2 py-1 rounded-md whitespace-nowrap">
                                    {reaction.label}
                                </span>
                            )}
                            <ReactionEmoji
                                type={typedKey}
                                className={
                                    isHovered
                                        ? "w-9 h-9 emoji-pop-in"
                                        : "w-9 h-9"
                                }
                                style={{ animationDelay: `${index * 0.12}s` }}
                            />
                        </button>
                    );
                })}
            </div>
        );
    };

const Timeline: React.FC = () => {
    const navigate = useNavigate();
    const [elections, setElections] = useState<Election[]>([]);
    const [selectedElection, setSelectedElection] = useState<string>("");
    const [posts, setPosts] = useState<CampaignPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [commentInputs, setCommentInputs] = useState<Record<number, string>>(
        {},
    );
    const [showCommentDialog, setShowCommentDialog] = useState<number | null>(
        null,
    );
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newPost, setNewPost] = useState({
        content: "",
        title: "",
        type: "update",
    });
    const [submitting, setSubmitting] = useState(false);
    const [userRole, setUserRole] = useState<string>("voter");

    // ✅ Reaction picker state
    const [activeReactionPicker, setActiveReactionPicker] = useState<
        number | null
    >(null);
    const [hoveredReaction, setHoveredReaction] = useState<ReactionType | null>(
        null,
    );
    const [pendingReactions, setPendingReactions] = useState<Set<number>>(
        new Set(),
    );
    const [summaryPostId, setSummaryPostId] = useState<number | null>(null);
    const [burstPostId, setBurstPostId] = useState<number | null>(null);
    const [submittingComments, setSubmittingComments] = useState<Set<number>>(
        new Set(),
    );
    const [toast, setToast] = useState<string | null>(null);

    const buttonRefs = useRef<Map<number, HTMLButtonElement | null>>(new Map());
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    // Gesture bookkeeping (refs so they don't trigger re-renders)
    const hoverOpenTimer = useRef<number | null>(null);
    const hoverCloseTimer = useRef<number | null>(null);
    const longPressTimer = useRef<number | null>(null);
    const pickerOpenedByTouchRef = useRef(false);
    const touchStartPos = useRef<{ x: number; y: number } | null>(null);
    const suppressNextClickRef = useRef(false);

    useEffect(() => {
        fetchElections();
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        setUserRole(user.role || "voter");
    }, []);

    useEffect(() => {
        if (selectedElection) {
            setPosts([]);
            setPage(1);
            setHasMore(true);
            fetchPosts();
        }
    }, [selectedElection]);

    useEffect(() => {
        if (selectedElection && page > 1) fetchPosts();
    }, [page]);

    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();
        observerRef.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !loading) {
                setPage((prev) => prev + 1);
            }
        });
        if (loadMoreRef.current)
            observerRef.current.observe(loadMoreRef.current);
        return () => observerRef.current?.disconnect();
    }, [hasMore, loading]);

    // Auto-dismiss the toast after a few seconds.
    useEffect(() => {
        if (!toast) return;
        const t = window.setTimeout(() => setToast(null), 3000);
        return () => window.clearTimeout(t);
    }, [toast]);

    const fetchElections = async () => {
        try {
            const response = await electionAPI.getAll();
            const data = Array.isArray(response.data) ? response.data : [];
            setElections(data);
            if (data.length > 0)
                setSelectedElection(data[0].election_id.toString());
        } catch (error) {
            console.error("Failed to fetch elections:", error);
        }
    };

    const fetchPosts = async () => {
        if (!selectedElection) return;
        setLoading(true);
        try {
            const response = await campaignPostAPI.getPosts(
                parseInt(selectedElection),
                page,
            );
            const result = response.data;
            let postsData = [];
            if (result.data?.data) {
                postsData = result.data.data;
                setHasMore(!!result.data.next_page_url);
            } else if (Array.isArray(result.data)) {
                postsData = result.data;
                setHasMore(false);
            }
            setPosts((prev) =>
                page === 1 ? postsData : [...prev, ...postsData],
            );
        } catch (error) {
            console.error("Failed to fetch posts:", error);
            if (page === 1) setToast("Couldn't load the timeline.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        setPage(1);
        setHasMore(true);
        fetchPosts();
    };

    const getUserReaction = (post: CampaignPost): ReactionType | null => {
        if (!post.user_reaction) return null;
        return post.user_reaction.type as ReactionType;
    };

    const getReactionCounts = (post: CampaignPost) => {
        const reactions = post.reactions || [];
        const counts: Record<string, number> = {};
        Object.keys(REACTION_TYPES).forEach((key) => {
            counts[key] = reactions.filter((r) => r.type === key).length;
        });
        return counts;
    };

    const handleComment = async (postId: number) => {
        const content = commentInputs[postId]?.trim();
        if (!content || submittingComments.has(postId)) return;
        setSubmittingComments((prev) => new Set(prev).add(postId));
        try {
            const response = await campaignPostAPI.addComment(postId, content);
            setPosts((prev) =>
                prev.map((post) => {
                    if (post.post_id === postId) {
                        const newComment = response.data.data;
                        return {
                            ...post,
                            comments: [newComment, ...(post.comments || [])],
                            comments_count: (post.comments_count || 0) + 1,
                        };
                    }
                    return post;
                }),
            );
            setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
        } catch (error) {
            console.error("Failed to add comment:", error);
            setToast("Couldn't post your comment. Please try again.");
        } finally {
            setSubmittingComments((prev) => {
                const next = new Set(prev);
                next.delete(postId);
                return next;
            });
        }
    };

    const handleReaction = useCallback(
        async (postId: number, type: ReactionType | null) => {
            // Prevent concurrent calls for the same post
            let alreadyPending = false;
            setPendingReactions((prev) => {
                if (prev.has(postId)) {
                    alreadyPending = true;
                    return prev;
                }
                return new Set(prev).add(postId);
            });
            if (alreadyPending) return;

            const user = JSON.parse(localStorage.getItem("user") || "{}");

            // Snapshot for rollback
            let previousSnapshot: CampaignPost[] | null = null;

            // Decide up-front whether this call is an add or a remove
            const targetPost = posts.find((p) => p.post_id === postId);
            const currentType = targetPost?.user_reaction?.type as
                | ReactionType
                | undefined;

            // If the caller passed `null` → remove.
            // If the caller passed the SAME type that's already on → remove.
            // Otherwise → add/replace with the new type.
            const shouldRemove = type === null || currentType === type;
            const nextType = shouldRemove ? null : type;

            // Optimistic update
            setPosts((prev) => {
                previousSnapshot = prev;
                return prev.map((p) => {
                    if (p.post_id !== postId) return p;

                    if (shouldRemove) {
                        return {
                            ...p,
                            reactions: (p.reactions || []).filter(
                                (r) => r.user_id !== user.user_id,
                            ),
                            user_reaction: undefined,
                        };
                    }

                    const optimistic = {
                        type: nextType,
                        user_id: user.user_id,
                        user_name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
                        user_photo: user.profile_photo,
                        user: {
                            user_id: user.user_id,
                            first_name: user.first_name,
                            last_name: user.last_name,
                            profile_photo: user.profile_photo,
                        },
                    } as any;

                    const filtered = (p.reactions || []).filter(
                        (r) => r.user_id !== user.user_id,
                    );

                    return {
                        ...p,
                        reactions: [...filtered, optimistic],
                        user_reaction: optimistic,
                    };
                });
            });

            try {
                if (shouldRemove) {
                    await campaignPostAPI.removeReaction(postId);
                    // Server confirmed removal — nothing more to sync.
                } else {
                    const response = await campaignPostAPI.addReaction(
                        postId,
                        nextType as ReactionType,
                    );
                    const reaction = response.data?.data || response.data;
                    setPosts((prev) =>
                        prev.map((p) => {
                            if (p.post_id !== postId) return p;
                            const filtered = (p.reactions || []).filter(
                                (r) => r.user_id !== reaction.user_id,
                            );
                            return {
                                ...p,
                                reactions: [...filtered, reaction],
                                user_reaction: reaction,
                            };
                        }),
                    );
                }
            } catch (error) {
                console.error("Failed to update reaction:", error);
                if (previousSnapshot) setPosts(previousSnapshot);
                setToast("Couldn't save your reaction. Please try again.");
            } finally {
                setPendingReactions((prev) => {
                    const next = new Set(prev);
                    next.delete(postId);
                    return next;
                });
            }
        },
        [posts],
    );

    // Quick tap/click on the Like button: toggle off whatever reaction is
    // active, or apply the default "Like" — matches Facebook's behaviour.
    const handleQuickTap = (postId: number) => {
        const post = posts.find((p) => p.post_id === postId);
        const current = post?.user_reaction?.type as ReactionType | undefined;
        // Tapping toggles the current reaction off, or applies a default "like"
        handleReaction(postId, current ?? "like");
    };

    const handleContentDoubleClick = (post: CampaignPost) => {
        if (!post.user_reaction) handleReaction(post.post_id, "heart");
        setBurstPostId(post.post_id);
        window.setTimeout(() => {
            setBurstPostId((id) => (id === post.post_id ? null : id));
        }, 700);
    };

    // ---------------------------------------------------------------
    // Desktop: hover the Like button to reveal the picker, just like
    // Facebook on the web (no click-and-hold needed with a mouse).
    // ---------------------------------------------------------------
    const clearHoverTimers = () => {
        if (hoverOpenTimer.current) {
            window.clearTimeout(hoverOpenTimer.current);
            hoverOpenTimer.current = null;
        }
        if (hoverCloseTimer.current) {
            window.clearTimeout(hoverCloseTimer.current);
            hoverCloseTimer.current = null;
        }
    };

    const openPickerForPost = (postId: number) => {
        clearHoverTimers();
        setHoveredReaction(null);
        setActiveReactionPicker(postId);
    };

    const scheduleClosePicker = () => {
        if (hoverOpenTimer.current) {
            window.clearTimeout(hoverOpenTimer.current);
            hoverOpenTimer.current = null;
        }
        hoverCloseTimer.current = window.setTimeout(() => {
            setActiveReactionPicker(null);
            setHoveredReaction(null);
        }, 1000);
    };

    const cancelClosePicker = () => {
        if (hoverCloseTimer.current) {
            window.clearTimeout(hoverCloseTimer.current);
            hoverCloseTimer.current = null;
        }
    };

    const handleButtonMouseEnter = (postId: number) => {
        cancelClosePicker();
        if (activeReactionPicker === postId) return;
        if (hoverOpenTimer.current) window.clearTimeout(hoverOpenTimer.current);
        hoverOpenTimer.current = window.setTimeout(
            () => openPickerForPost(postId),
            350,
        );
    };

    const handleButtonMouseLeave = () => {
        if (hoverOpenTimer.current) {
            window.clearTimeout(hoverOpenTimer.current);
            hoverOpenTimer.current = null;
        }
        scheduleClosePicker();
    };

    const handleButtonClick = (postId: number) => {
        if (suppressNextClickRef.current) return;
        clearHoverTimers();
        setActiveReactionPicker(null);
        setHoveredReaction(null);
        handleQuickTap(postId);
    };

    // ---------------------------------------------------------------
    // Touch: long-press to reveal the picker, then drag across it —
    // the emoji under the finger enlarges, release to select it.
    // ---------------------------------------------------------------
    const startLongPress = (postId: number) => {
        pickerOpenedByTouchRef.current = false;
        longPressTimer.current = window.setTimeout(() => {
            pickerOpenedByTouchRef.current = true;
            navigator.vibrate?.(10);
            openPickerForPost(postId);
        }, 350);
    };

    const clearLongPress = () => {
        if (longPressTimer.current) {
            window.clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleTouchStart = (e: React.TouchEvent, postId: number) => {
        const touch = e.touches[0];
        touchStartPos.current = { x: touch.clientX, y: touch.clientY };
        startLongPress(postId);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!pickerOpenedByTouchRef.current) {
            // Let ordinary scrolling through — only abort the long-press if
            // the finger has clearly moved before the picker opened.
            if (touchStartPos.current) {
                const dx = touch.clientX - touchStartPos.current.x;
                const dy = touch.clientY - touchStartPos.current.y;
                if (Math.sqrt(dx * dx + dy * dy) > 10) clearLongPress();
            }
            return;
        }
        // Actively choosing a reaction now — stop the page from scrolling.
        e.preventDefault();
        const el = document.elementFromPoint(
            touch.clientX,
            touch.clientY,
        ) as HTMLElement | null;
        const btn = el?.closest("[data-reaction-key]") as HTMLElement | null;
        const key = (btn?.getAttribute("data-reaction-key") as ReactionType) ||
            null;
        setHoveredReaction((prev) => {
            if (prev !== key && key) navigator.vibrate?.(8);
            return key;
        });
    };

    const handleTouchEnd = (postId: number) => {
        clearLongPress();
        suppressNextClickRef.current = true;
        window.setTimeout(() => {
            suppressNextClickRef.current = false;
        }, 500);

        if (pickerOpenedByTouchRef.current) {
            const chosen = hoveredReaction;
            setActiveReactionPicker(null);
            setHoveredReaction(null);
            if (chosen) handleReaction(postId, chosen);
        } else {
            handleQuickTap(postId);
        }
        pickerOpenedByTouchRef.current = false;
    };

    const handleTouchCancel = () => {
        clearLongPress();
        setActiveReactionPicker(null);
        setHoveredReaction(null);
        pickerOpenedByTouchRef.current = false;
    };

    const handleCreatePost = async () => {
        if (!newPost.content.trim()) return;
        setSubmitting(true);
        try {
            const response = await campaignPostAPI.createPost({
                election_id: parseInt(selectedElection),
                content: newPost.content,
                title: newPost.title || undefined,
                type: newPost.type as "survey" | "announcement" | "update",
            });
            setPosts((prev) => [response.data.data, ...prev]);
            setShowCreateDialog(false);
            setNewPost({ content: "", title: "", type: "update" });
        } catch (error) {
            console.error("Failed to create post:", error);
            setToast("Couldn't publish your post. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const getPostTypeColor = (type: string) => {
        switch (type) {
            case "survey":
                return "bg-purple-100 text-purple-700";
            case "announcement":
                return "bg-blue-100 text-blue-700";
            default:
                return "bg-green-100 text-green-700";
        }
    };

    const canCreatePost = userRole === "candidate" || userRole === "admin";

    if (loading && page === 1) {
        return (
            <div className="space-y-5 max-w-3xl mx-auto">
                <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 animate-pulse space-y-3"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-32 bg-gray-200 rounded-full" />
                                <div className="h-2.5 w-20 bg-gray-100 rounded-full" />
                            </div>
                        </div>
                        <div className="h-3 w-full bg-gray-100 rounded-full" />
                        <div className="h-3 w-4/5 bg-gray-100 rounded-full" />
                        <div className="h-8 w-full bg-gray-50 rounded-lg" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-5 max-w-3xl mx-auto">
            {/* Emoji animation keyframes */}
            <style>{`
                @keyframes emoji-idle-bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-1px); }
                }
                @keyframes emoji-pop-select {
                    0% { transform: scale(0.4) rotate(-15deg); opacity: 0.4; }
                    55% { transform: scale(1.35) rotate(8deg); opacity: 1; }
                    75% { transform: scale(0.9) rotate(-4deg); }
                    100% { transform: scale(1) rotate(0deg); }
                }
                @keyframes emoji-wiggle {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(-10deg); }
                    75% { transform: rotate(10deg); }
                }
                .emoji-idle {
                    display: inline-block;
                    animation: emoji-idle-bounce 1.6s ease-in-out infinite;
                }
                .emoji-pop-in {
                    display: inline-block;
                    animation: emoji-pop-select 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .emoji-wiggle-hover:hover {
                    display: inline-block;
                    animation: emoji-wiggle 0.4s ease-in-out;
                }
            `}</style>

            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900">
                        Campaign Timeline
                    </h1>
                    <p className="text-sm text-gray-500">
                        See what candidates are sharing
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <RefreshButton
                        onClick={handleRefresh}
                        isLoading={refreshing}
                    />
                    {canCreatePost && (
                        <Dialog
                            open={showCreateDialog}
                            onOpenChange={setShowCreateDialog}
                        >
                            <DialogTrigger asChild>
                                <Button className="bg-purple-600 hover:from-purple-700 hover:to-pink-700">
                                    <Sparkles className="w-4 h-4 mr-2" /> Create
                                    Post
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                                <DialogHeader>
                                    <DialogTitle className="text-xl">
                                        Create Campaign Post
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <Input
                                        placeholder="Post title (optional)"
                                        value={newPost.title}
                                        onChange={(e) =>
                                            setNewPost({
                                                ...newPost,
                                                title: e.target.value,
                                            })
                                        }
                                    />
                                    <Textarea
                                        placeholder="What do you want to ask or announce?"
                                        value={newPost.content}
                                        onChange={(e) =>
                                            setNewPost({
                                                ...newPost,
                                                content: e.target.value,
                                            })
                                        }
                                        rows={4}
                                        className="resize-none"
                                    />
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">
                                            Post Type
                                        </label>
                                        <select
                                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            value={newPost.type}
                                            onChange={(e) =>
                                                setNewPost({
                                                    ...newPost,
                                                    type: e.target.value,
                                                })
                                            }
                                        >
                                            <option value="survey">
                                                Survey
                                            </option>
                                            <option value="announcement">
                                                Announcement
                                            </option>
                                            <option value="update">
                                                Update
                                            </option>
                                        </select>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                setShowCreateDialog(false)
                                            }
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleCreatePost}
                                            disabled={
                                                submitting ||
                                                !newPost.content.trim()
                                            }
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            {submitting ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                "Post"
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* Election Selector */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-blue-600 px-5 py-3.5">
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                        <Calendar className="w-4 h-4" /> Select Election
                    </div>
                </div>
                <div className="p-4">
                    <div className="relative">
                        <select
                            className="w-full max-w-sm px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-gray-900 appearance-none bg-white"
                            value={selectedElection}
                            onChange={(e) =>
                                setSelectedElection(e.target.value)
                            }
                        >
                            <option value="">Select an election</option>
                            {elections.map((election) => (
                                <option
                                    key={election.election_id}
                                    value={election.election_id}
                                >
                                    {election.title}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Posts Feed */}
            <div className="space-y-4">
                {posts.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
                        <MessageCircle className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">
                            No posts yet for this election
                        </p>
                        {canCreatePost && (
                            <button
                                className="text-blue-600 font-bold text-sm mt-2 hover:underline"
                                onClick={() => setShowCreateDialog(true)}
                            >
                                Create the first post
                            </button>
                        )}
                    </div>
                ) : (
                    posts.map((post) => {
                        const userReaction = getUserReaction(post);
                        const isLiked = userReaction !== null;
                        const isPending = pendingReactions.has(post.post_id);
                        const reactionCounts = getReactionCounts(post);
                        const totalReactions = (post.reactions || []).length;
                        const isSubmittingComment = submittingComments.has(
                            post.post_id,
                        );

                        const topReactions = Object.entries(reactionCounts)
                            .filter(([_, count]) => count > 0)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3);

                        const buttonRef = (el: HTMLButtonElement | null) => {
                            buttonRefs.current.set(post.post_id, el);
                        };

                        return (
                            <div
                                key={post.post_id}
                                className="relative bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
                            >
                                {/* Post Header — branches on candidate vs admin */}
                                <div className="p-4 pb-2">
                                    <div className="flex items-center gap-3">
                                        {post.candidate ? (
                                            /* ---------- Candidate-authored post ---------- */
                                            <>
                                                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-extrabold text-sm flex-shrink-0 overflow-hidden">
                                                    {post.candidate.user
                                                        ?.profile_photo ? (
                                                        <img
                                                            src={
                                                                post.candidate
                                                                    .user
                                                                    .profile_photo
                                                            }
                                                            alt={
                                                                `${post.candidate.user?.first_name || ""} ${post.candidate.user?.last_name || ""}`.trim()
                                                            }
                                                            className="w-full h-full object-cover"
                                                            onError={(
                                                                e,
                                                            ) => {
                                                                (
                                                                    e.target as HTMLImageElement
                                                                ).style.display =
                                                                    "none";
                                                            }}
                                                        />
                                                    ) : (
                                                        post.candidate.user
                                                            ?.first_name?.[0] ||
                                                        "C"
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-gray-900 truncate">
                                                        {post.candidate.user
                                                            ?.first_name ||
                                                            "Candidate"}{" "}
                                                        {post.candidate.user
                                                            ?.last_name || ""}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                                                        <span>
                                                            {post.candidate
                                                                .position
                                                                ?.title ||
                                                                "Candidate"}
                                                        </span>
                                                        {post.candidate
                                                            .partylist
                                                            ?.name && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span>
                                                                        {
                                                                            post
                                                                                .candidate
                                                                                .partylist
                                                                                .name
                                                                        }
                                                                    </span>
                                                                </>
                                                            )}
                                                        <span>•</span>
                                                        <span>
                                                            {timeAgo(
                                                                post.created_at,
                                                            )}
                                                        </span>
                                                        {post.is_pinned && (
                                                            <Pin className="w-3 h-3 text-yellow-500 ml-1" />
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            /* ---------- Admin-authored post ---------- */
                                            <>
                                                <div className="w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center flex-shrink-0">
                                                    <Sparkles className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-gray-900 truncate">
                                                        OCC Election Admin
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                                                        <span>
                                                            Official
                                                            Announcement
                                                        </span>
                                                        <span>•</span>
                                                        <span>
                                                            {timeAgo(
                                                                post.created_at,
                                                            )}
                                                        </span>
                                                        {post.is_pinned && (
                                                            <Pin className="w-3 h-3 text-yellow-500 ml-1" />
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        <Badge
                                            className={getPostTypeColor(
                                                post.type,
                                            )}
                                        >
                                            {post.type.charAt(0).toUpperCase() +
                                                post.type.slice(1)}
                                        </Badge>
                                    </div>

                                    {/* Double-click / double-tap to love, Instagram/Facebook style */}
                                    <div
                                        onDoubleClick={() =>
                                            handleContentDoubleClick(post)
                                        }
                                        className="cursor-pointer select-none"
                                    >
                                        {post.title && (
                                            <h3 className="text-lg font-extrabold text-gray-900 mt-2">
                                                {post.title}
                                            </h3>
                                        )}

                                        <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                                            {post.content}
                                        </p>
                                    </div>
                                </div>

                                {/* Post Stats */}
                                <div className="px-4 py-2 border-t border-gray-100">
                                    <div className="flex items-center justify-between text-sm text-gray-500">
                                        <button
                                            type="button"
                                            disabled={totalReactions === 0}
                                            onClick={() =>
                                                setSummaryPostId(post.post_id)
                                            }
                                            className={`flex items-center gap-1 ${totalReactions > 0
                                                ? "hover:underline"
                                                : ""
                                                }`}
                                        >
                                            {totalReactions > 0 ? (
                                                <>
                                                    <div className="flex items-center -space-x-1">
                                                        {topReactions.map(
                                                            ([type]) => (
                                                                <ReactionEmoji
                                                                    key={type}
                                                                    type={
                                                                        type as ReactionType
                                                                    }
                                                                    className="w-5 h-5 emoji-wiggle-hover"
                                                                />
                                                            ),
                                                        )}
                                                    </div>
                                                    <span className="ml-1">
                                                        {totalReactions}
                                                    </span>
                                                </>
                                            ) : (
                                                <span>
                                                    Be the first to react
                                                </span>
                                            )}
                                        </button>
                                        <div>
                                            <span>
                                                {post.comments_count || 0}{" "}
                                                comments
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons with Hover / Click-Hold */}
                                <div className="px-2 py-1 border-t border-gray-100">
                                    <div className="flex">
                                        {/* Like Button with hover (desktop) / long-press-drag (touch) */}
                                        <div
                                            className="relative flex-1"
                                            onMouseEnter={() =>
                                                handleButtonMouseEnter(
                                                    post.post_id,
                                                )
                                            }
                                            onMouseLeave={
                                                handleButtonMouseLeave
                                            }
                                        >
                                            <button
                                                ref={buttonRef}
                                                type="button"
                                                aria-pressed={isLiked}
                                                aria-label={
                                                    isLiked
                                                        ? `Reacted ${REACTION_TYPES[userReaction as ReactionType]?.label}. Click to remove, hover or hold to change.`
                                                        : "Like this post. Hover or hold to choose a reaction."
                                                }
                                                disabled={isPending}
                                                className={`w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-60 ${isLiked
                                                    ? `${REACTION_TYPES[userReaction as ReactionType]?.bg} ${REACTION_TYPES[userReaction as ReactionType]?.color}`
                                                    : "text-gray-600 hover:bg-gray-100"
                                                    }`}
                                                onClick={() =>
                                                    handleButtonClick(
                                                        post.post_id,
                                                    )
                                                }
                                                onTouchStart={(e) =>
                                                    handleTouchStart(
                                                        e,
                                                        post.post_id,
                                                    )
                                                }
                                                onTouchMove={handleTouchMove}
                                                onTouchEnd={() =>
                                                    handleTouchEnd(
                                                        post.post_id,
                                                    )
                                                }
                                                onTouchCancel={
                                                    handleTouchCancel
                                                }
                                            >
                                                {isPending ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : isLiked ? (
                                                    <>
                                                        <ReactionEmoji
                                                            key={userReaction}
                                                            type={
                                                                userReaction as ReactionType
                                                            }
                                                            className="w-5 h-5 emoji-pop-in"
                                                        />
                                                        <span>
                                                            {
                                                                REACTION_TYPES[
                                                                    userReaction as ReactionType
                                                                ]?.label
                                                            }
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ThumbsUp className="w-4 h-4" />
                                                        Like
                                                    </>
                                                )}
                                            </button>

                                            {/* Reaction Picker - Shows above the button */}
                                            <ReactionPicker
                                                onSelect={(type) =>
                                                    handleReaction(
                                                        post.post_id,
                                                        type,
                                                    )
                                                }
                                                onClose={() => {
                                                    setActiveReactionPicker(
                                                        null,
                                                    );
                                                    setHoveredReaction(null);
                                                }}
                                                currentReaction={
                                                    userReaction || undefined
                                                }
                                                isVisible={
                                                    activeReactionPicker ===
                                                    post.post_id
                                                }
                                                buttonRef={{
                                                    current:
                                                        buttonRefs.current.get(
                                                            post.post_id,
                                                        ) || null,
                                                }}
                                                hoveredKey={hoveredReaction}
                                                onHoverKey={setHoveredReaction}
                                                onMouseEnterPicker={
                                                    cancelClosePicker
                                                }
                                                onMouseLeavePicker={
                                                    scheduleClosePicker
                                                }
                                            />
                                        </div>

                                        {/* Comment Button */}
                                        <button
                                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-sm font-semibold transition-colors ${showCommentDialog ===
                                                post.post_id
                                                ? "text-blue-600 bg-blue-50"
                                                : "text-gray-600 hover:bg-gray-100"
                                                }`}
                                            onClick={() =>
                                                setShowCommentDialog(
                                                    showCommentDialog ===
                                                        post.post_id
                                                        ? null
                                                        : post.post_id,
                                                )
                                            }
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                            Comment
                                        </button>
                                    </div>
                                </div>

                                {/* Comments Section */}
                                {showCommentDialog === post.post_id && (
                                    <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Write a comment..."
                                                value={
                                                    commentInputs[
                                                    post.post_id
                                                    ] || ""
                                                }
                                                onChange={(e) =>
                                                    setCommentInputs(
                                                        (prev) => ({
                                                            ...prev,
                                                            [post.post_id]:
                                                                e.target.value,
                                                        }),
                                                    )
                                                }
                                                onKeyDown={(e) =>
                                                    e.key === "Enter" &&
                                                    handleComment(post.post_id)
                                                }
                                                disabled={isSubmittingComment}
                                                className="flex-1 rounded-full bg-gray-100 border-0 focus:ring-2 focus:ring-blue-500"
                                            />
                                            <Button
                                                size="sm"
                                                onClick={() =>
                                                    handleComment(post.post_id)
                                                }
                                                disabled={
                                                    !commentInputs[
                                                        post.post_id
                                                    ]?.trim() ||
                                                    isSubmittingComment
                                                }
                                                className="bg-blue-600 hover:bg-blue-700 rounded-full px-4"
                                            >
                                                {isSubmittingComment ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Send className="w-4 h-4" />
                                                )}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    setShowCommentDialog(null)
                                                }
                                                className="rounded-full"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        {post.comments &&
                                            post.comments.length > 0 && (
                                                <div className="mt-3 space-y-3 max-h-60 overflow-y-auto">
                                                    {post.comments
                                                        .slice(0, 5)
                                                        .map((comment) => (
                                                            <div
                                                                key={
                                                                    comment.comment_id
                                                                }
                                                                className="flex gap-3"
                                                            >
                                                                <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                                    {comment
                                                                        .user
                                                                        ?.first_name?.[0] ||
                                                                        "U"}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="bg-gray-100 rounded-2xl px-3 py-2">
                                                                        <p className="text-sm font-bold text-gray-900">
                                                                            {
                                                                                comment
                                                                                    .user
                                                                                    ?.first_name
                                                                            }{" "}
                                                                            {
                                                                                comment
                                                                                    .user
                                                                                    ?.last_name
                                                                            }
                                                                        </p>
                                                                        <p className="text-sm text-gray-700">
                                                                            {
                                                                                comment.content
                                                                            }
                                                                        </p>
                                                                    </div>
                                                                    <p className="text-xs text-gray-400 mt-0.5 ml-1">
                                                                        {timeAgo(
                                                                            comment.created_at,
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    {(post.comments_count ||
                                                        0) > 5 && (
                                                            <button className="text-sm font-bold text-blue-600 hover:underline">
                                                                View all{" "}
                                                                {
                                                                    post.comments_count
                                                                }{" "}
                                                                comments
                                                            </button>
                                                        )}
                                                </div>
                                            )}
                                    </div>
                                )}

                                {/* Double-tap heart burst */}
                                {burstPostId === post.post_id && (
                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
                                        <Heart className="w-24 h-24 text-red-500 fill-red-500 drop-shadow-lg animate-in zoom-in-50 fade-in duration-300" />
                                    </div>
                                )}

                                {/* Reaction breakdown dialog — shows who reacted */}
                                <Dialog
                                    open={summaryPostId === post.post_id}
                                    onOpenChange={(open) =>
                                        !open && setSummaryPostId(null)
                                    }
                                >
                                    <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>
                                                Reactions ({totalReactions})
                                            </DialogTitle>
                                        </DialogHeader>

                                        {totalReactions === 0 ? (
                                            <p className="text-sm text-gray-500 py-4 text-center">
                                                No reactions yet.
                                            </p>
                                        ) : (
                                            <div className="space-y-4">
                                                {Object.entries(
                                                    reactionCounts,
                                                )
                                                    .filter(
                                                        ([, count]) =>
                                                            count > 0,
                                                    )
                                                    .sort(
                                                        (a, b) =>
                                                            b[1] - a[1],
                                                    )
                                                    .map(
                                                        ([key, count]) => {
                                                            const typedKey =
                                                                key as ReactionType;
                                                            const reactors = (
                                                                post.reactions ||
                                                                []
                                                            )
                                                                .filter(
                                                                    (r) =>
                                                                        r.type ===
                                                                        typedKey,
                                                                )
                                                                .map((r) => ({
                                                                    user_id:
                                                                        r.user_id,
                                                                    name:
                                                                        (
                                                                            r as any
                                                                        )
                                                                            .user_name ||
                                                                        (r.user
                                                                            ? `${r.user.first_name || ""} ${r.user.last_name || ""}`.trim()
                                                                            : "Unknown"),
                                                                    photo:
                                                                        (
                                                                            r as any
                                                                        )
                                                                            .user_photo ||
                                                                        r.user
                                                                            ?.profile_photo ||
                                                                        null,
                                                                }));

                                                            return (
                                                                <div
                                                                    key={key}
                                                                >
                                                                    {/* Reaction header */}
                                                                    <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-100">
                                                                        <ReactionEmoji
                                                                            type={
                                                                                typedKey
                                                                            }
                                                                            className="w-6 h-6"
                                                                        />
                                                                        <span className="font-bold text-sm text-gray-800">
                                                                            {
                                                                                REACTION_TYPES[
                                                                                    typedKey
                                                                                ]
                                                                                    .label
                                                                            }
                                                                        </span>
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className="ml-auto text-xs bg-gray-100 text-gray-600"
                                                                        >
                                                                            {
                                                                                count
                                                                            }
                                                                        </Badge>
                                                                    </div>

                                                                    {/* Reactor list */}
                                                                    <div className="space-y-1.5">
                                                                        {reactors.map(
                                                                            (
                                                                                person,
                                                                            ) => (
                                                                                <div
                                                                                    key={
                                                                                        person.user_id
                                                                                    }
                                                                                    className="flex items-center gap-2.5 px-1 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                                                                                >
                                                                                    {person.photo ? (
                                                                                        <img
                                                                                            src={
                                                                                                person.photo
                                                                                            }
                                                                                            alt={
                                                                                                person.name
                                                                                            }
                                                                                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                                                                            onError={(
                                                                                                e,
                                                                                            ) => {
                                                                                                (
                                                                                                    e.target as HTMLImageElement
                                                                                                ).style.display =
                                                                                                    "none";
                                                                                            }}
                                                                                        />
                                                                                    ) : (
                                                                                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                                                            {person.name
                                                                                                .split(
                                                                                                    " ",
                                                                                                )
                                                                                                .map(
                                                                                                    (
                                                                                                        n,
                                                                                                    ) =>
                                                                                                        n[0],
                                                                                                )
                                                                                                .join(
                                                                                                    "",
                                                                                                )
                                                                                                .slice(
                                                                                                    0,
                                                                                                    2,
                                                                                                )
                                                                                                .toUpperCase()}
                                                                                        </div>
                                                                                    )}
                                                                                    <span className="text-sm text-gray-800 font-medium truncate">
                                                                                        {
                                                                                            person.name
                                                                                        }
                                                                                    </span>
                                                                                </div>
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        },
                                                    )}
                                            </div>
                                        )}
                                    </DialogContent>
                                </Dialog>
                            </div>
                        );
                    })
                )}

                {/* Load More */}
                <div ref={loadMoreRef} className="py-4 text-center">
                    {hasMore && (
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                    )}
                </div>
            </div>

            {/* Lightweight toast for errors */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg z-[1000] animate-in fade-in slide-in-from-bottom-2 duration-200">
                    {toast}
                </div>
            )}
        </div>
    );
};

export default Timeline;