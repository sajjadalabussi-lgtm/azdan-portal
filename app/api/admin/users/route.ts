import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAdminRole, type AdminRole } from "@/lib/admin-permissions";

type ProfileRow = {
  id: string;
  role: string;
  is_active: boolean;
};

async function authorizeAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "يجب تسجيل الدخول أولًا." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle<{ role: string; is_active: boolean }>();

  if (error || !profile) {
    return {
      error: NextResponse.json(
        { error: "تعذر التحقق من صلاحية الحساب." },
        { status: 403 }
      ),
    };
  }

  if (!profile.is_active || profile.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "هذه العملية متاحة لمدير النظام فقط." },
        { status: 403 }
      ),
    };
  }

  return { user };
}

async function writeUserActivity(input: {
  actorId: string;
  action: "create" | "update";
  entityId: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("activity_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    entity_type: "profiles",
    entity_id: input.entityId,
    description: input.description,
    metadata: input.metadata || {},
  });

  if (error) {
    console.error("تعذر تسجيل نشاط المستخدم:", error.message);
  }
}

export async function GET() {
  try {
    const authorization = await authorizeAdmin();

    if ("error" in authorization) {
      return authorization.error;
    }

    const admin = createSupabaseAdminClient();

    const {
      data: { users },
      error: usersError,
    } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) {
      return NextResponse.json(
        { error: usersError.message },
        { status: 500 }
      );
    }

    const userIds = users.map((user) => user.id);

    let profiles: ProfileRow[] = [];

    if (userIds.length > 0) {
      const { data, error } = await admin
        .from("profiles")
        .select("id, role, is_active")
        .in("id", userIds);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      profiles = data || [];
    }

    const profileMap = new Map(
      profiles.map((profile) => [profile.id, profile])
    );

    const result = users.map((user) => {
      const profile = profileMap.get(user.id);

      return {
        id: user.id,
        name:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : "",
        email: user.email || "",
        role: isAdminRole(profile?.role) ? profile.role : "employee",
        is_active: profile?.is_active ?? false,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at || null,
      };
    });

    return NextResponse.json({ users: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "حدث خطأ غير متوقع.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorizeAdmin();

    if ("error" in authorization) {
      return authorization.error;
    }

    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "") as AdminRole;

    if (!name) {
      return NextResponse.json(
        { error: "اسم المستخدم مطلوب." },
        { status: 400 }
      );
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "البريد الإلكتروني غير صحيح." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "كلمة المرور يجب ألا تقل عن 8 أحرف." },
        { status: 400 }
      );
    }

    if (!isAdminRole(role)) {
      return NextResponse.json(
        { error: "الدور المحدد غير صحيح." },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();

    const { data, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
        },
      });

    if (createError || !data.user) {
      return NextResponse.json(
        { error: createError?.message || "تعذر إنشاء المستخدم." },
        { status: 400 }
      );
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: data.user.id,
      role,
      is_active: true,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);

      return NextResponse.json(
        {
          error:
            "تم إلغاء إنشاء المستخدم لأن ملف الصلاحيات لم يُنشأ: " +
            profileError.message,
        },
        { status: 500 }
      );
    }

    await writeUserActivity({
      actorId: authorization.user.id,
      action: "create",
      entityId: data.user.id,
      description: `تم إنشاء المستخدم «${name}» بصلاحية ${role}.`,
      metadata: {
        target_user_id: data.user.id,
        target_name: name,
        target_email: email,
        role,
        is_active: true,
      },
    });

    return NextResponse.json(
      {
        message: "تم إنشاء المستخدم بنجاح.",
        user: {
          id: data.user.id,
          name,
          email,
          role,
          is_active: true,
          created_at: data.user.created_at,
          last_sign_in_at: null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "حدث خطأ غير متوقع.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authorization = await authorizeAdmin();

    if ("error" in authorization) {
      return authorization.error;
    }

    const body = await request.json();

    const userId = String(body.userId || "");
    const role = String(body.role || "") as AdminRole;
    const isActive = body.is_active;

    if (!userId) {
      return NextResponse.json(
        { error: "معرّف المستخدم مطلوب." },
        { status: 400 }
      );
    }

    if (!isAdminRole(role)) {
      return NextResponse.json(
        { error: "الدور المحدد غير صحيح." },
        { status: 400 }
      );
    }

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "حالة المستخدم غير صحيحة." },
        { status: 400 }
      );
    }

    if (
      authorization.user.id === userId &&
      (role !== "admin" || !isActive)
    ) {
      return NextResponse.json(
        {
          error:
            "لا يمكنك إيقاف حسابك الحالي أو إزالة صلاحية المدير منه.",
        },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();

    const { error } = await admin.from("profiles").upsert({
      id: userId,
      role,
      is_active: isActive,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    await writeUserActivity({
      actorId: authorization.user.id,
      action: "update",
      entityId: userId,
      description: `تم تحديث صلاحية المستخدم إلى ${role} وحالته إلى ${isActive ? "نشط" : "موقوف"}.`,
      metadata: {
        target_user_id: userId,
        role,
        is_active: isActive,
      },
    });

    return NextResponse.json({
      message: "تم تحديث صلاحيات المستخدم.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "حدث خطأ غير متوقع.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}