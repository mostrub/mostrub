import { Badge } from "@/components/ui/badge"
import { STATUS_LABELS } from "@/domain/labels"
import type { AssetStatus } from "@/domain/types"

function variantFor(status: AssetStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "in-service":
      return "outline"
    case "spare":
      return "secondary"
    case "repair":
      return "default"
    case "lost":
      return "destructive"
    case "retired":
      return "secondary"
    case "destroyed":
      return "destructive"
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <Badge
      variant={variantFor(status)}
      className={
        status === "repair"
          ? "bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100"
          : status === "in-service"
            ? "text-muted-foreground"
            : undefined
      }
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}
