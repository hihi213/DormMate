"use client"

import type React from "react"
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react"
import type { Item, Slot, ActionResult } from "./types"
import { getCurrentUserId } from "@/lib/auth"
import { useFridgeLogic } from "@/hooks/use-fridge-logic"

// 스토리지 키 상수
const STORAGE_KEYS = {
  ITEMS: "fridge-items-v1",
  SLOTS: "fridge-slots-v1",
  INSPECTION: "fridge-inspection-v1"
} as const

// 컨텍스트 타입
type FridgeContextValue = {
  // 상태
  items: Item[]
  slots: Slot[]
  lastInspectionAt: number
  isInspector: boolean
  
  // 로직 훅
  logic: ReturnType<typeof useFridgeLogic>
  
  // 아이템 관리
  addItem: (data: Omit<Item, "id" | "createdAt" | "updatedAt" | "label" | "owner" | "ownerId">) => ActionResult<Item>
  updateItem: (id: string, patch: Partial<Omit<Item, "id" | "createdAt">>) => ActionResult
  deleteItem: (id: string) => ActionResult
  
  // 묶음 관리
  addBundle: (opts: {
    slotCode: string
    bundleName: string
    details: { name: string; expiry: string; memo?: string; quantity?: number }[]
  }) => ActionResult<{ ids: string[]; bundleCode: string }>
  
  // 검사 관리
  setLastInspectionNow: () => void
  setInspector: (on: boolean) => void
  
  // 유틸리티
  getSlotLabel: (slotCode: string) => string
  isSlotActive: (slotCode: string) => boolean
}

const FridgeContext = createContext<FridgeContextValue | null>(null)

// 초기 데이터 생성 함수들
function createInitialSlots(): Slot[] {
  return [
    { 
      code: "A1", 
      label: "1층 과일칸", 
      description: "과일과 채소를 보관하는 칸",
      temperature: "refrigerator",
      capacity: 10,
      isActive: true
    },
    { 
      code: "A2", 
      label: "1층 반찬칸", 
      description: "반찬과 음식을 보관하는 칸",
      temperature: "refrigerator", 
      capacity: 15,
      isActive: true
    },
    { 
      code: "B1", 
      label: "2층 냉동칸", 
      description: "냉동 보관이 필요한 음식",
      temperature: "freezer",
      capacity: 20,
      isActive: true
    },
    { 
      code: "B2", 
      label: "2층 공용칸", 
      description: "공용으로 사용하는 칸",
      temperature: "refrigerator",
      capacity: 25,
      isActive: true
    },
  ]
}

function createDemoItems(slots: Slot[]): Item[] {
  const now = Date.now()
  const uid = getCurrentUserId() || "1"
  
  return [
    {
      id: "A1001",
      slotCode: "A1",
      label: slots.find(s => s.code === "A1")?.label || "A1",
      name: "사과",
      expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      owner: "me",
      ownerId: uid,
      quantity: 5,
      unit: "개",
      priority: "medium",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "A2001",
      slotCode: "A2",
      label: slots.find(s => s.code === "A2")?.label || "A2",
      name: "김치",
      expiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      owner: "me",
      ownerId: uid,
      quantity: 1,
      unit: "통",
      priority: "high",
      createdAt: now,
      updatedAt: now,
    }
  ]
}

