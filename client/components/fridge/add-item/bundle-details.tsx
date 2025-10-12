"use client"

import { clampToToday, ddayInlineLabel, daysDiffFromToday, toYMD } from "@/lib/date-utils"
import type { DetailRowState } from "./types"

interface BundleDetailsProps {
  name: string
  expiry: string
  rows: DetailRowState[]
  onRowUpdate: (idx: number, updates: Partial<DetailRowState>) => void
  detailsOpen: boolean
  onToggleDetails: () => void
}

export function BundleDetails({
  name,
  expiry,
  rows,
  onRowUpdate,
  detailsOpen,
  onToggleDetails,
}: BundleDetailsProps) {
  if (rows.length < 2) return null

  return (
    <div className="space-y-4">
      {/* 제목 */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900">
          {`세부물품 ${rows.length}개`}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {"각 물품의 이름과 유통기한을 개별적으로 설정할 수 있습니다."}
        </p>
      </div>

      {/* 세부물품 목록 */}
      <div className="space-y-3">
        {rows.map((row, idx) => {
          const repNameTrim = name.trim()
          const nameChanged = row.name.trim() !== repNameTrim
          const valueExpiry = row.customExpiry ? row.expiry : expiry
          const diff = daysDiffFromToday(valueExpiry)
          const changedDate = row.customExpiry
          const ddayText = ddayInlineLabel(diff)
          const ddayColor = diff < 0 ? "text-rose-600" : diff <= 1 ? "text-amber-600" : "text-emerald-700"

          return (
            <div key={idx} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-gray-700">
                  {`#${idx + 1}`}
                </span>
                {nameChanged && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                    {"수정됨"}
                  </span>
                )}
              </div>
              
              <div className="grid gap-3">
                {/* 세부명 */}
                <div>
                  <label htmlFor={`row-name-${idx}`} className="block text-sm font-medium text-gray-700 mb-1">
                    {"세부명"}
                  </label>
                  <input
                    id={`row-name-${idx}`}
                    value={row.name}
                    maxLength={20}
                    onChange={(e) => {
                      const newName = e.target.value.slice(0, 20)
                      const isSameAsRep = newName.trim() === name.trim()
                      onRowUpdate(idx, { 
                        name: newName,
                        customName: !isSameAsRep
                      })
                    }}
                    className={`w-full h-10 rounded-md border px-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                      nameChanged ? "text-gray-900 border-amber-300" : "text-gray-500 border-gray-300"
                    }`}
                    placeholder="세부물품명을 입력하세요"
                  />
                </div>

                {/* 유통기한 */}
                <div>
                  <label htmlFor={`row-expiry-${idx}`} className="block text-sm font-medium text-gray-700 mb-1">
                    {"유통기한"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id={`row-expiry-${idx}`}
                      type="date"
                      value={valueExpiry}
                      min={toYMD(new Date())}
                      onChange={(e) => {
                        const val = clampToToday(e.target.value)
                        const isSameAsRep = val === expiry
                        onRowUpdate(idx, {
                          customExpiry: !isSameAsRep,
                          expiry: val,
                        })
                      }}
                      className="h-10 flex-1 rounded-md border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <span
                      className={`text-sm whitespace-nowrap px-2 py-1 rounded ${
                        changedDate ? `${ddayColor} bg-white` : "text-transparent"
                      }`}
                    >
                      {changedDate ? ddayText : "placeholder"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
