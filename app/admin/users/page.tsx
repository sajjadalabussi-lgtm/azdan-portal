"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  roleLabels,
  type AdminRole,
} from "@/lib/admin-permissions";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

const roles: AdminRole[] = [
  "admin",
  "engineer",
  "accountant",
  "employee",
];

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("ar-IQ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("employee");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر تحميل المستخدمين.");
      }

      setUsers(data.users || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "تعذر تحميل المستخدمين."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setCreating(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر إنشاء المستخدم.");
      }

      setMessage(data.message || "تم إنشاء المستخدم.");
      setName("");
      setEmail("");
      setPassword("");
      setRole("employee");

      await loadUsers();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "تعذر إنشاء المستخدم."
      );
    } finally {
      setCreating(false);
    }
  }

  function updateLocalUser(
    userId: string,
    changes: Partial<Pick<UserRow, "role" | "is_active">>
  ) {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId ? { ...user, ...changes } : user
      )
    );
  }

  async function saveUser(user: UserRow) {
    setSavingId(user.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          role: user.role,
          is_active: user.is_active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر تحديث المستخدم.");
      }

      setMessage(data.message || "تم تحديث المستخدم.");
      await loadUsers();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "تعذر تحديث المستخدم."
      );

      await loadUsers();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-3xl font-black text-slate-950">
            إدارة المستخدمين
          </h1>
          <p className="mt-2 text-slate-600">
            إنشاء حسابات الموظفين وتحديد أدوارهم وحالة الوصول.
          </p>
        </header>

        {message && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">
            {error}
          </div>
        )}

        <section className="mb-8 rounded-3xl bg-white p-5 shadow-sm md:p-7">
          <h2 className="mb-5 text-xl font-black text-slate-950">
            إضافة مستخدم جديد
          </h2>

          <form
            onSubmit={createUser}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"
          >
            <label className="grid gap-2">
              <span className="font-bold text-slate-700">الاسم</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                placeholder="اسم الموظف"
              />
            </label>

            <label className="grid gap-2">
              <span className="font-bold text-slate-700">
                البريد الإلكتروني
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                placeholder="employee@example.com"
                dir="ltr"
              />
            </label>

            <label className="grid gap-2">
              <span className="font-bold text-slate-700">
                كلمة المرور الأولية
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
                placeholder="8 أحرف على الأقل"
                dir="ltr"
              />
            </label>

            <label className="grid gap-2">
              <span className="font-bold text-slate-700">الدور</span>
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as AdminRole)
                }
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
              >
                {roles.map((roleValue) => (
                  <option key={roleValue} value={roleValue}>
                    {roleLabels[roleValue]}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {creating ? "جاري الإنشاء..." : "إنشاء المستخدم"}
              </button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 md:p-7">
            <h2 className="text-xl font-black text-slate-950">
              المستخدمون الحاليون
            </h2>
          </div>

          {loading ? (
            <div className="p-10 text-center font-bold text-slate-600">
              جاري تحميل المستخدمين...
            </div>
          ) : users.length === 0 ? (
            <div className="p-10 text-center font-bold text-slate-600">
              لا يوجد مستخدمون.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-right">
                <thead className="bg-slate-50 text-sm text-slate-600">
                  <tr>
                    <th className="px-5 py-4">المستخدم</th>
                    <th className="px-5 py-4">الدور</th>
                    <th className="px-5 py-4">الحالة</th>
                    <th className="px-5 py-4">تاريخ الإنشاء</th>
                    <th className="px-5 py-4">آخر دخول</th>
                    <th className="px-5 py-4">الإجراء</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {users.map((user) => (
                    <tr key={user.id} className="align-middle">
                      <td className="px-5 py-4">
                        <div className="font-black text-slate-950">
                          {user.name || "بدون اسم"}
                        </div>
                        <div className="mt-1 text-sm text-slate-500" dir="ltr">
                          {user.email}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <select
                          value={user.role}
                          onChange={(event) =>
                            updateLocalUser(user.id, {
                              role: event.target.value as AdminRole,
                            })
                          }
                          className="min-w-36 rounded-xl border border-slate-300 px-3 py-2"
                        >
                          {roles.map((roleValue) => (
                            <option key={roleValue} value={roleValue}>
                              {roleLabels[roleValue]}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-5 py-4">
                        <label className="inline-flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={user.is_active}
                            onChange={(event) =>
                              updateLocalUser(user.id, {
                                is_active: event.target.checked,
                              })
                            }
                            className="h-5 w-5"
                          />
                          <span
                            className={
                              user.is_active
                                ? "font-black text-emerald-700"
                                : "font-black text-red-700"
                            }
                          >
                            {user.is_active ? "مفعل" : "موقوف"}
                          </span>
                        </label>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(user.created_at)}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(user.last_sign_in_at)}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => saveUser(user)}
                          disabled={savingId === user.id}
                          className="rounded-xl bg-slate-950 px-4 py-2 font-black text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {savingId === user.id
                            ? "جاري الحفظ..."
                            : "حفظ التعديل"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}