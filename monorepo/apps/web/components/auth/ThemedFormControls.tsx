import { FormButton as Button } from "@repo/ui/form-button";
import { Input } from "@repo/ui/input";
import { PasswordInput } from "@repo/ui/password-input";
import { themedFormControlsThemeClasses } from "@/lib/theme/components/themed-form-controls.theme";

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
            className={`${themedFormControlsThemeClasses.inputBase} ${error ? themedFormControlsThemeClasses.inputError : ""} ${className}`.trim()}
        />
    );
}

export function AuthPasswordField({ error, className = "", ...props }: PasswordFieldProps) {
    return (
        <PasswordInput
            {...props}
            className={`${themedFormControlsThemeClasses.inputBase} ${error ? themedFormControlsThemeClasses.inputError : ""} ${className}`.trim()}
        />
    );
}

export function FieldError({ message }: { message?: string }) {
    if (!message) {
        return null;
    }
    return <p className={themedFormControlsThemeClasses.errorText}>{message}</p>;
}

export function AuthInfoMessage({ message }: { message?: string | null }) {
    if (!message) {
        return null;
    }
    return <p className={themedFormControlsThemeClasses.infoMessage}>{message}</p>;
}

export function AuthPasswordHint({ children }: { children: React.ReactNode }) {
    return <p className={themedFormControlsThemeClasses.passwordHint}>{children}</p>;
}

export function AuthSubmitButton({ className = "", ...props }: SubmitButtonProps) {
    return <Button {...props} className={`${themedFormControlsThemeClasses.submitButton} ${className}`.trim()} />;
}
