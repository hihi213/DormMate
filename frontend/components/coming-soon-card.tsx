"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type ComingSoonCardProps = {
  title: string
  description: string
  icon?: ReactNode
  badge?: string
  note?: string
  className?: string
  children?: ReactNode
}

export function ComingSoonCard({
  title,
  description,
  icon,
  badge,
  note,
  className,
  children,
}: ComingSoonCardProps) {
  return (
    <Card className={cn("rounded-3xl border border-slate-200 bg-white/90 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-start gap-3">
        {icon && <span className="rounded-full bg-slate-100 p-2 text-slate-700">{icon}</span>}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {badge && (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {badge}
              </Badge>
            )}
            <CardTitle className="text-base font-semibold text-slate-900">{title}</CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        {note && <p>{note}</p>}
        {children}
      </CardContent>
    </Card>
  )
}
