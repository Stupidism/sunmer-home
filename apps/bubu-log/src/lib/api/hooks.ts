import { $api } from "./client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { components } from "./openapi-types";
import { toast } from "sonner";
import { withCurrentBabyIdOnApiPath } from '@/lib/baby-scope'

// Re-export types for convenience
export type Activity = components["schemas"]["Activity"];
export type ActivityType = components["schemas"]["ActivityType"];
export type BabyProfile = components["schemas"]["BabyProfile"];
export type CreateActivityInput = components["schemas"]["CreateActivityInput"];
export type UpdateActivityInput = components["schemas"]["UpdateActivityInput"];
export type AuditLog = components["schemas"]["AuditLog"];
export type InputMethod = components["schemas"]["InputMethod"];
export type AuditAction = components["schemas"]["AuditAction"];
export type ResourceType = components["schemas"]["ResourceType"];

// Activities hooks
export function useActivities(params?: {
  limit?: number;
  type?: ActivityType;
  types?: string;
  date?: string;
  startTimeGte?: string;
  startTimeLt?: string;
  crossStartTime?: boolean;
  crossEndTime?: boolean;
}) {
  return $api.useQuery("get", "/activities", {
    params: { query: params },
  });
}

export function useLatestActivity(types: string, options?: { enabled?: boolean }) {
  return $api.useQuery("get", "/activities/latest", {
    params: { query: { types } },
    ...options,
  });
}

export function useActivity(id: string, options?: { enabled?: boolean }) {
  return $api.useQuery("get", "/activities/{id}", {
    params: { path: { id } },
    ...options,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  
  return $api.useMutation("post", "/activities", {
    onSuccess: () => {
      // Invalidate activities queries to refetch
      queryClient.invalidateQueries({ queryKey: ["get", "/activities"] });
      queryClient.invalidateQueries({ queryKey: ["get", "/activities/latest"] });
    },
  });
}

// Activity conflict error type
export type ActivityConflictError = components["schemas"]["ActivityConflictError"];

// Enhanced hook with conflict handling
export function useCreateActivityWithConflictCheck() {
  const queryClient = useQueryClient();
  const [pendingData, setPendingData] = useState<CreateActivityInput | null>(null);
  const [conflictError, setConflictError] = useState<ActivityConflictError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const mutate = useCallback(async (
    data: CreateActivityInput,
    options?: {
      onSuccess?: () => void;
      onError?: (error: unknown) => void;
    }
  ) => {
    setIsLoading(true);
    try {
      const response = await fetch(withCurrentBabyIdOnApiPath('/api/app/activities'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (response.status === 409) {
        const errorData = await response.json() as ActivityConflictError;
        
        if (errorData.code === 'DUPLICATE_ACTIVITY') {
          // Duplicate - cannot override, show error
          toast.error(errorData.error);
          options?.onError?.(errorData);
          return { error: errorData };
        } else if (errorData.code === 'OVERLAP_ACTIVITY') {
          // Overlap - can override, show confirmation
          setPendingData(data);
          setConflictError(errorData);
          return { conflict: errorData };
        }
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || '创建失败');
        options?.onError?.(errorData);
        return { error: errorData };
      }
      
      const result = await response.json();
      // Invalidate queries manually since we're not using the mutation
      queryClient.invalidateQueries({ queryKey: ["get", "/activities"] });
      queryClient.invalidateQueries({ queryKey: ["get", "/activities/latest"] });
      options?.onSuccess?.();
      return { data: result };
    } catch (error) {
      toast.error('创建失败');
      options?.onError?.(error);
      return { error };
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);
  
  // Force create (bypass overlap warning)
  const forceCreate = useCallback(async (options?: { onSuccess?: () => void }) => {
    if (!pendingData) return;
    
    const dataWithForce = { ...pendingData, force: true };
    const result = await mutate(dataWithForce, options);
    if (!result.error && !result.conflict) {
      setPendingData(null);
      setConflictError(null);
    }
    return result;
  }, [pendingData, mutate]);
  
  // Cancel the pending operation
  const cancelConflict = useCallback(() => {
    setPendingData(null);
    setConflictError(null);
  }, []);
  
  return {
    mutate,
    forceCreate,
    cancelConflict,
    isLoading,
    conflictError,
    hasPendingConflict: !!conflictError,
  };
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  
  return $api.useMutation("patch", "/activities/{id}", {
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["get", "/activities"] });
      queryClient.invalidateQueries({ queryKey: ["get", "/activities/latest"] });
      // 同时刷新单个活动的查询，确保编辑时数据是最新的
      queryClient.invalidateQueries({ queryKey: ["get", "/activities/{id}", { params: { path: { id: variables.params.path.id } } }] });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  
  return $api.useMutation("delete", "/activities/{id}", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/activities"] });
      queryClient.invalidateQueries({ queryKey: ["get", "/activities/latest"] });
    },
  });
}

export function useBatchDeleteActivities() {
  const queryClient = useQueryClient();
  
  return $api.useMutation("delete", "/activities", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/activities"] });
      queryClient.invalidateQueries({ queryKey: ["get", "/activities/latest"] });
    },
  });
}

export function useBatchUpdateActivityDate() {
  const queryClient = useQueryClient();
  
  return $api.useMutation("put", "/activities", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/activities"] });
      queryClient.invalidateQueries({ queryKey: ["get", "/activities/latest"] });
    },
  });
}

