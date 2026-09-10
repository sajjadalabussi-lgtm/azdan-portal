import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

async function authorize(request:Request){
  const h=request.headers.get("authorization")||"",token=h.startsWith("Bearer ")?h.slice(7).trim():"";
  if(!token)return {error:NextResponse.json({error:"غير مصرح"},{status:401})};
  const admin=createSupabaseAdminClient();const {data,error}=await admin.auth.getUser(token);const user=data.user;
  if(error||!user)return {error:NextResponse.json({error:"الجلسة غير صالحة"},{status:401})};
  const {data:profile}=await admin.from("profiles").select("role,is_active").eq("id",user.id).maybeSingle();
  if(!profile?.is_active||profile.role!=="admin")return {error:NextResponse.json({error:"حذف العميل متاح لمدير النظام فقط"},{status:403})};
  return {admin,user};
}

export async function DELETE(request:Request,context:{params:Promise<{id:string}>|{id:string}}){
  const auth=await authorize(request);if("error" in auth)return auth.error;
  const {id}=await context.params;const clientId=Number(id);
  if(!Number.isFinite(clientId)||clientId<=0)return NextResponse.json({error:"رقم العميل غير صحيح"},{status:400});
  const body=await request.json().catch(()=>({}));const confirmName=String(body.confirmName||"").trim();
  const {data:client,error:ce}=await auth.admin.from("clients").select("id,name").eq("id",clientId).maybeSingle();
  if(ce||!client)return NextResponse.json({error:"العميل غير موجود"},{status:404});
  if(confirmName!==String(client.name).trim())return NextResponse.json({error:"اسم التأكيد لا يطابق اسم العميل"},{status:400});

  // Gather storage paths before database deletion.
  const [{data:imgs},{data:files}]=await Promise.all([
    auth.admin.from("project_images").select("storage_path").eq("client_id",clientId),
    auth.admin.from("project_files").select("storage_path").eq("client_id",clientId),
  ]);

  // Delete database record. Related rows should follow the existing database FK/cascade rules.
  const {error}=await auth.admin.from("clients").delete().eq("id",clientId);
  if(error)return NextResponse.json({error:`تعذر حذف العميل: ${error.message}`},{status:500});

  const imagePaths=(imgs||[]).map((x:any)=>x.storage_path).filter(Boolean);
  const filePaths=(files||[]).map((x:any)=>x.storage_path).filter(Boolean);
  if(imagePaths.length)await auth.admin.storage.from("project-images").remove(imagePaths);
  if(filePaths.length)await auth.admin.storage.from("project-files").remove(filePaths);

  await auth.admin.from("activity_logs").insert({
    actor_id:auth.user.id,action:"delete",entity_type:"clients",entity_id:String(clientId),
    description:`حذف العميل ${client.name} من تطبيق الإدارة`,metadata:{client_id:clientId,client_name:client.name}
  });

  return NextResponse.json({ok:true,message:"تم حذف العميل وبيانات المشروع المرتبطة به بنجاح."});
}
