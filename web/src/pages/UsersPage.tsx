import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { PublicUser, Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, ErrorText, Field, Input } from '../components/ui';

const ROLES: Role[] = ['Owner', 'Sales', 'Ops', 'Accounts', 'ReadOnly'];

const selectClass =
  'w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none';

export function UsersPage() {
  const { user: me, isOwner } = useAuth();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [error, setError] = useState('');

  async function reload() {
    try {
      setUsers(await api.listUsers());
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users');
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      await reload();
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Team &amp; access</h1>
      <ErrorText>{error}</ErrorText>

      {isOwner && <CreateUserForm onCreate={(fn) => run(fn)} />}

      <Card title="Users">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1.5">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              {isOwner && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                isOwner={isOwner}
                isSelf={u.id === me?.id}
                onAction={(fn) => run(fn)}
              />
            ))}
          </tbody>
        </table>
      </Card>

      <ChangeMyPassword onError={setError} />
    </div>
  );
}

function UserRow({
  user,
  isOwner,
  isSelf,
  onAction,
}: {
  user: PublicUser;
  isOwner: boolean;
  isSelf: boolean;
  onAction: (fn: () => Promise<unknown>) => void;
}) {
  const disabled = user.status === 'disabled';
  return (
    <tr className="border-t border-gray-100">
      <td className="py-2">{user.name}</td>
      <td className="text-gray-600">{user.email}</td>
      <td>
        {isOwner ? (
          <select
            className={selectClass}
            value={user.role}
            aria-label={`Role for ${user.name}`}
            onChange={(e) =>
              onAction(() => api.updateUser(user.id, { role: e.target.value as Role }))
            }
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          <Badge>{user.role}</Badge>
        )}
      </td>
      <td>
        {disabled ? (
          <span className="text-red-600">disabled</span>
        ) : (
          <span className="text-green-700">active</span>
        )}
      </td>
      {isOwner && (
        <td className="space-x-2 py-2 text-right">
          <Button
            variant="ghost"
            onClick={() =>
              onAction(() => api.updateUser(user.id, { status: disabled ? 'active' : 'disabled' }))
            }
          >
            {disabled ? 'Enable' : 'Disable'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const pwd = window.prompt(`New password for ${user.name} (min 8 chars)`);
              if (pwd) onAction(() => api.resetUserPassword(user.id, pwd));
            }}
          >
            Reset password
          </Button>
          {isSelf && <Badge>you</Badge>}
        </td>
      )}
    </tr>
  );
}

function CreateUserForm({ onCreate }: { onCreate: (fn: () => Promise<unknown>) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('Sales');
  const [password, setPassword] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onCreate(async () => {
      await api.createUser({ email, name, role, password });
      setEmail('');
      setName('');
      setRole('Sales');
      setPassword('');
    });
  }

  return (
    <Card title="Add a team member">
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-end">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Role">
          <select
            className={selectClass}
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Temp password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </Field>
        <Button type="submit">Add user</Button>
      </form>
    </Card>
  );
}

function ChangeMyPassword({ onError }: { onError: (msg: string) => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    api
      .changeMyPassword(current, next)
      .then(() => {
        setDone(true);
        setCurrent('');
        setNext('');
        onError('');
      })
      .catch((err) => onError(err instanceof ApiError ? err.message : 'Failed to change password'));
  }

  return (
    <Card title="Change my password">
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
        <Field label="Current password">
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </Field>
        <Field label="New password">
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            minLength={8}
            required
          />
        </Field>
        <Button type="submit">Update password</Button>
      </form>
      {done && <p className="mt-2 text-sm text-green-700">Password updated.</p>}
    </Card>
  );
}
