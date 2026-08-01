export type UserRecord = {
    id: string;
    email: string;
    name: string;
    /** Present for password / linked accounts; absent for Google-only users. */
    passwordHash?: string;
    /** Google subject (`sub`) when the account is linked to Google OAuth. */
    googleId?: string | null;
    image?: string | null;
    emailVerified: string | null;
    createdAt: string;
    /** Mongo role ObjectIds as strings; empty until RBAC seed assigns the default `user` role */
    roleIds?: string[];
};

export type SafeUser = {
    id: string;
    email: string;
    name: string;
    createdAt: string;
};
