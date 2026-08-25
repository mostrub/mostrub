import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EnumSelect } from "@/components/enum-select"
import {
  ASSET_KIND_LABELS,
  DEPARTMENT_LABELS,
  DESTRUCTION_METHOD_LABELS,
  optionList,
} from "@/domain/labels"
import {
  ASSET_KINDS,
  DEPARTMENTS,
  DESTRUCTION_METHODS,
  type DestructionRecord,
} from "@/domain/types"

export function DestructionForm({
  value,
  onChange,
}: {
  value: DestructionRecord
  onChange: (next: DestructionRecord) => void
}) {
  function set<K extends keyof DestructionRecord>(
    key: K,
    next: DestructionRecord[K],
  ) {
    onChange({ ...value, [key]: next })
  }

  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <EnumSelect
          id="dst-kind"
          label="Asset kind"
          value={value.assetKind}
          onChange={(next) => set("assetKind", next)}
          items={optionList(ASSET_KINDS, ASSET_KIND_LABELS)}
        />
        <Field>
          <FieldLabel htmlFor="dst-tag">Asset tag</FieldLabel>
          <Input
            id="dst-tag"
            value={value.assetTag}
            onChange={(event) => set("assetTag", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dst-serial">Serial</FieldLabel>
          <Input
            id="dst-serial"
            value={value.serialNumber}
            onChange={(event) => set("serialNumber", event.target.value)}
          />
        </Field>
        <EnumSelect
          id="dst-dept"
          label="Department"
          value={value.department}
          onChange={(next) => set("department", next)}
          items={optionList(DEPARTMENTS, DEPARTMENT_LABELS)}
        />
        <EnumSelect
          id="dst-method"
          label="Method"
          value={value.method}
          onChange={(next) => set("method", next)}
          items={optionList(DESTRUCTION_METHODS, DESTRUCTION_METHOD_LABELS)}
        />
        <Field>
          <FieldLabel htmlFor="dst-date">Destroyed on</FieldLabel>
          <Input
            id="dst-date"
            type="date"
            value={value.destroyedOn}
            onChange={(event) => set("destroyedOn", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dst-witness">Witness</FieldLabel>
          <Input
            id="dst-witness"
            value={value.witnessedBy}
            onChange={(event) => set("witnessedBy", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dst-cert">Certificate / ticket</FieldLabel>
          <Input
            id="dst-cert"
            value={value.certificateId}
            onChange={(event) => set("certificateId", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dst-reason">Reason</FieldLabel>
          <Input
            id="dst-reason"
            value={value.reason}
            onChange={(event) => set("reason", event.target.value)}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="dst-notes">Notes</FieldLabel>
        <Textarea
          id="dst-notes"
          value={value.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </Field>
    </FieldGroup>
  )
}
