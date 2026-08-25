import { Badge } from "@/components/ui/badge"
import { STATUS_LABELS } from "@/domain/labels"
import type { AssetStatus } from "@/domain/types"

function variantFor(status: AssetStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "in-service":
      return "default"
    case "spare":
      return "secondary"
    case "repair":
      return "outline"
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
  return <Badge variant={variantFor(status)}>{STATUS_LABELS[status]}</Badge>
}