// Baby profile hooks
export function useBabyProfile() {
  return $api.useQuery("get", "/baby-profile");
}

export function useUpdateBabyProfile() {
  const queryClient = useQueryClient();
  
  return $api.useMutation("patch", "/baby-profile", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/baby-profile"] });
    },
  });
}

// Photo upload hook
export function useUploadActivityPhoto() {
  return $api.useMutation("post", "/activities/upload-photo");
}

// Sleep state hook - tracks if baby is currently sleeping
export function useSleepState(options?: { enabled?: boolean }) {
  const sleepQuery = useLatestActivity("SLEEP", options);
  
  // 宝宝正在睡觉：SLEEP 记录没有 endTime（只有入睡时间）
  const isSleeping = sleepQuery.data?.type === "SLEEP" && !sleepQuery.data?.endTime;
  const sleepState = isSleeping ? "end" : "start";
  
  // 获取当前睡眠记录（用于更新）
  const getCurrentSleepActivity = useCallback(() => {
    if (sleepQuery.data?.type === "SLEEP" && !sleepQuery.data?.endTime) {
      return sleepQuery.data;
    }
    return null;
  }, [sleepQuery.data]);
  
  return {
    sleepState,
    isSleeping,
    isLoading: sleepQuery.isLoading,
    isFetching: sleepQuery.isFetching,
    getCurrentSleepActivity,
    sleepData: sleepQuery.data,
  };
}

// Audit log hooks
export function useAudits(params?: {
  limit?: number;
  offset?: number;
  action?: AuditAction;
  resourceType?: ResourceType;
  success?: boolean;
}, options?: { enabled?: boolean }) {
  return $api.useQuery("get", "/audits", {
    params: { query: params },
    ...options,
  });
}

// Daily stats types
export type DailyStat = components["schemas"]["DailyStat"];

// Daily stats hooks
export function useDailyStats(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}, options?: { enabled?: boolean }) {
  return $api.useQuery("get", "/daily-stats", {
    params: { query: params },
    ...options,
  });
}

export function useDailyStat(date: string, options?: { enabled?: boolean }) {
  return $api.useQuery("get", "/daily-stats/{date}", {
    params: { path: { date } },
    ...options,
  });
}

export function useComputeDailyStat() {
  const queryClient = useQueryClient();
  
  return $api.useMutation("post", "/daily-stats", {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["get", "/daily-stats"] });
    },
  });
}
