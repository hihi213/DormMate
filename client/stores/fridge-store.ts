import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Item, Slot, Inspection } from '@/components/fridge/types'
import { getCurrentUserId } from '@/lib/auth'

// 스토리지 키 상수
const STORAGE_KEYS = {
  ITEMS: "fridge-items-v1",
  SLOTS: "fridge-slots-v1",
  INSPECTION: "fridge-inspection-v1"
} as const

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

// 냉장고 상태 타입
interface FridgeState {
  // 상태
  items: Item[]
  slots: Slot[]
  lastInspectionAt: number
  isInspector: boolean
  
  // 액션
  addItem: (data: Omit<Item, "id" | "createdAt" | "updatedAt" | "label" | "owner" | "ownerId">) => Item
  updateItem: (id: string, patch: Partial<Omit<Item, "id" | "createdAt">>) => void
  deleteItem: (id: string) => void
  
  addBundle: (opts: {
    slotCode: string
    bundleName: string
    details: { name: string; expiry: string; memo?: string; quantity?: number }[]
  }) => { ids: string[]; bundleCode: string }
  
  setLastInspectionNow: () => void
  setInspector: (on: boolean) => void
  
  // 유틸리티
  getSlotLabel: (slotCode: string) => string
  isSlotActive: (slotCode: string) => boolean
  getNextId: (slotCode: string) => string
  
  // 초기화
  initialize: () => void
  reset: () => void
}

// 냉장고 스토어 생성
export const useFridgeStore = create<FridgeState>()(
  devtools(
    persist(
      (set, get) => ({
        // 초기 상태
        items: [],
        slots: [],
        lastInspectionAt: 0,
        isInspector: false,

        // 아이템 추가
        addItem: (data) => {
          const state = get()
          const now = Date.now()
          const nextId = state.getNextId(data.slotCode)
          const label = state.getSlotLabel(data.slotCode)
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

          set((state) => ({
            items: [newItem, ...state.items]
          }))

          return newItem
        },

        // 아이템 수정
        updateItem: (id, patch) => {
          set((state) => ({
            items: state.items.map(item => 
              item.id === id 
                ? { ...item, ...patch, updatedAt: Date.now() }
                : item
            )
          }))
        },

        // 아이템 삭제
        deleteItem: (id) => {
          set((state) => ({
            items: state.items.filter(item => item.id !== id)
          }))
        },

        // 묶음 추가
        addBundle: (opts) => {
          const state = get()
          const now = Date.now()
          const label = state.getSlotLabel(opts.slotCode)
          const bundleId = `${opts.slotCode}-${now}`
          const bundleCode = state.getNextId(opts.slotCode)
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

          set((state) => ({
            items: [...newItems, ...state.items]
          }))

          return { 
            ids: newItems.map(item => item.id), 
            bundleCode 
          }
        },

        // 검사 시간 설정
        setLastInspectionNow: () => {
          set({ lastInspectionAt: Date.now() })
        },

        // 검사자 모드 설정
        setInspector: (on) => {
          set({ isInspector: on })
        },

        // 슬롯 라벨 가져오기
        getSlotLabel: (slotCode) => {
          const state = get()
          return state.slots.find(s => s.code === slotCode)?.label || slotCode
        },

        // 슬롯 활성 상태 확인
        isSlotActive: (slotCode) => {
          const state = get()
          return state.slots.find(s => s.code === slotCode)?.isActive ?? false
        },

        // 다음 ID 생성
        getNextId: (slotCode) => {
          const state = get()
          const existingIds = state.items
            .filter(item => item.slotCode === slotCode)
            .map(item => {
              const numPart = item.id.replace(slotCode, "")
              return parseInt(numPart, 10)
            })
            .filter(num => !isNaN(num))

          const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1
          return `${slotCode}${String(nextNum).padStart(3, "0")}`
        },

        // 초기화
        initialize: () => {
          try {
            // 슬롯 초기화
            const savedSlots = JSON.parse(localStorage.getItem(STORAGE_KEYS.SLOTS) || "null")
            const slotsList = Array.isArray(savedSlots) && savedSlots.length > 0 ? savedSlots : createInitialSlots()
            
            if (!savedSlots) {
              localStorage.setItem(STORAGE_KEYS.SLOTS, JSON.stringify(slotsList))
            }

            // 아이템 초기화
            const savedItems = JSON.parse(localStorage.getItem(STORAGE_KEYS.ITEMS) || "null")
            const itemsList = Array.isArray(savedItems) && savedItems.length > 0 ? savedItems : createDemoItems(slotsList)
            
            if (!savedItems) {
              localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(itemsList))
            }

            // 검사 정보 초기화
            const inspection = Number(localStorage.getItem(STORAGE_KEYS.INSPECTION) || "0")

            set({
              slots: slotsList,
              items: itemsList,
              lastInspectionAt: inspection
            })
          } catch (error) {
            console.error("Failed to load fridge data:", error)
            // 에러 발생 시 기본값 사용
            const defaultSlots = createInitialSlots()
            const defaultItems = createDemoItems(defaultSlots)
            set({
              slots: defaultSlots,
              items: defaultItems,
              lastInspectionAt: 0
            })
          }
        },

        // 리셋
        reset: () => {
          set({
            items: [],
            slots: [],
            lastInspectionAt: 0,
            isInspector: false
          })
        }
      }),
      {
        name: 'fridge-store',
        partialize: (state) => ({
          items: state.items,
          slots: state.slots,
          lastInspectionAt: state.lastInspectionAt
        })
      }
    ),
    {
      name: 'fridge-store'
    }
  )
)
