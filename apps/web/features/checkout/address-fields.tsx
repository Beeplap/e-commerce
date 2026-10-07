"use client";
import {
  StorefrontInput,
  StorefrontSelect,
} from "@/components/storefront/controls";
export const addressFields = {
  full_name: {
    label: "Full name",
    maximum: 120,
    autocomplete: "shipping name",
  },
  phone: { label: "Phone number", maximum: 32, autocomplete: "shipping tel" },
  line1: {
    label: "Street address",
    maximum: 255,
    autocomplete: "shipping address-line1",
  },
  line2: {
    label: "Apartment, suite, etc. (optional)",
    maximum: 255,
    autocomplete: "shipping address-line2",
  },
  city: {
    label: "City",
    maximum: 100,
    autocomplete: "shipping address-level2",
  },
  state: {
    label: "State / province",
    maximum: 100,
    autocomplete: "shipping address-level1",
  },
  postal_code: {
    label: "Postal code",
    maximum: 32,
    autocomplete: "shipping postal-code",
  },
  country: { label: "Country", maximum: 2, autocomplete: "shipping country" },
} as const;
export type Address = Record<keyof typeof addressFields, string>;
export const emptyAddress: Address = {
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
};
export function addressErrors(address: Address) {
  const errors: Record<string, string> = {};
  for (const [key, field] of Object.entries(addressFields)) {
    const value = address[key as keyof Address].trim();
    if (
      (key !== "line2" && !value) ||
      value.length > field.maximum ||
      (key === "country" && !/^[A-Z]{2}$/.test(value))
    )
      errors[key] = `Enter a valid ${field.label.toLowerCase()}.`;
  }
  return errors;
}
export function AddressFields({
  value,
  errors,
  onChange,
  onBlur,
}: {
  value: Address;
  errors: Record<string, string>;
  onChange: (field: keyof Address, value: string) => void;
  onBlur: (field: keyof Address) => void;
}) {
  return (
    <div className="sf-checkout-fields">
      {Object.entries(addressFields).map(([name, field]) => {
        const key = name as keyof Address;
        return key === "country" ? (
          <StorefrontSelect
            key={key}
            name={key}
            id={`checkout-${key}`}
            label={field.label}
            autoComplete={field.autocomplete}
            value={value[key]}
            error={errors[key]}
            onChange={(event) => onChange(key, event.target.value)}
            onBlur={() => onBlur(key)}
            required
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
          </StorefrontSelect>
        ) : (
          <StorefrontInput
            key={key}
            id={`checkout-${key}`}
            name={key}
            label={field.label}
            autoComplete={field.autocomplete}
            type={key === "phone" ? "tel" : "text"}
            maxLength={field.maximum}
            required={key !== "line2"}
            value={value[key]}
            error={errors[key]}
            onChange={(event) => onChange(key, event.target.value)}
            onBlur={() => onBlur(key)}
          />
        );
      })}
    </div>
  );
}
