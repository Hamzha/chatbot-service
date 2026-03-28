import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    id: string;
};

export function Input({ label, id, className = "", ...props }: InputProps) {
    return (
        <label className="flex w-full flex-col gap-1 text-sm text-zinc-700">
            <span className="font-medium">{label}</span>
            <input
                id={id}
                className={`rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-sky-500 transition focus:ring-2 ${className}`}
                {...props}
            />
        </label>
    );
}
