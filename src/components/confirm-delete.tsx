import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Field, FieldLabel } from "@/components/ui/field"

export function deleteConfirmMatches(typed: string, required: string): boolean {
  const needle = typed.trim().toLowerCase()
  const expected = required.trim().toLowerCase()
  return expected.length > 0 && needle === expected
}

export function ConfirmDelete({
  label,
  confirmText,
  onConfirm,
  description = "Der Datensatz wird dauerhaft aus dem Register entfernt. Das lässt sich nicht rückgängig machen.",
}: {
  label: string
  confirmText: string
  onConfirm: () => void
  description?: string
}) {
  const fieldId = useId()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const ready = deleteConfirmMatches(typed, confirmText)

  function close() {
    setOpen(false)
    setTyped("")
  }

  function confirm() {
    if (!ready) {
      return
    }
    onConfirm()
    close()
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setTyped("")
        }
      }}
    >
      <AlertDialogTrigger
        render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}
      >
        Löschen
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{label} löschen?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            confirm()
          }}
        >
          <Field>
            <FieldLabel htmlFor={fieldId}>
              Zum Bestätigen {confirmText} eintippen
            </FieldLabel>
            <Input
              id={fieldId}
              value={typed}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setTyped(event.target.value)}
            />
          </Field>
          <AlertDialogFooter className="mx-0 mb-0">
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={!ready}>
              Endgültig löschen
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
