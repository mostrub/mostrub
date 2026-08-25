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
            "Demopaket laden oder XML aus der Freigabe ablegen."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => void ingestDemo()}
            disabled={!ready || loading}
          >
            Demo-Produktion laden
          </Button>
          <Button variant="outline" onClick={() => setView("ingest")}>
            Zum Import
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}
