import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const DEFAULT_SETTINGS={id:1,company_name:"شركة أزدان للمقاولات العامة",phone:"",email:"",address:"",logo_url:"/logo.png",primary_color:"#2563eb",secondary_color:"#0f172a"};
const cleanText=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
const cleanColor=(v:unknown,f:string)=>typeof v==="string"&&/^#[0-9a-fA-F]{6}$/.test(v.trim())?v.trim():f;

async function authorize(request:Request){
  const h=request.headers.get("authorization")||"",token=h.startsWith("Bearer ")?h.slice(7).trim():"";
  if(!token)return {error:NextResponse.json({error:"غير مصرح"},{status:401})};
  const admin=createSupabaseAdminClient();const {data,error}=await admin.auth.getUser(token);const user=data.user;
  if(error||!user)return {error:NextResponse.json({error:"الجلسة غير صالحة"},{status:401})};
  const {data:profile}=await admin.from("profiles").select("role,is_active").eq("id",user.id).maybeSingle();
  if(!profile?.is_active||profile.role!=="admin")return {error:NextResponse.json({error:"هذه الصفحة متاحة لمدير النظام فقط"},{status:403})};
  return {admin,user};
}

export async function GET(request:Request){
  const auth=await authorize(request);if("error" in auth)return auth.error;
  const {data,error}=await auth.admin.from("system_settings").select("*").eq("id",1).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({settings:data??DEFAULT_SETTINGS});
}

export async function PATCH(request:Request){
  const auth=await authorize(request);if("error" in auth)return auth.error;
  const body=await request.json().catch(()=>({}));
  const company=cleanText(body.company_name,120);if(!company)return NextResponse.json({error:"اسم الشركة مطلوب"},{status:400});
  const settings={id:1,company_name:company,phone:cleanText(body.phone,40),email:cleanText(body.email,160),address:cleanText(body.address,300),logo_url:cleanText(body.logo_url,500)||"/logo.png",primary_color:cleanColor(body.primary_color,"#2563eb"),secondary_color:cleanColor(body.secondary_color,"#0f172a"),updated_at:new Date().toISOString(),updated_by:auth.user.id};
  const {data,error}=await auth.admin.from("system_settings").upsert(settings,{onConflict:"id"}).select("*").single();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({settings:data,message:"تم حفظ إعدادات النظام."});
}
