import { safeApiCall } from "@/lib/api-client"
import { mockQuickActions, mockResources, mockSummaryCards, mockTimelineEvents } from "../utils/mock-data"
import type {
  AdminQuickAction,
  AdminResource,
  AdminSummaryCard,
  AdminTimelineEvent,
  AdminUser,
} from "../types"

const DASHBOARD_ENDPOINT = "/admin/dashboard"
const RESOURCES_ENDPOINT = "/admin/resources"
const USERS_ENDPOINT = "/admin/users"
const POLICIES_ENDPOINT = "/admin/policies"

export type AdminUserStatusFilter = "ACTIVE" | "INACTIVE" | "ALL"

export type AdminDashboardResponse = {
  summary: AdminSummaryCard[]
  timeline: AdminTimelineEvent[]
  quickActions: AdminQuickAction[]
}

export async function fetchAdminDashboard(): Promise<AdminDashboardResponse> {
  const { data } = await safeApiCall<AdminDashboardResponse>(DASHBOARD_ENDPOINT)
  return (
    data ?? {
      summary: mockSummaryCards,
      timeline: mockTimelineEvents,
      quickActions: mockQuickActions,
    }
  )
}

export type AdminResourceResponse = {
  items: AdminResource[]
}

export async function fetchAdminResources(): Promise<AdminResourceResponse> {
  const { data } = await safeApiCall<AdminResourceResponse>(RESOURCES_ENDPOINT)
  return data ?? { items: mockResources }
}

export type AdminUsersResponse = {
  items: AdminUser[]
}

export async function fetchAdminUsers(
  status: AdminUserStatusFilter = "ACTIVE",
): Promise<AdminUsersResponse> {
  const query = new URLSearchParams()
  if (status) {
    query.set("status", status)
  }
  const url = query.toString().length > 0 ? `${USERS_ENDPOINT}?${query.toString()}` : USERS_ENDPOINT
  const { data, error } = await safeApiCall<AdminUsersResponse>(url)
  if (error) {
    throw error
  }
  return data ?? { items: [] }
}

export async function promoteAdminFloorManager(userId: string) {
  const { error } = await safeApiCall<void>(`${USERS_ENDPOINT}/${userId}/roles/floor-manager`, {
    method: "POST",
  })
  if (error) throw error
}

export async function demoteAdminFloorManager(userId: string) {
  const { error } = await safeApiCall<void>(`${USERS_ENDPOINT}/${userId}/roles/floor-manager`, {
    method: "DELETE",
  })
  if (error) throw error
}

export async function deactivateAdminUser(userId: string) {
  const { error } = await safeApiCall<void>(`${USERS_ENDPOINT}/${userId}/status`, {
    method: "PATCH",
    body: { status: "INACTIVE" },
  })
  if (error) throw error
}

export type AdminPoliciesResponse = {
  notification: {
    batchTime: string
    dailyLimit: number
    ttlHours: number
  }
  penalty: {
    limit: number
    template: string
  }
}

export async function fetchAdminPolicies(): Promise<AdminPoliciesResponse> {
  const { data } = await safeApiCall<AdminPoliciesResponse>(POLICIES_ENDPOINT)
  return (
    data ?? {
      notification: {
        batchTime: "09:00",
        dailyLimit: 20,
        ttlHours: 24,
      },
      penalty: {
        limit: 10,
        template: "DormMate 벌점 누적 {점수}점으로 세탁실/다목적실/도서관 이용이 7일간 제한됩니다. 냉장고 기능은 유지됩니다.",
      },
    }
  )
}

export type UpdateAdminPoliciesPayload = {
  notification: {
    batchTime: string
    dailyLimit: number
    ttlHours: number
  }
  penalty: {
    limit: number
    template: string
  }
}

export async function updateAdminPolicies(payload: UpdateAdminPoliciesPayload) {
  const { error } = await safeApiCall<void>(POLICIES_ENDPOINT, {
    method: "PUT",
    body: payload,
  })
  if (error) throw error
}

export * from "./fridge"

export * from "./fridge"
