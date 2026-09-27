// resources/js/contexts/AuthContext.tsx
import React, {
    createContext,
    useState,
    useContext,
    useEffect,
    ReactNode,
    useCallback,
} from "react";
import { authAPI } from "../api/auth";
import { User } from "../types";
import axios from "../api/axios";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (
        email: string,
        password: string,
    ) => Promise<{ success: boolean; user?: User; error?: string }>;
    logout: () => Promise<void>;
    updateUser: (updatedUser: User) => void;
    refreshUser: () => Promise<User | null>;
}

interface AuthProviderProps {
    children: ReactNode;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            try {
                return JSON.parse(storedUser);
            } catch {
                return null;
            }
        }
        return null;
    });
    const [loading, setLoading] = useState<boolean>(true);
    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem("access_token");
    });

    /**
     * ✅ Fetches the user from `/me` and syncs to state + localStorage.
     * Use this whenever you need the latest user (role may have changed).
     */
    const fetchUser = useCallback(async (): Promise<User | null> => {
        try {
            const response = await authAPI.getMe();

            // ✅ Handle BOTH response shapes:
            //    - { success: true, user: { ... } }   (Laravel style)
            //    - { ...user fields }                  (unwrapped)
            const userData = response.data?.user ?? response.data;

            if (!userData || !userData.user_id) {
                console.warn("⚠️ /me returned an invalid user:", response.data);
                return null;
            }

            // Load course relation if missing
            if (userData.course_id && !userData.course) {
                try {
                    const courseResponse = await axios.get(
                        `/courses/${userData.course_id}`,
                    );
                    userData.course = courseResponse.data;
                } catch (e) {
                    console.warn("Could not fetch course:", e);
                }
            }

            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
            return userData;
        } catch (error) {
            console.error("Failed to fetch user:", error);

            // Only clear the session on 401 — not on network errors
            const status = (error as any)?.response?.status;
            if (status === 401) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("user");
                setToken(null);
                setUser(null);
            }

            return null;
        }
    }, []);

    // Bootstrap: fetch user on mount (always refresh to pick up role changes)
    useEffect(() => {
        if (token) {
            fetchUser().finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ✅ Re-fetch on tab focus / visibility change
    useEffect(() => {
        if (!token) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                fetchUser();
            }
        };

        const handleFocus = () => {
            fetchUser();
        };

        // ✅ Re-fetch when NotificationContext dispatches `user:refresh`
        const handleUserRefresh = () => {
            fetchUser();
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleFocus);
        window.addEventListener("user:refresh", handleUserRefresh);

        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("user:refresh", handleUserRefresh);
        };
    }, [token, fetchUser]);

    useEffect(() => {
        console.log("Auth state changed:", {
            token: !!token,
            user: !!user,
            role: user?.role,
            loading,
            isAuthenticated: !!token && !!user,
        });
    }, [token, user, loading]);

    const login = async (
        email: string,
        password: string,
    ): Promise<{ success: boolean; user?: User; error?: string }> => {
        try {
            const response = await authAPI.login(email, password);

            const newToken = response.data.token;
            const userData = response.data.user;

            if (newToken && userData) {
                if (userData.course_id && !userData.course) {
                    try {
                        const courseResponse = await axios.get(
                            `/courses/${userData.course_id}`,
                        );
                        userData.course = courseResponse.data;
                    } catch (e) {
                        console.warn("Could not fetch course on login:", e);
                    }
                }

                localStorage.setItem("access_token", newToken);
                localStorage.setItem("user", JSON.stringify(userData));
                setToken(newToken);
                setUser(userData);
                return { success: true, user: userData };
            } else {
                return {
                    success: false,
                    error:
                        response.data.message ||
                        "Invalid response from server",
                };
            }
        } catch (error: any) {
            console.error("Login error:", error);
            return {
                success: false,
                error: error.response?.data?.message || "Login failed",
            };
        }
    };

    const logout = async (): Promise<void> => {
        try {
            await authAPI.logout();
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            localStorage.removeItem("access_token");
            localStorage.removeItem("user");
            setToken(null);
            setUser(null);
        }
    };

    const updateUser = (updatedUser: User): void => {
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
    };

    const refreshUser = async (): Promise<User | null> => {
        return await fetchUser();
    };

    const value: AuthContextType = {
        user,
        loading,
        isAuthenticated: !!token && !!user,
        login,
        logout,
        updateUser,
        refreshUser,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};