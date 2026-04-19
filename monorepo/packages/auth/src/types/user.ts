export type UserRecord = {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
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
