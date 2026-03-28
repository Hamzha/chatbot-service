export type UserRecord = {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    emailVerified: string | null;
    createdAt: string;
};

export type SafeUser = {
    id: string;
    email: string;
    name: string;
    createdAt: string;
};
