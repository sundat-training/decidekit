import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  /** Radio group name; must be unique in the document. */
  name: string;
  legend: string;
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
}

/**
 * A small mutually exclusive control. Native radio inputs carry the keyboard
 * behaviour and the group semantics, so this stays a styling layer.
 */
export function Segmented<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  disabled = false,
}: SegmentedProps<T>) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
        {legend}
      </legend>
      <div className="inline-flex w-fit flex-wrap gap-0.5 rounded-lg border border-input bg-card p-0.5 shadow-xs">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "relative cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors select-none",
              "text-muted-foreground hover:text-foreground",
              "has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:hover:text-primary-foreground",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
              "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
            )}
          >
            {/* Covers the segment: the whole area is the hit target, and the
                control stays a real radio for keyboard and assistive tech. */}
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="absolute inset-0 cursor-pointer appearance-none"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
