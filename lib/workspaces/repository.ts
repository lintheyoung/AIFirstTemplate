import { workspaceRoleValues, type WorkspaceRoleValue } from '../db/schema';

export type WorkspaceRole = WorkspaceRoleValue;

const workspaceRoles = new Set<string>(workspaceRoleValues);

export function normalizeWorkspaceRole(value: string): WorkspaceRole {
  if (workspaceRoles.has(value)) {
    return value as WorkspaceRole;
  }

  throw new Error(`Unknown workspace role '${value}'.`);
}

export function canManageApiKeys(role: WorkspaceRole) {
  return role === 'owner' || role === 'admin';
}

export type WorkspaceSummary = {
  id: number;
  name: string;
  slug: string;
  role: WorkspaceRole;
};

export function selectDefaultWorkspace(workspaces: WorkspaceSummary[]) {
  return (
    workspaces.find((workspace) => workspace.role === 'owner') ??
    workspaces.find((workspace) => workspace.role === 'admin') ??
    workspaces[0] ??
    null
  );
}
