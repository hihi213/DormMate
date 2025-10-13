"use client"

import type React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  loginId: string
  loginPw: string
  onChangeId: (value: string) => void
  onChangePw: (value: string) => void
  onSubmit: (event?: React.FormEvent) => void
  error: string
}

export default function LoginDialog({
  open,
  onOpenChange,
  loginId,
  loginPw,
  onChangeId,
  onChangePw,
  onSubmit,
  error,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{"로그인"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="login-id">{"아이디"}</Label>
            <Input
              id="login-id"
              value={loginId}
              onChange={(e) => onChangeId(e.target.value)}
              placeholder="예: 1, 2, 3"
              inputMode="numeric"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="login-pw">{"비밀번호"}</Label>
            <Input
              id="login-pw"
              type="password"
              value={loginPw}
              onChange={(e) => onChangePw(e.target.value)}
              placeholder="예: 1, 2, 3"
            />
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-between items-center pt-2">
            <div className="text-[11px] text-muted-foreground">
              {"테스트 계정: 1/1 (김승현 301호), 2/2 (이번 202호), 3/3 (삼번 203호)"}
            </div>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
              {"로그인"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
