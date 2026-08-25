import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EnumSelect } from "@/components/enum-select"
import {
  DEPARTMENT_LABELS,
  PRINTER_TYPE_LABELS,
  STATUS_LABELS,
  optionList,
} from "@/domain/labels"
import {
  ASSET_STATUSES,
  DEPARTMENTS,
  PRINTER_TYPES,
  type Printer,
} from "@/domain/types"

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
          <FieldLabel htmlFor="printer-tag">Asset tag</FieldLabel>
          <Input
            id="printer-tag"
            value={value.assetTag}
            onChange={(event) => set("assetTag", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="printer-serial">Serial</FieldLabel>
          <Input
            id="printer-serial"
            value={value.serialNumber}
            onChange={(event) => set("serialNumber", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="printer-make">Make</FieldLabel>
          <Input
            id="printer-make"
            value={value.make}
            onChange={(event) => set("make", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="printer-model">Model</FieldLabel>
          <Input
            id="printer-model"
            value={value.model}
            onChange={(event) => set("model", event.target.value)}
          />
        </Field>
        <EnumSelect
          id="printer-type"
          label="Type"
          value={value.printerType}
          onChange={(next) => set("printerType", next)}
          items={optionList(PRINTER_TYPES, PRINTER_TYPE_LABELS)}
        />
        <EnumSelect
          id="printer-dept"
          label="Department"
          value={value.department}
          onChange={(next) => set("department", next)}
          items={optionList(DEPARTMENTS, DEPARTMENT_LABELS)}
        />
        <EnumSelect
          id="printer-status"
          label="Status"
          value={value.status}
          onChange={(next) => set("status", next)}
          items={optionList(ASSET_STATUSES, STATUS_LABELS)}
        />
        <Field>
          <FieldLabel htmlFor="printer-location">Location</FieldLabel>
          <Input
            id="printer-location"
            value={value.location}
            onChange={(event) => set("location", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="printer-ip">IP address</FieldLabel>
          <Input
            id="printer-ip"
            value={value.ipAddress}
            onChange={(event) => set("ipAddress", event.target.value)}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="printer-notes">Notes</FieldLabel>
        <Textarea
          id="printer-notes"
          value={value.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </Field>
    </FieldGroup>
  )
}