// 메인 프로바이더 컴포넌트
export function FridgeProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [lastInspectionAt, setLastInspectionAt] = useState<number>(0)
  const [isInspector, setIsInspector] = useState(false)

  // 로직 훅 사용
  const logic = useFridgeLogic(items, slots)

  // 초기 데이터 로드
  useEffect(() => {
    try {
      // 슬롯 로드
      const savedSlots = JSON.parse(localStorage.getItem(STORAGE_KEYS.SLOTS) || "null")
      const slotsList = Array.isArray(savedSlots) && savedSlots.length > 0 ? savedSlots : createInitialSlots()
      setSlots(slotsList)
      
      if (!savedSlots) {
        localStorage.setItem(STORAGE_KEYS.SLOTS, JSON.stringify(slotsList))
      }

      // 아이템 로드
      const savedItems = JSON.parse(localStorage.getItem(STORAGE_KEYS.ITEMS) || "null")
      const itemsList = Array.isArray(savedItems) && savedItems.length > 0 ? savedItems : createDemoItems(slotsList)
      setItems(itemsList)
      
      if (!savedItems) {
        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(itemsList))
      }

      // 검사 정보 로드
      const inspection = Number(localStorage.getItem(STORAGE_KEYS.INSPECTION) || "0")
      setLastInspectionAt(inspection)
    } catch (error) {
      console.error("Failed to load fridge data:", error)
      // 에러 발생 시 기본값 사용
      const defaultSlots = createInitialSlots()
      const defaultItems = createDemoItems(defaultSlots)
      setSlots(defaultSlots)
      setItems(defaultItems)
    }
  }, [])

  // 데이터 저장 함수
  const persistItems = useCallback((newItems: Item[]) => {
    setItems(newItems)
    try {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(newItems))
    } catch (error) {
      console.error("Failed to save items:", error)
    }
  }, [])

  // 아이템 추가
  const addItem = useCallback((data: Omit<Item, "id" | "createdAt" | "updatedAt" | "label" | "owner" | "ownerId">): ActionResult<Item> => {
    try {
      const now = Date.now()
      const nextId = logic.getNextId(data.slotCode)
      const label = getSlotLabel(data.slotCode)
      const currentUserId = getCurrentUserId() || "1"
      
      const newItem: Item = {
        id: nextId,
        slotCode: data.slotCode,
        label,
        name: data.name,
        expiry: data.expiry,
        memo: data.memo,
        quantity: data.quantity,
        unit: data.unit,
        priority: data.priority,
        owner: "me",
        ownerId: currentUserId,
        createdAt: now,
        updatedAt: now,
      }

      const newItems = [newItem, ...items]
      persistItems(newItems)

      return {
        success: true,
        data: newItem,
        message: "물품이 성공적으로 추가되었습니다."
      }
    } catch (error) {
      return {
        success: false,
        error: "물품 추가 중 오류가 발생했습니다.",
        message: error instanceof Error ? error.message : "알 수 없는 오류"
      }
    }
  }, [items, persistItems, logic])

  // 아이템 수정
  const updateItem = useCallback((id: string, patch: Partial<Omit<Item, "id" | "createdAt">>): ActionResult => {
    try {
      const newItems = items.map(item => 
        item.id === id 
          ? { ...item, ...patch, updatedAt: Date.now() }
          : item
      )
      persistItems(newItems)

      return {
        success: true,
        message: "물품이 성공적으로 수정되었습니다."
      }
    } catch (error) {
      return {
        success: false,
        error: "물품 수정 중 오류가 발생했습니다.",
        message: error instanceof Error ? error.message : "알 수 없는 오류"
      }
    }
  }, [items, persistItems])

  // 아이템 삭제
  const deleteItem = useCallback((id: string): ActionResult => {
    try {
      const newItems = items.filter(item => item.id !== id)
      persistItems(newItems)

      return {
        success: true,
        message: "물품이 성공적으로 삭제되었습니다."
      }
    } catch (error) {
      return {
        success: false,
        error: "물품 삭제 중 오류가 발생했습니다.",
        message: error instanceof Error ? error.message : "알 수 없는 오류"
      }
    }
  }, [items, persistItems])

  // 묶음 추가
  const addBundle = useCallback((opts: {
    slotCode: string
    bundleName: string
    details: { name: string; expiry: string; memo?: string; quantity?: number }[]
  }): ActionResult<{ ids: string[]; bundleCode: string }> => {
    try {
      const now = Date.now()
      const label = getSlotLabel(opts.slotCode)
      const bundleId = `${opts.slotCode}-${now}`
      const bundleCode = logic.getNextId(opts.slotCode)
      const currentUserId = getCurrentUserId() || "1"

      const newItems: Item[] = opts.details.map((detail, idx) => {
        const num = String(parseInt(bundleCode.slice(opts.slotCode.length)) + idx).padStart(3, "0")
        const composedName = detail.name.trim() ? `${opts.bundleName} - ${detail.name}` : opts.bundleName
        
        return {
          id: `${opts.slotCode}${num}`,
          slotCode: opts.slotCode,
          label,
          name: composedName,
          expiry: detail.expiry,
          memo: detail.memo,
          quantity: detail.quantity,
          owner: "me",
          ownerId: currentUserId,
          bundleId,
          groupCode: bundleCode,
          createdAt: now,
          updatedAt: now,
        }
      })

      const allItems = [...newItems, ...items]
      persistItems(allItems)

      return {
        success: true,
        data: {
          ids: newItems.map(item => item.id),
          bundleCode
        },
        message: "묶음이 성공적으로 추가되었습니다."
      }
    } catch (error) {
      return {
        success: false,
        error: "묶음 추가 중 오류가 발생했습니다.",
        message: error instanceof Error ? error.message : "알 수 없는 오류"
      }
    }
  }, [items, persistItems, logic])

  // 검사 시간 설정
  const setLastInspectionNow = useCallback(() => {
    const now = Date.now()
    setLastInspectionAt(now)
    try {
      localStorage.setItem(STORAGE_KEYS.INSPECTION, String(now))
    } catch (error) {
      console.error("Failed to save inspection time:", error)
    }
  }, [])

  // 유틸리티 함수들
  const getSlotLabel = useCallback((slotCode: string): string => {
    return slots.find(s => s.code === slotCode)?.label || slotCode
  }, [slots])

  const isSlotActive = useCallback((slotCode: string): boolean => {
    return slots.find(s => s.code === slotCode)?.isActive ?? false
  }, [slots])

  // 컨텍스트 값 메모이제이션
  const contextValue = useMemo<FridgeContextValue>(() => ({
    items,
    slots,
    lastInspectionAt,
    isInspector,
    logic,
    addItem,
    updateItem,
    deleteItem,
    addBundle,
    setLastInspectionNow,
    setInspector: setIsInspector,
    getSlotLabel,
    isSlotActive
  }), [
    items,
    slots,
    lastInspectionAt,
    isInspector,
    logic,
    addItem,
    updateItem,
    deleteItem,
    addBundle,
    setLastInspectionNow,
    getSlotLabel,
    isSlotActive
  ])

  return (
    <FridgeContext.Provider value={contextValue}>
      {children}
    </FridgeContext.Provider>
  )
}

// 컨텍스트 사용 훅
export function useFridge() {
  const context = useContext(FridgeContext)
  if (!context) {
    throw new Error("useFridge must be used within FridgeProvider")
  }
  return context
}
