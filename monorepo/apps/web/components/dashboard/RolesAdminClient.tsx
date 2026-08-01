"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import { toast } from "@/lib/ui/toast";
import { extractErrorMessage } from "@/lib/ui/notifyMutation";

type PermissionRow = { id: string; code: string; module: string; action: string; description: string };
type RoleRow = {
    id: string;
    name: string;
    slug: string;
    description: string;
    isSystem: boolean;
    enabled: boolean;
    permissionCodes: string[];
};

async function readError(res: Response): Promise<string> {
    try {
        const j = (await res.json()) as { error?: string };
        return j.error ?? res.statusText;
    } catch {
        return await res.text();
    }
}

export function RolesAdminClient() {
    const [permissions, setPermissions] = useState<PermissionRow[]>([]);
    const [roles, setRoles] = useState<RoleRow[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draftCodes, setDraftCodes] = useState<Set<string>>(new Set());
    const [nameDraft, setNameDraft] = useState("");
    const [descDraft, setDescDraft] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newName, setNewName] = useState("");
    const [newSlug, setNewSlug] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [creatingNew, setCreatingNew] = useState(false);

    const selected = useMemo(() => roles.find((r) => r.id === selectedId) ?? null, [roles, selectedId]);

    const rolesSorted = useMemo(
        () => [...roles].sort((a, b) => Number(a.enabled === false) - Number(b.enabled === false)),
        [roles],
    );

    const byModule = useMemo(() => {
        const m = new Map<string, PermissionRow[]>();
        for (const p of permissions) {
            const list = m.get(p.module) ?? [];
            list.push(p);
            m.set(p.module, list);
        }
        for (const list of m.values()) {
            list.sort((a, b) => a.action.localeCompare(b.action));
        }
        return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
    }, [permissions]);

    const load = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const [permRes, roleRes] = await Promise.all([
                fetch("/api/admin/permissions", { credentials: "include" }),
                fetch("/api/admin/roles", { credentials: "include" }),
            ]);
            if (!permRes.ok) throw new Error(await readError(permRes));
            if (!roleRes.ok) throw new Error(await readError(roleRes));
            const permJson = (await permRes.json()) as { permissions: PermissionRow[] };
            const roleJson = (await roleRes.json()) as { roles: RoleRow[] };
            setPermissions(permJson.permissions);
            setRoles(roleJson.roles);
            setSelectedId((prev) => {
                if (prev && roleJson.roles.some((r) => r.id === prev)) return prev;
                return roleJson.roles[0]?.id ?? null;
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (creatingNew) return;
        if (!selected) return;
        setDraftCodes(new Set(selected.permissionCodes));
        setNameDraft(selected.name);
        setDescDraft(selected.description ?? "");
    }, [selected, creatingNew]);

    function openCreateRole() {
        setCreatingNew(true);
        setSelectedId(null);
        setNewName("");
        setNewSlug("");
        setNewDesc("");
        setDraftCodes(new Set());
        setError(null);
    }

    function cancelCreateRole() {
        setCreatingNew(false);
        setSelectedId(roles[0]?.id ?? null);
    }

    const toggleCode = (code: string) => {
        setDraftCodes((prev) => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };

    const saveRole = async () => {
        if (!selected) return;
        setSaving(true);
        setError(null);
        const loadingId = toast.loading("Saving role…");
        try {
            const res = await fetch(`/api/admin/roles/${selected.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    name: nameDraft,
                    description: descDraft,
                    permissionCodes: [...draftCodes],
                }),
            });
            if (!res.ok) throw new Error(await readError(res));
            const json = (await res.json()) as { role: RoleRow };
            setRoles((prev) => prev.map((r) => (r.id === json.role.id ? json.role : r)));
            toast.success(`Role “${json.role.name}” updated`, { id: loadingId });
        } catch (e) {
            const msg = extractErrorMessage(e, "Could not save role");
            setError(msg);
            toast.error(msg, { id: loadingId });
        } finally {
            setSaving(false);
        }
    };

    async function deleteRoleRequest(roleId: string, detachUsers: boolean): Promise<Response> {
        return fetch(`/api/admin/roles/${roleId}`, {
            method: "DELETE",
            credentials: "include",
            ...(detachUsers
                ? {
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ detachUsers: true }),
                  }
                : {}),
        });
    }

    const deleteRole = async () => {
        if (!selected || selected.isSystem) return;
        if (!confirm(`Delete role "${selected.name}"? This cannot be undone.`)) return;
        setSaving(true);
        setError(null);
        const roleName = selected.name;
        const loadingId = toast.loading("Deleting role…");
        try {
            let res = await deleteRoleRequest(selected.id, false);
            if (!res.ok) {
                const errText = await res.text();
                let errCode = "";
                try {
                    errCode = (JSON.parse(errText) as { error?: string }).error ?? "";
                } catch {
                    /* plain text */
                }
                if (res.status === 409 && errCode === "role_in_use") {
                    if (
                        confirm(
                            "This role is still assigned to one or more users. Remove it from all accounts and delete the role? Users will lose this role immediately.",
                        )
                    ) {
                        res = await deleteRoleRequest(selected.id, true);
                        if (!res.ok) throw new Error(await readError(res));
                    } else {
                        toast.dismiss(loadingId);
                        setSaving(false);
                        return;
                    }
                } else {
                    throw new Error(errCode || errText || "Delete failed");
                }
            }
            const next = roles.filter((r) => r.id !== selected.id);
            setRoles(next);
            setSelectedId(next[0]?.id ?? null);
            toast.success(`Role “${roleName}” deleted`, { id: loadingId });
        } catch (e) {
            const msg = extractErrorMessage(e, "Could not delete role");
            setError(msg);
            toast.error(msg, { id: loadingId });
        } finally {
            setSaving(false);
        }
    };

    const setRoleEnabled = async (next: boolean) => {
        if (!selected || selected.isSystem) return;
        setSaving(true);
        setError(null);
        const loadingId = toast.loading(next ? "Enabling role…" : "Disabling role…");
        try {
            const res = await fetch(`/api/admin/roles/${selected.id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ enabled: next }),
            });
            if (!res.ok) throw new Error(await readError(res));
            const json = (await res.json()) as { role: RoleRow };
            setRoles((prev) => prev.map((r) => (r.id === json.role.id ? json.role : r)));
            toast.success(
                `Role “${json.role.name}” ${next ? "enabled" : "disabled"}`,
                { id: loadingId },
            );
        } catch (e) {
            const msg = extractErrorMessage(e, "Could not update role");
            setError(msg);
            toast.error(msg, { id: loadingId });
        } finally {
            setSaving(false);
        }
    };

    const createRole = async () => {
        if (!newName.trim() || !newSlug.trim()) {
            setError("New role needs a name and a slug.");
            toast.error("New role needs a name and a slug.");
            return;
        }
        setSaving(true);
        setError(null);
        const loadingId = toast.loading("Creating role…");
        try {
            const res = await fetch("/api/admin/roles", {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    name: newName.trim(),
                    slug: newSlug.trim(),
                    description: newDesc.trim(),
                    permissionCodes: [...draftCodes],
                }),
            });
            if (!res.ok) throw new Error(await readError(res));
            const json = (await res.json()) as { role: RoleRow };
            setRoles((prev) => [...prev, json.role].sort((a, b) => a.slug.localeCompare(b.slug)));
            setCreatingNew(false);
            setSelectedId(json.role.id);
            setNewName("");
            setNewSlug("");
            setNewDesc("");
            toast.success(`Role “${json.role.name}” created`, { id: loadingId });
        } catch (e) {
            const msg = extractErrorMessage(e, "Could not create role");
            setError(msg);
            toast.error(msg, { id: loadingId });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <PageContainer size="5xl">
                <p className="text-sm text-slate-700" role="status" aria-live="polite">
                    Loading roles…
                </p>
            </PageContainer>
        );
    }

    return (
        <PageContainer size="5xl">
            <PageHeader
                variant="plain"
                eyebrow="Admin"
                title="Roles & permissions"
                subtitle="Permissions are defined in code and synced to the database. Edit which codes each role includes; new signups get the user role by default."
            />

            {error ? (
                <div
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                    role="alert"
                >
                    {error}
                </div>
            ) : null}

            <div className="grid gap-5 sm:gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
                <div className="space-y-3">
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Roles</p>
                        <button
                            type="button"
                            onClick={openCreateRole}
                            disabled={saving}
                            className="h-11 w-full rounded-xl border border-dashed border-brand-300 bg-brand-50/50 px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-50"
                        >
                            + Add new role
                        </button>
                    </div>
                    <ul className="grid max-h-[42vh] grid-cols-1 gap-1 overflow-y-auto sm:max-h-none">
                        {rolesSorted.map((r) => (
                            <li key={r.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCreatingNew(false);
                                        setSelectedId(r.id);
                                    }}
                                    aria-current={!creatingNew && selectedId === r.id ? "true" : undefined}
                                    className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${!creatingNew && selectedId === r.id
                                        ? "border-brand-300 bg-white text-brand-900 shadow-sm"
                                        : r.enabled === false
                                          ? "border-transparent text-slate-600 hover:bg-white/40"
                                          : "border-transparent text-slate-800 hover:bg-white/60"
                                        }`}
                                >
                                    <span className="block truncate font-semibold">{r.name}</span>
                                    <span className="mt-0.5 block truncate font-mono text-xs opacity-80">{r.slug}</span>
                                    {r.enabled === false ? (
                                        <span className="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                                            Disabled
                                        </span>
                                    ) : null}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="min-w-0 space-y-4 rounded-2xl border border-white/40 bg-white/50 p-5 shadow-sm sm:p-6">
                    {creatingNew ? (
                        <>
                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <h2 className="text-lg font-semibold text-slate-900">New role</h2>
                                    <p className="text-xs text-slate-700">Choose a unique slug, then pick permissions.</p>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                    <button
                                        type="button"
                                        onClick={cancelCreateRole}
                                        disabled={saving}
                                        className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void createRole()}
                                        disabled={saving}
                                        className="h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                                    >
                                        {saving ? "Creating…" : "Create role"}
                                    </button>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block text-sm sm:col-span-1">
                                    <span className="text-slate-800">Display name</span>
                                    <input
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base text-slate-900 sm:text-sm"
                                        placeholder="e.g. Support agent"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        disabled={saving}
                                    />
                                </label>
                                <label className="block text-sm sm:col-span-1">
                                    <span className="text-slate-800">Slug</span>
                                    <input
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-base text-slate-900 sm:text-sm"
                                        placeholder="e.g. support-agent"
                                        value={newSlug}
                                        onChange={(e) => setNewSlug(e.target.value)}
                                        disabled={saving}
                                    />
                                </label>
                                <label className="block text-sm sm:col-span-2">
                                    <span className="text-slate-800">Description (optional)</span>
                                    <input
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base text-slate-900 sm:text-sm"
                                        placeholder="What this role is for"
                                        value={newDesc}
                                        onChange={(e) => setNewDesc(e.target.value)}
                                        disabled={saving}
                                    />
                                </label>
                            </div>

                            <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
                                {byModule.map(([module, rows]) => (
                                    <div key={module} className="rounded-xl border border-slate-100 bg-white/80 p-4">
                                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-700">{module}</p>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {rows.map((p) => (
                                                <label
                                                    key={p.code}
                                                    className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-900 hover:bg-slate-50"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="mt-1 h-4 w-4"
                                                        checked={draftCodes.has(p.code)}
                                                        onChange={() => toggleCode(p.code)}
                                                        disabled={saving}
                                                    />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block wrap-break-word font-mono text-xs text-slate-700">{p.code}</span>
                                                        <span className="block wrap-break-word text-xs text-slate-700">{p.description}</span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : selected ? (
                        <>
                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <h2 className="wrap-break-word text-lg font-semibold text-slate-900">{selected.name}</h2>
                                    <p className="text-xs text-slate-700">
                                        {selected.isSystem
                                            ? "System role — cannot be deleted or disabled"
                                            : selected.enabled === false
                                              ? "Disabled — does not grant permissions until re-enabled"
                                              : "Custom role"}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                    {!selected.isSystem ? (
                                        <button
                                            type="button"
                                            onClick={() => void deleteRole()}
                                            disabled={saving}
                                            className="h-10 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
                                        >
                                            Delete
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => void saveRole()}
                                        disabled={saving}
                                        className="h-10 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                                    >
                                        {saving ? "Saving…" : "Save changes"}
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white/70 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">Role enabled</p>
                                    <p className="text-xs text-slate-700">
                                        When off, assignments stay on users but permissions from this role are ignored.
                                    </p>
                                </div>
                                {selected.isSystem ? (
                                    <span className="text-sm font-semibold text-slate-700">Always on</span>
                                ) : (
                                    <label className="inline-flex cursor-pointer select-none items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={selected.enabled}
                                            disabled={saving}
                                            onChange={(e) => void setRoleEnabled(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                                        />
                                        <span className="text-sm font-semibold text-slate-800">{selected.enabled ? "On" : "Off"}</span>
                                    </label>
                                )}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="block text-sm">
                                    <span className="text-slate-800">Display name</span>
                                    <input
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base text-slate-900 sm:text-sm"
                                        value={nameDraft}
                                        onChange={(e) => setNameDraft(e.target.value)}
                                        disabled={saving}
                                    />
                                </label>
                                <label className="block text-sm">
                                    <span className="text-slate-800">Description</span>
                                    <input
                                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base text-slate-900 sm:text-sm"
                                        value={descDraft}
                                        onChange={(e) => setDescDraft(e.target.value)}
                                        disabled={saving}
                                    />
                                </label>
                            </div>

                            <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
                                {byModule.map(([module, rows]) => (
                                    <div key={module} className="rounded-xl border border-slate-100 bg-white/80 p-4">
                                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-700">{module}</p>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {rows.map((p) => (
                                                <label
                                                    key={p.code}
                                                    className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-900 hover:bg-slate-50"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="mt-1 h-4 w-4"
                                                        checked={draftCodes.has(p.code)}
                                                        onChange={() => toggleCode(p.code)}
                                                        disabled={saving}
                                                    />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block wrap-break-word font-mono text-xs text-slate-700">{p.code}</span>
                                                        <span className="block wrap-break-word text-xs text-slate-700">{p.description}</span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="space-y-3 rounded-xl border border-slate-100 bg-white/60 p-6 text-center sm:p-8">
                            <p className="text-slate-700">No roles in the database yet.</p>
                            <button
                                type="button"
                                onClick={openCreateRole}
                                disabled={saving}
                                className="h-11 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
                            >
                                Add new role
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}
