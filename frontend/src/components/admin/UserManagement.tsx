import { useCallback, useEffect, useState } from "react";
import { MailPlus, RefreshCw, Trash2, UserRound } from "lucide-react";
import { useCloudApi, useWorkspaceContext } from "@/components/auth/AuthGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CloudMemberRole, CloudMemberSummary, MemberPage } from "@/lib/cloud-types";

export function UserManagement() {
  const api = useCloudApi();
  const { workspaceId } = useWorkspaceContext();
  const [members, setMembers] = useState<CloudMemberSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CloudMemberRole>("bookkeeper");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string>();

  const loadMembers = useCallback(
    async (cursor?: string | null) => {
      setLoading(true);
      setError(undefined);
      try {
        const page: MemberPage = await api.listMembers({
          workspaceId,
          limit: 50,
          ...(cursor ? { cursor: JSON.parse(atob(cursor)) } : {}),
          ...(search ? { search } : {}),
        });
        setMembers((current) => (cursor ? [...current, ...page.members] : page.members));
        setNextCursor(page.nextCursor);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Members could not be loaded.");
      } finally {
        setLoading(false);
      }
    },
    [api, search, workspaceId],
  );

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError(undefined);
    try {
      await api.inviteMember(workspaceId, { email: email.trim(), role });
      setEmail("");
      await loadMembers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invitation could not be sent.");
    } finally {
      setWorking(false);
    }
  }

  async function updateRole(member: CloudMemberSummary, nextRole: CloudMemberRole) {
    setWorking(true);
    setError(undefined);
    try {
      await api.setMemberRole(workspaceId, member.userId, nextRole);
      setMembers((current) =>
        current.map((item) => (item.userId === member.userId ? { ...item, role: nextRole } : item)),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Member role could not be updated.");
    } finally {
      setWorking(false);
    }
  }

  async function updateStatus(member: CloudMemberSummary) {
    const nextActive = !member.active;
    if (!nextActive && !window.confirm(`Deactivate ${member.email ?? "this member"}?`)) return;
    setWorking(true);
    setError(undefined);
    try {
      await api.setMemberStatus(workspaceId, member.userId, nextActive);
      setMembers((current) =>
        current.map((item) =>
          item.userId === member.userId ? { ...item, active: nextActive } : item,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Member status could not be updated.");
    } finally {
      setWorking(false);
    }
  }

  async function deleteMember(member: CloudMemberSummary) {
    if (!window.confirm(`Delete the account for ${member.email ?? "this member"}?`)) return;
    setWorking(true);
    setError(undefined);
    try {
      await api.deleteMember(workspaceId, member.userId);
      setMembers((current) => current.filter((item) => item.userId !== member.userId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account could not be deleted.");
    } finally {
      setWorking(false);
    }
  }

  function searchMembers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Invite and maintain workspace accounts without loading the full member directory.
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">User Management</h2>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MailPlus className="h-4 w-4" />
            Invite a user
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_180px_auto]" onSubmit={invite}>
            <label className="space-y-2 text-sm font-medium" htmlFor="member-email">
              Email address
              <Input
                id="member-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="member-role">
              Role
              <select
                id="member-role"
                value={role}
                onChange={(event) => setRole(event.target.value as CloudMemberRole)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="bookkeeper">Bookkeeper</option>
                <option value="administrator">Administrator</option>
              </select>
            </label>
            <Button type="submit" disabled={working} className="self-end">
              Send invitation
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4" />
              Workspace members
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Results are loaded 50 at a time.</p>
          </div>
          <form className="flex gap-2" onSubmit={searchMembers}>
            <Input
              aria-label="Search members"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search email"
            />
            <Button type="submit" variant="outline" disabled={loading}>
              Search
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {loading && members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading members...</p>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No workspace members match this search.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <MemberRow
                    key={member.userId}
                    member={member}
                    disabled={working}
                    onRoleChange={updateRole}
                    onStatusChange={updateStatus}
                    onDelete={deleteMember}
                  />
                ))}
              </TableBody>
            </Table>
          )}
          {nextCursor ? (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadMembers(nextCursor)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Load more
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function MemberRow({
  member,
  disabled,
  onRoleChange,
  onStatusChange,
  onDelete,
}: {
  member: CloudMemberSummary;
  disabled: boolean;
  onRoleChange: (member: CloudMemberSummary, role: CloudMemberRole) => Promise<void>;
  onStatusChange: (member: CloudMemberSummary) => Promise<void>;
  onDelete: (member: CloudMemberSummary) => Promise<void>;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {member.email ?? <span className="text-muted-foreground">Email unavailable</span>}
      </TableCell>
      <TableCell>
        {member.role === "owner" ? (
          <Badge variant="outline">Owner</Badge>
        ) : (
          <select
            aria-label={`Role for ${member.email ?? member.userId}`}
            value={member.role}
            onChange={(event) => void onRoleChange(member, event.target.value as CloudMemberRole)}
            disabled={disabled}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="administrator">Administrator</option>
            <option value="bookkeeper">Bookkeeper</option>
          </select>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={member.active ? "secondary" : "outline"}>
          {member.active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {new Date(member.createdAt).toLocaleDateString("en-PH")}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void onStatusChange(member)}
            disabled={disabled || member.role === "owner"}
          >
            {member.active ? "Deactivate" : "Reactivate"}
          </Button>
          {member.role !== "owner" ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void onDelete(member)}
              disabled={disabled}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete account
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
