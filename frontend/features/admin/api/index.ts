import { safeApiCall } from "@/lib/api-client"
import { mockQuickActions, mockResources, mockSummaryCards, mockTimelineEvents, mockUsers } from "../utils/mock-data"
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

export async function fetchAdminUsers(): Promise<AdminUsersResponse> {
  const { data } = await safeApiCall<AdminUsersResponse>(USERS_ENDPOINT)
  return data ?? { items: mockUsers }
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
