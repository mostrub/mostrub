import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EnumSelect } from "@/components/enum-select"
import { DEPARTMENT_LABELS, LICENSE_TYPE_LABELS, optionList } from "@/domain/labels"
import { DEPARTMENTS, LICENSE_TYPES, type SoftwareLicense } from "@/domain/types"

export function SoftwareForm({
  value,
  onChange,
}: {
  value: SoftwareLicense
  onChange: (next: SoftwareLicense) => void
}) {
  function set<K extends keyof SoftwareLicense>(key: K, next: SoftwareLicense[K]) {
    onChange({ ...value, [key]: next })
  }

  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="sw-inv">Inventory #</FieldLabel>
          <Input
            id="sw-inv"
            placeholder="Assigned on save if blank"
            value={value.inventoryNumber}
            onChange={(event) => set("inventoryNumber", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sw-name">Name</FieldLabel>
          <Input
            id="sw-name"
            value={value.name}
            onChange={(event) => set("name", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sw-vendor">Vendor</FieldLabel>
          <Input
            id="sw-vendor"
            value={value.vendor}
            onChange={(event) => set("vendor", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sw-entitlement">Entitlement / key</FieldLabel>
          <Input
            id="sw-entitlement"
            value={value.entitlementId}
            onChange={(event) => set("entitlementId", event.target.value)}
          />
        </Field>
        <EnumSelect
          id="sw-type"
          label="License type"
          value={value.licenseType}
          onChange={(next) => set("licenseType", next)}
          items={optionList(LICENSE_TYPES, LICENSE_TYPE_LABELS)}
        />
        <Field>
          <FieldLabel htmlFor="sw-purchased">Seats purchased</FieldLabel>
          <Input
            id="sw-purchased"
            type="number"
            min={0}
            value={value.seatsPurchased}
            onChange={(event) => set("seatsPurchased", Number(event.target.value))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sw-assigned">Seats assigned</FieldLabel>
          <Input
            id="sw-assigned"
            type="number"
            min={0}
            value={value.seatsAssigned}
            onChange={(event) => set("seatsAssigned", Number(event.target.value))}
          />
          {value.seatsAssigned > value.seatsPurchased ? (
            <p className="text-sm text-destructive">
              Assigned seats exceed purchased seats. This will show as an audit finding.
            </p>
          ) : null}
        </Field>
        <EnumSelect
          id="sw-dept"
          label="Department"
          value={value.department}
          onChange={(next) => set("department", next)}
          items={optionList(DEPARTMENTS, DEPARTMENT_LABELS)}
        />
        <Field>
          <FieldLabel htmlFor="sw-renewal">Renewal date</FieldLabel>
          <Input
            id="sw-renewal"
            type="date"
            value={value.renewalDate}
            onChange={(event) => set("renewalDate", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sw-cost">Annual cost</FieldLabel>
          <Input
            id="sw-cost"
            type="number"
            min={0}
            value={value.annualCost}
            onChange={(event) => set("annualCost", Number(event.target.value))}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="sw-notes">Notes</FieldLabel>
        <Textarea
          id="sw-notes"
          value={value.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </Field>
    </FieldGroup>
  )
}
