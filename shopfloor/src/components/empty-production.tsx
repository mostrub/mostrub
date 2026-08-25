import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { useFloorline } from "@/state/floorline-store"

export function EmptyProduction(args: {
  title: string
  description?: string
}) {
  const { ingestDemo, setView, loading, ready } = useFloorline()
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{args.title}</EmptyTitle>
        <EmptyDescription>
          {args.description ??
            "Load the demo pack or drop XML from the share."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => void ingestDemo()}
            disabled={!ready || loading}
          >
            Load demo production
          </Button>
          <Button variant="outline" onClick={() => setView("ingest")}>
            Go to Ingest
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}
