// resources/js/hooks/useUsers.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/admin';

export const useUsers = (params?: {
    page?: number;
    per_page?: number;
    role?: string;
    search?: string;
}) => {
    return useQuery({
        queryKey: ['users', params],
        queryFn: async () => {
            const response = await adminAPI.getUsers(params);
            return response.data;
        },
        staleTime: 1000 * 60 * 2,
    });
};

export const useRefreshUsers = () => {
    const queryClient = useQueryClient();
    return () => {
        queryClient.invalidateQueries({ queryKey: ['users'] });
    };
};