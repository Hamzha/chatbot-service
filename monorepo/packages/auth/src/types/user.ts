export type UserRecord = {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    emailVerified: string | null;
    createdAt: string;
    /** Mongo role ObjectIds as strings; empty until RBAC migration / signup assigns roles */
    roleIds?: string[];
};

export type SafeUser = {
    id: string;
    email: string;
    name: string;
    createdAt: string;
};
