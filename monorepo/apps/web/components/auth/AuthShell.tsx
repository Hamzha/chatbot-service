import type { PropsWithChildren, ReactNode } from "react";
import { authShellThemeClasses } from "@/lib/theme/components/auth-shell.theme";

type AuthShellProps = PropsWithChildren<{
    badge: string;
    title: string;
    subtitle: string;
    sideTitle: string;
    sideDescription: string;
    sidePoints: string[];
    footer?: ReactNode;
}>;

export function AuthShell({
    badge,
    title,
    subtitle,
    sideTitle,
    sideDescription,
    sidePoints,
    footer,
    children,
}: AuthShellProps) {
    return (
        <main className={authShellThemeClasses.root}>
            <section className={authShellThemeClasses.shell}>
                <aside className={authShellThemeClasses.sidePanel}>
                    <div className={authShellThemeClasses.sideSection}>
                        <span className={authShellThemeClasses.sideBadge}>
                            {badge}
                        </span>
                        <h2 className={authShellThemeClasses.sideTitle}>{sideTitle}</h2>
                        <p className={authShellThemeClasses.sideDescription}>{sideDescription}</p>
                    </div>

                    <ul className={authShellThemeClasses.pointsList}>
                        {sidePoints.map((point) => (
                            <li key={point} className={authShellThemeClasses.pointItem}>
                                <span className={authShellThemeClasses.pointBullet} aria-hidden="true" />
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                </aside>

                <div className={authShellThemeClasses.contentWrap}>
                    <section className={authShellThemeClasses.contentCard}>
                        <div className={authShellThemeClasses.headerBlock}>
                            <span className={authShellThemeClasses.mainBadge}>
                                {badge}
                            </span>
                            <h1 className={authShellThemeClasses.title}>{title}</h1>
                            <p className={authShellThemeClasses.subtitle}>{subtitle}</p>
                        </div>

                        {children}

                        {footer ? <div className={authShellThemeClasses.footer}>{footer}</div> : null}
                    </section>
                </div>
            </section>
        </main>
    );
}
