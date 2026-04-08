import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import Link from "next/link";
import { themedPrimitivesThemeClasses } from "@/lib/theme/components/themed-primitives.theme";

type BaseProps = {
    className?: string;
};

function joinClasses(...classes: Array<string | undefined>) {
    return classes.filter(Boolean).join(" ");
}

export function ThemedCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement> & BaseProps) {
    return <div {...props} className={joinClasses(themedPrimitivesThemeClasses.card, className)} />;
}

export function ThemedStrongCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement> & BaseProps) {
    return <div {...props} className={joinClasses(themedPrimitivesThemeClasses.strongCard, className)} />;
}

export function ThemedInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement> & BaseProps) {
    return (
        <input
            {...props}
            className={joinClasses(
                themedPrimitivesThemeClasses.input,
                className,
            )}
        />
    );
}

export function ThemedSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & BaseProps) {
    return (
        <select
            {...props}
            className={joinClasses(
                themedPrimitivesThemeClasses.select,
                className,
            )}
        />
    );
}

export function ThemedPrimaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & BaseProps) {
    return (
        <button
            {...props}
            className={joinClasses(
                themedPrimitivesThemeClasses.primaryButton,
                className,
            )}
        />
    );
}

export function ThemedGhostButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & BaseProps) {
    return (
        <button
            {...props}
            className={joinClasses(
                themedPrimitivesThemeClasses.ghostButton,
                className,
            )}
        />
    );
}

export function ThemedDangerButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & BaseProps) {
    return (
        <button
            {...props}
            className={joinClasses(
                themedPrimitivesThemeClasses.dangerButton,
                className,
            )}
        />
    );
}

export function ThemedPrimaryLink({ href, className, ...props }: React.ComponentProps<typeof Link> & BaseProps) {
    return (
        <Link
            href={href}
            {...props}
            className={joinClasses(
                themedPrimitivesThemeClasses.primaryLink,
                className,
            )}
        />
    );
}

export function ThemedGhostLink({ href, className, ...props }: React.ComponentProps<typeof Link> & BaseProps) {
    return (
        <Link
            href={href}
            {...props}
            className={joinClasses(
                themedPrimitivesThemeClasses.ghostLink,
                className,
            )}
        />
    );
}