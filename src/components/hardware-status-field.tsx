import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { EnumSelect } from "@/components/enum-select"
import { STATUS_LABELS, optionList } from "@/domain/labels"
import { EDITABLE_ASSET_STATUSES, type AssetStatus } from "@/domain/types"

export function HardwareStatusField({
  id,
  value,
  onChange,
}: {
  id: string
  value: AssetStatus
  onChange: (next: AssetStatus) => void
}) {
  if (value === "destroyed") {
    return (
      <Field>
        <FieldLabel>Status</FieldLabel>
        <p className="text-sm font-medium">{STATUS_LABELS.destroyed}</p>
        <FieldDescription>
          Status folgt dem Vernichtungsregister. Den Eintrag dort entfernen, um das
          Gerät wieder ins Register zu holen.
        </FieldDescription>
      </Field>
    )
  }

  return (
    <EnumSelect
      id={id}
      label="Status"
      value={value}
      onChange={onChange}
      items={optionList(EDITABLE_ASSET_STATUSES, STATUS_LABELS)}
    />
  )
}
