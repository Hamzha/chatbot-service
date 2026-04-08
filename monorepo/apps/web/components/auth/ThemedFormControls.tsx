import { FormButton as Button } from "@repo/ui/form-button";
import { Input } from "@repo/ui/input";
import { PasswordInput } from "@repo/ui/password-input";
import { themeClasses } from "@/lib/theme";

type BaseFieldProps = {
    error?: string;
};

type TextFieldProps = BaseFieldProps & React.ComponentProps<typeof Input>;

type PasswordFieldProps = BaseFieldProps & React.ComponentProps<typeof PasswordInput>;

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
    isLoading?: boolean;
};

export function AuthTextField({ error, className = "", ...props }: TextFieldProps) {
    return (
        <Input
            {...props}
            className={`${themeClasses.inputBase} ${error ? themeClasses.inputError : ""} ${className}`.trim()}
        />
    );
}

export function AuthPasswordField({ error, className = "", ...props }: PasswordFieldProps) {
    return (
        <PasswordInput
            {...props}
            className={`${themeClasses.inputBase} ${error ? themeClasses.inputError : ""} ${className}`.trim()}
        />
    );
}

export function FieldError({ message }: { message?: string }) {
    if (!message) {
        return null;
    }
    return <p className={themeClasses.errorText}>{message}</p>;
}

export function AuthInfoMessage({ message }: { message?: string | null }) {
    if (!message) {
        return null;
    }
    return <p className={themeClasses.infoMessage}>{message}</p>;
}

export function AuthPasswordHint({ children }: { children: React.ReactNode }) {
    return <p className={themeClasses.passwordHint}>{children}</p>;
}

export function AuthSubmitButton({ className = "", ...props }: SubmitButtonProps) {
    return <Button {...props} className={`${themeClasses.submitButton} ${className}`.trim()} />;
}
