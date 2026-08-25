import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EnumSelect } from "@/components/enum-select"
import { HardwareStatusField } from "@/components/hardware-status-field"
import {
  DEPARTMENT_LABELS,
  PRINTER_TYPE_LABELS,
  optionList,
} from "@/domain/labels"
import { DEPARTMENTS, PRINTER_TYPES, type Printer } from "@/domain/types"

export function PrinterForm({
  value,
  onChange,
}: {
  value: Printer
  onChange: (next: Printer) => void
}) {
  function set<K extends keyof Printer>(key: K, next: Printer[K]) {
    onChange({ ...value, [key]: next })
  }

  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="printer-inv">Inventarnummer</FieldLabel>
          <Input
            id="printer-inv"
            placeholder="Wird beim Speichern vergeben, wenn leer"
            value={value.inventoryNumber}
            onChange={(event) => set("inventoryNumber", event.target.value)}
          />
          <FieldDescription>
            Werkweit eindeutig. Leer lassen vergibt die nächste INV-Nummer.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="printer-tag">Anlagenkennzeichen</FieldLabel>
          <Input
            id="printer-tag"
            placeholder="z. B. PR-2001"
            value={value.assetTag}
            onChange={(event) => set("assetTag", event.target.value)}
          />
          <FieldDescription>Aufkleber am Gerät, nicht die Inventarnummer.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="printer-serial">Serie</FieldLabel>
          <Input
            id="printer-serial"
            placeholder="Hersteller-Seriennummer"
            value={value.serialNumber}
            onChange={(event) => set("serialNumber", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="printer-make">Hersteller</FieldLabel>
          <Input
            id="printer-make"
            value={value.make}
            onChange={(event) => set("make", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="printer-model">Modell</FieldLabel>
          <Input
            id="printer-model"
            value={value.model}
            onChange={(event) => set("model", event.target.value)}
          />
        </Field>
        <EnumSelect
          id="printer-type"
          label="Typ"
          value={value.printerType}
          onChange={(next) => set("printerType", next)}
          items={optionList(PRINTER_TYPES, PRINTER_TYPE_LABELS)}
        />
        <EnumSelect
          id="printer-dept"
          label="Abteilung"
          value={value.department}
          onChange={(next) => set("department", next)}
          items={optionList(DEPARTMENTS, DEPARTMENT_LABELS)}
        />
        <HardwareStatusField
          id="printer-status"
          value={value.status}
          onChange={(next) => set("status", next)}
        />
        <Field>
          <FieldLabel htmlFor="printer-location">Standort</FieldLabel>
          <Input
            id="printer-location"
            value={value.location}
            onChange={(event) => set("location", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="printer-ip">IP-Adresse</FieldLabel>
          <Input
            id="printer-ip"
            value={value.ipAddress}
            onChange={(event) => set("ipAddress", event.target.value)}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="printer-notes">Notizen</FieldLabel>
        <Textarea
          id="printer-notes"
          value={value.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </Field>
    </FieldGroup>
  )
}
