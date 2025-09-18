import { Check } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, onCheckedChange, ...props }, ref) => {
  return (
    <div className="relative">
      <input
        type="checkbox"
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
          "sr-only", // Hide default checkbox
          className,
        )}
        ref={ref}
        onChange={(e) => {
          props.onChange?.(e);
          onCheckedChange?.(e.target.checked);
        }}
        {...props}
      />
      <div
        className={cn(
          "h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          "flex items-center justify-center",
          "cursor-pointer",
          props.checked ? "bg-primary text-primary-foreground" : "",
        )}
      >
        <Check className={`h-3 w-3 transition-opacity ${props.checked ? "opacity-100" : "opacity-0"}`} />
      </div>
    </div>
  );
});
Checkbox.displayName = "Checkbox";

export { Checkbox };
