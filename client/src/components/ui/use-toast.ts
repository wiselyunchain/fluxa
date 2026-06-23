import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive";

interface ToastArgs {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

export function useToast() {
  return {
    toast(args: ToastArgs) {
      const fn = args.variant === "destructive" ? sonnerToast.error : sonnerToast;
      fn(args.title, { description: args.description });
    },
  };
}
