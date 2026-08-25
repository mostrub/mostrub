import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EnumSelect } from "@/components/enum-select"
import {
  DEPARTMENT_LABELS,
  LAPTOP_TYPE_LABELS,
  OS_LABELS,
  STATUS_LABELS,
  optionList,
} from "@/domain/labels"
import {
  ASSET_STATUSES,
  DEPARTMENTS,
  LAPTOP_TYPES,
  OPERATING_SYSTEMS,
  type Laptop,
} from "@/domain/types"

export function LaptopForm({
  value,
  onChange,
}: {
  value: Laptop
  onChange: (next: Laptop) => void
}) {
  function set<K extends keyof Laptop>(key: K, next: Laptop[K]) {
    onChange({ ...value, [key]: next })
  }

  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="laptop-inv">Inventarnummer</FieldLabel>
          <Input
            id="laptop-inv"
            placeholder="Wird beim Speichern vergeben, wenn leer"
            value={value.inventoryNumber}
            onChange={(event) => set("inventoryNumber", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="laptop-tag">Anlagenkennzeichen</FieldLabel>
          <Input
            id="laptop-tag"
            value={value.assetTag}
            onChange={(event) => set("assetTag", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="laptop-serial">Serie</FieldLabel>
          <Input
            id="laptop-serial"
            value={value.serialNumber}
            onChange={(event) => set("serialNumber", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="laptop-host">Hostname</FieldLabel>
          <Input
            id="laptop-host"
            value={value.hostname}
            onChange={(event) => set("hostname", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="laptop-assignee">Zugewiesen an</FieldLabel>
          <Input
            id="laptop-assignee"
            value={value.assignedTo}
            onChange={(event) => set("assignedTo", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="laptop-make">Hersteller</FieldLabel>
          <Input
            id="laptop-make"
            value={value.make}
            onChange={(event) => set("make", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="laptop-model">Modell</FieldLabel>
          <Input
            id="laptop-model"
            value={value.model}
            onChange={(event) => set("model", event.target.value)}
          />
        </Field>
        <EnumSelect
          id="laptop-type"
          label="Typ"
          value={value.laptopType}
          onChange={(next) => set("laptopType", next)}
          items={optionList(LAPTOP_TYPES, LAPTOP_TYPE_LABELS)}
        />
        <EnumSelect
          id="laptop-os"
          label="Betriebssystem"
          value={value.operatingSystem}
          onChange={(next) => set("operatingSystem", next)}
          items={optionList(OPERATING_SYSTEMS, OS_LABELS)}
        />
        <EnumSelect
          id="laptop-dept"
          label="Abteilung"
          value={value.department}
          onChange={(next) => set("department", next)}
          items={optionList(DEPARTMENTS, DEPARTMENT_LABELS)}
        />
        <EnumSelect
          id="laptop-status"
          label="Status"
          value={value.status}
          onChange={(next) => set("status", next)}
          items={optionList(ASSET_STATUSES, STATUS_LABELS)}
        />
        <Field>
          <FieldLabel htmlFor="laptop-location">Standort</FieldLabel>
          <Input
            id="laptop-location"
            value={value.location}
            onChange={(event) => set("location", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="laptop-purchase">Kaufdatum</FieldLabel>
          <Input
            id="laptop-purchase"
            type="date"
            value={value.purchaseDate}
            onChange={(event) => set("purchaseDate", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="laptop-warranty">Garantieende</FieldLabel>
          <Input
            id="laptop-warranty"
            type="date"
            value={value.warrantyEnd}
            onChange={(event) => set("warrantyEnd", event.target.value)}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="laptop-notes">Notizen</FieldLabel>
        <Textarea
          id="laptop-notes"
          value={value.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </Field>
    </FieldGroup>
  )
}
