"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { AuthUser } from "@/lib/auth"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isLoggedIn: boolean
  user: AuthUser | null
}

export default function ProfileDialog({ open, onOpenChange, isLoggedIn, user }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{"내 정보"}</DialogTitle>
        </DialogHeader>
        {isLoggedIn ? (
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">{"아이디: "}</span>
              <span className="font-medium">{user?.loginId}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{"이름: "}</span>
              <span className="font-medium">{user?.name}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{"호실: "}</span>
              <span className="font-medium">{user?.room}</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{"로그인 후 이용 가능합니다."}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
