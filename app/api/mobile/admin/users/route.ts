import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAdminRole, type AdminRole } from "@/lib/admin-permissions";

async function authorize(request: Request) {
  const header=request.headers.get("authorization")||"";
  const token=header.startsWith("Bearer ")?header.slice(7).trim():"";
  if(!token)return {error:NextResponse.json({error:"غير مصرح"},{status:401})};

  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.auth.getUser(token);
  const user=data.user;
  if(error||!user)return {error:NextResponse.json({error:"الجلسة غير صالحة"},{status:401})};

  const {data:profile,error:pe}=await admin.from("profiles").select("role,is_active").eq("id",user.id).maybeSingle();
  if(pe||!profile?.is_active||profile.role!=="admin"){
    return {error:NextResponse.json({error:"هذه العملية متاحة لمدير النظام فقط"},{status:403})};
  }
  return {admin,user};
}

async function log(admin:any,actorId:string,action:"create"|"update",entityId:string,description:string,metadata:any={}){
  const {error}=await admin.from("activity_logs").insert({actor_id:actorId,action,entity_type:"profiles",entity_id:entityId,description,metadata});
  if(error)console.error("activity log:",error.message);
}

export async function GET(request:Request){
  const auth=await authorize(request);if("error" in auth)return auth.error;
  const {admin}=auth;
  const {data:{users},error}=await admin.auth.admin.listUsers({page:1,perPage:1000});
  if(error)return NextResponse.json({error:error.message},{status:500});
  const ids=users.map(u=>u.id);
  const {data:profiles,error:pe}=ids.length?await admin.from("profiles").select("id,role,is_active").in("id",ids):{data:[],error:null};
  if(pe)return NextResponse.json({error:pe.message},{status:500});
  const map=new Map((profiles||[]).map((p:any)=>[p.id,p]));
  return NextResponse.json({users:users.map(u=>{const p:any=map.get(u.id);return {
    id:u.id,name:typeof u.user_metadata?.full_name==="string"?u.user_metadata.full_name:"",
    email:u.email||"",role:isAdminRole(p?.role)?p.role:"employee",is_active:p?.is_active??false,
    created_at:u.created_at,last_sign_in_at:u.last_sign_in_at||null
  }})});
}

export async function POST(request:Request){
  const auth=await authorize(request);if("error" in auth)return auth.error;
  const {admin,user}=auth;const body=await request.json().catch(()=>({}));
  const name=String(body.name||"").trim(),email=String(body.email||"").trim().toLowerCase(),password=String(body.password||""),role=String(body.role||"") as AdminRole;
  if(!name)return NextResponse.json({error:"اسم المستخدم مطلوب"},{status:400});
  if(!email||!email.includes("@"))return NextResponse.json({error:"البريد الإلكتروني غير صحيح"},{status:400});
  if(password.length<8)return NextResponse.json({error:"كلمة المرور يجب ألا تقل عن 8 أحرف"},{status:400});
  if(!isAdminRole(role))return NextResponse.json({error:"الدور غير صحيح"},{status:400});

  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
  if(error||!data.user)return NextResponse.json({error:error?.message||"تعذر إنشاء المستخدم"},{status:400});
  const {error:profileError}=await admin.from("profiles").upsert({id:data.user.id,role,is_active:true});
  if(profileError){await admin.auth.admin.deleteUser(data.user.id);return NextResponse.json({error:profileError.message},{status:500})}
  await log(admin,user.id,"create",data.user.id,`تم إنشاء المستخدم «${name}» بصلاحية ${role}.`,{target_email:email,role,is_active:true});
  return NextResponse.json({message:"تم إنشاء المستخدم بنجاح.",user:{id:data.user.id,name,email,role,is_active:true,created_at:data.user.created_at,last_sign_in_at:null}},{status:201});
}

export async function PATCH(request:Request){
  const auth=await authorize(request);if("error" in auth)return auth.error;
  const {admin,user}=auth;const body=await request.json().catch(()=>({}));
  const userId=String(body.userId||""),role=String(body.role||"") as AdminRole,isActive=body.is_active;
  if(!userId||!isAdminRole(role)||typeof isActive!=="boolean")return NextResponse.json({error:"البيانات غير صحيحة"},{status:400});
  if(user.id===userId&&(role!=="admin"||!isActive))return NextResponse.json({error:"لا يمكنك إيقاف حسابك الحالي أو إزالة صلاحية المدير منه."},{status:400});
  const {error}=await admin.from("profiles").upsert({id:userId,role,is_active:isActive});
  if(error)return NextResponse.json({error:error.message},{status:500});
  await log(admin,user.id,"update",userId,`تم تحديث صلاحية المستخدم إلى ${role} وحالته إلى ${isActive?"نشط":"موقوف"}.`,{role,is_active:isActive});
  return NextResponse.json({message:"تم تحديث صلاحيات المستخدم."});
}
