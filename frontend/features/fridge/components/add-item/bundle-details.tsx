"use client"

import type { DetailRowState } from "./types"
import { ExpiryInput } from "@/components/shared/expiry-input"

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
          const valueExpiry = row.customExpiry ? row.expiryDate : expiry
          const changedDate = row.customExpiry

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
                <ExpiryInput
                  id={`row-expiry-${idx}`}
                  label="유통기한"
                  value={valueExpiry}
                  onChange={(val) => {
                    const isSameAsRep = val === expiry
                    onRowUpdate(idx, {
                      customExpiry: !isSameAsRep,
                      expiryDate: val,
                    })
                  }}
                  helperText={changedDate ? "대표값에서 변경됨" : "대표값과 동일"}
                  warningThresholdDays={3}
                  presets={[]}
                  className="flex-1"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
