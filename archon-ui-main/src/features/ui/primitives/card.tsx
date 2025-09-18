import type React from "react";
import { forwardRef } from "react";

// Card component variants and styling
const cardVariants = {
  default: "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700",
  ghost: "bg-transparent",
  outline: "border border-gray-200 dark:border-gray-700 bg-transparent",
} as const;

type CardVariant = keyof typeof cardVariants;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className = "", variant = "default", ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`
          rounded-lg shadow-sm
          ${cardVariants[variant]}
          ${className}
        `}
      {...props}
    />
  );
});

Card.displayName = "Card";

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(({ className = "", ...props }, ref) => {
  return <div ref={ref} className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props} />;
});

CardHeader.displayName = "CardHeader";

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = forwardRef<HTMLParagraphElement, CardTitleProps>(({ className = "", ...props }, ref) => {
  return <h3 ref={ref} className={`text-2xl font-semibold leading-none tracking-tight ${className}`} {...props} />;
});

CardTitle.displayName = "CardTitle";

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className = "", ...props }, ref) => {
    return <p ref={ref} className={`text-sm text-gray-500 dark:text-gray-400 ${className}`} {...props} />;
  },
);

CardDescription.displayName = "CardDescription";

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(({ className = "", ...props }, ref) => {
  return <div ref={ref} className={`p-6 pt-0 ${className}`} {...props} />;
});

CardContent.displayName = "CardContent";

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(({ className = "", ...props }, ref) => {
  return <div ref={ref} className={`flex items-center p-6 pt-0 ${className}`} {...props} />;
});

CardFooter.displayName = "CardFooter";
