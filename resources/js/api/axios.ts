// resources/js/api/axios.ts
import axios, {
    AxiosInstance,
    InternalAxiosRequestConfig,
    AxiosError,
} from "axios";

const API_URL: string = "https://election.occph.com/api/web";

/* ============================================================
 * Default JSON API client
 * ============================================================ */
const axiosInstance: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
    // ✅ Don't transform response
    transformResponse: [
        (data) => {
            try {
                return JSON.parse(data);
            } catch {
                return data;
            }
        },
    ],
});

// Request interceptor
axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
        const token = localStorage.getItem("access_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: AxiosError): Promise<AxiosError> => {
        return Promise.reject(error);
    },
);

// Response interceptor - DON'T wrap the response
axiosInstance.interceptors.response.use(
    (response) => {
        // If response data is an object with a data property that is an array, unwrap it
        if (
            response.data &&
            typeof response.data === "object" &&
            !Array.isArray(response.data)
        ) {
            // Check for common wrapper patterns
            if (
                response.data.data !== undefined &&
                Array.isArray(response.data.data)
            ) {
                response.data = response.data.data;
            }
            // Check for Laravel pagination
            else if (
                response.data.data !== undefined &&
                response.data.current_page !== undefined
            ) {
                // Keep pagination structure
                return response;
            }
        }
        return response;
    },
    (error) => Promise.reject(error),
);

/* ============================================================
 * Blob / binary download client (for PDFs, files, etc.)
 *
 * The critical line is `transformResponse: undefined`.
 * The default JSON-transform inherited from axios (and the one
 * defined on `axiosInstance` above) will try to JSON.parse the
 * raw PDF bytes, blow up, and return `""` — which is exactly the
 * "Invalid PDF received" symptom we were chasing.
 *
 * By killing transformResponse on this instance, axios hands us
 * the raw Blob unchanged.
 * ============================================================ */
export const axiosBlob: AxiosInstance = axios.create({
    baseURL: API_URL,
    responseType: "blob",
    headers: {
        // Ask for a PDF; fall back to anything binary
        Accept: "application/pdf, application/octet-stream, */*",
    },
    // 🔑 Do NOT let axios or any inherited default touch the body
    transformResponse: undefined,
});

// Attach bearer token on every blob request
axiosBlob.interceptors.request.use((config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// No response interceptor that alters the body — the blob must be
// passed through untouched.
axiosBlob.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(error),
);

export default axiosInstance;
