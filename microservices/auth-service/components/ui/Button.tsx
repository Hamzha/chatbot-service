import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
    isLoading?: boolean;
};

export function Button({ children, isLoading, className = "", ...props }: ButtonProps) {
    return (
        <button
            {...props}
            className={`w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            disabled={isLoading || props.disabled}
            type={props.type ?? "button"}
        >
            {isLoading ? "Please wait..." : children}
        </button>
    );
}
