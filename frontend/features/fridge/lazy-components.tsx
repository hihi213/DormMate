"use client"

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// 로딩 스켈레톤 컴포넌트들
export function AddItemDialogSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  )
}

export function BundleDetailSheetSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  )
}

// 동적 임포트 컴포넌트들
export const LazyAddItemDialog = dynamic(
  () => import('@/features/fridge/components/add-item').then(mod => ({ default: mod.default })),
  {
    loading: () => <AddItemDialogSkeleton />,
    ssr: false
  }
)

export const LazyBundleDetailSheet = dynamic(
  () => import('@/features/fridge/components/bundle-detail-sheet').then(mod => ({ default: mod.default })),
  {
    loading: () => <BundleDetailSheetSkeleton />,
    ssr: false
  }
)

// 냉장고 페이지 컴포넌트들
export const LazyFridgePage = dynamic(
  () => import('@/app/fridge/page').then(mod => ({ default: mod.default })),
  {
    loading: () => (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    ),
    ssr: true
  }
)

// 검사 페이지 컴포넌트
export const LazyInspectionsPage = dynamic(
  () => import('@/app/fridge/inspections/page').then(mod => ({ default: mod.default })),
  {
    loading: () => (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    ),
    ssr: true
  }
)
