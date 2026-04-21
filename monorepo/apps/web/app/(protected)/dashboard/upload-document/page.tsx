import { requirePagePermission } from "@/lib/auth/requirePagePermission";
import { UploadDocumentClient } from "./UploadDocumentClient";

export default async function UploadDocumentPage() {
    await requirePagePermission("chatbot_documents:create");
    return <UploadDocumentClient />;
}
