"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Client = { id:number; name:string; project_name:string; status:string; progress:number };
type Stage = { id:number; stage_order:number; stage_name:string; status:"pending"|"current"|"completed"; progress:number };
type Notice = { id:number; title:string; message:string; is_read:boolean; created_at:string };

export default function ClientPortalPage(){
 const {id}=useParams<{id:string}>(); const router=useRouter(); const clientId=Number(id);
 const [client,setClient]=useState<Client|null>(null); const [stages,setStages]=useState<Stage[]>([]); const [notices,setNotices]=useState<Notice[]>([]);
 const [loading,setLoading]=useState(true); const [open,setOpen]=useState(false); const [error,setError]=useState("");
 useEffect(()=>{ const saved=sessionStorage.getItem("azdan_client_id"); if(!saved||Number(saved)!==clientId){router.replace("/client-login");return;}
  (async()=>{const [c,s,n]=await Promise.all([
   supabase.from("clients").select("id,name,project_name,status,progress").eq("id",clientId).single(),
   supabase.from("project_stages").select("id,stage_order,stage_name,status,progress").eq("client_id",clientId).order("stage_order"),
   supabase.from("project_notifications").select("id,title,message,is_read,created_at").eq("client_id",clientId).order("created_at",{ascending:false}).limit(20)
  ]); if(c.error){setError(c.error.message)} else setClient(c.data); if(!s.error)setStages(s.data??[]); if(!n.error)setNotices(n.data??[]); setLoading(false);})();
 },[clientId,router]);
 const unread=notices.filter(n=>!n.is_read).length;
 async function markAll(){await supabase.from("project_notifications").update({is_read:true,read_at:new Date().toISOString()}).eq("client_id",clientId).eq("is_read",false);setNotices(v=>v.map(n=>({...n,is_read:true})));}
 if(loading)return <main dir="rtl" className="min-h-screen grid place-items-center bg-slate-100"><p className="font-bold">جاري تحميل بوابة المشروع...</p></main>;
 if(!client)return <main dir="rtl" className="min-h-screen grid place-items-center bg-slate-100"><p className="text-red-600">تعذر تحميل المشروع: {error}</p></main>;
 return <main dir="rtl" className="min-h-screen bg-[#f4f6f8] text-[#10253b] pb-12">
  <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
   <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
    <div><p className="font-black">أزدان للمقاولات العامة</p><p className="text-xs text-slate-500">بوابة متابعة المشروع</p></div>
    <div className="relative flex gap-2">
     <button onClick={()=>setOpen(v=>!v)} className="relative h-11 w-11 rounded-2xl border bg-white">🔔{unread>0&&<span className="absolute -top-1 -left-1 bg-red-600 text-white rounded-full text-[10px] min-w-5 h-5 grid place-items-center">{unread}</span>}</button>
     <button onClick={()=>{sessionStorage.removeItem("azdan_client_id");router.replace("/client-login")}} className="rounded-2xl border px-3 text-sm font-bold">خروج</button>
     {open&&<div className="absolute top-14 left-0 w-[min(90vw,360px)] max-h-96 overflow-auto rounded-2xl border bg-white shadow-2xl p-3">
      <div className="flex justify-between mb-2"><b>الإشعارات</b>{unread>0&&<button onClick={markAll} className="text-xs text-blue-700">تحديد الكل كمقروء</button>}</div>
      {notices.length===0?<p className="text-sm text-slate-500 p-3">لا توجد إشعارات</p>:notices.map(n=><div key={n.id} className={`p-3 rounded-xl mb-2 ${n.is_read?'bg-slate-50':'bg-amber-50'}`}><p className="font-bold text-sm">{n.title}</p><p className="text-xs text-slate-600 mt-1">{n.message}</p></div>)}
     </div>}
    </div>
   </div>
  </header>
  <div className="mx-auto max-w-6xl px-4 py-6">
   <section className="rounded-[2rem] bg-[#0b2239] text-white p-6 sm:p-8 shadow-xl">
    <p className="text-[#d8b56a] font-bold">أهلًا بك، {client.name}</p><h1 className="text-3xl font-black mt-2">{client.project_name}</h1>
    <div className="mt-5 flex items-center gap-3"><div className="flex-1 h-3 rounded-full bg-white/15 overflow-hidden"><div className="h-full bg-[#d8b56a]" style={{width:`${Math.max(0,Math.min(100,client.progress||0))}%`}}/></div><b className="text-[#d8b56a]">{client.progress||0}%</b></div>
   </section>
   <section className="mt-7 rounded-[2rem] bg-white border p-5 sm:p-7 shadow-lg">
    <div className="flex justify-between items-end gap-3"><div><p className="text-xs font-black text-[#b48b3c]">مسار التنفيذ</p><h2 className="text-2xl font-black mt-1">مراحل العمل</h2><p className="text-sm text-slate-500 mt-1">اضغط على أي مرحلة لعرض التفاصيل والصور الخاصة بها</p></div></div>
    {stages.length===0?<p className="mt-6 rounded-2xl bg-slate-50 p-5 text-slate-500">لم تتم إضافة مراحل المشروع بعد.</p>:
    <div className="mt-6 overflow-x-auto pb-3"><div className="flex min-w-max items-start">
     {stages.map((s,i)=><div key={s.id} className="flex items-center">
      <button onClick={()=>router.push(`/client-portal/${clientId}/stages/${s.id}`)} className="w-40 group text-center">
       <div className={`mx-auto h-14 w-14 rounded-full grid place-items-center border-4 font-black ${s.status==='completed'?'bg-emerald-600 border-emerald-100 text-white':s.status==='current'?'bg-[#d8b56a] border-amber-100 text-[#0b2239]':'bg-slate-200 border-slate-100 text-slate-500'}`}>{s.status==='completed'?'✓':s.stage_order}</div>
       <p className="mt-3 font-black text-sm group-hover:text-[#b48b3c]">{s.stage_name}</p><p className="text-xs text-slate-500 mt-1">{s.progress||0}%</p>
      </button>{i<stages.length-1&&<div className={`h-1 w-12 -mt-10 ${s.status==='completed'?'bg-emerald-500':'bg-slate-200'}`}/>} </div>)}
    </div></div>}
   </section>
   <section className="mt-6 grid gap-4 sm:grid-cols-2">
    <button onClick={()=>router.push(`/client-portal/${clientId}/finance`)} className="text-right rounded-[2rem] bg-white border p-6 shadow-lg hover:-translate-y-1 transition"><span className="text-3xl">💰</span><h3 className="text-xl font-black mt-3">الحساب المالي</h3><p className="text-sm text-slate-500 mt-2">عرض قيمة العقد والمبالغ المدفوعة والمتبقية وسجل الدفعات.</p></button>
    <button onClick={()=>router.push(`/client-portal/${clientId}/documents`)} className="text-right rounded-[2rem] bg-white border p-6 shadow-lg hover:-translate-y-1 transition"><span className="text-3xl">📄</span><h3 className="text-xl font-black mt-3">مستندات المشروع</h3><p className="text-sm text-slate-500 mt-2">عرض العقود والمخططات والتقارير وجميع مستندات المشروع.</p></button>
   </section>
  </div>
 </main>
}
