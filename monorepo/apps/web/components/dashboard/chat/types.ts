export type ChatMsg = {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;
};

export type ChatSessionRow = {
    id: string;
    name: string;
    selectedRagKeys: string[];
};

export type SelectedDocForUi = {
    ragSourceKey: string;
    displayName: string;
    documentId: string | null;
    inLibrary: boolean;
};
