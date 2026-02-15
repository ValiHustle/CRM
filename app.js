// =======================
// 1) CONFIG: paste your Supabase URL + anon key here
// =======================
const SUPABASE_URL = "https://hwensuljfbogccxcgflh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__Fkq1lYZdEff6rcKpfNKPw_UetiLIHr";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Enums
const LEAD_STATUSES = ["Новый","Контакт","Бриф","КП/Смета","Переговоры","Договор","Оплата","Закрыто","Потеряно"];
const PROJECT_STAGES = ["Проект","Монтаж","Репетиция","Шоу","Демонтаж","Закрыт"];

// DOM
const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const userBadge = document.getElementById("userBadge");
const logoutBtn = document.getElementById("logoutBtn");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginMsg = document.getElementById("loginMsg");
const signupMsg = document.getElementById("signupMsg");

const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalForm = document.getElementById("modalForm");
const modalMsg = document.getElementById("modalMsg");
const modalClose = document.getElementById("modalClose");
const modalCancel = document.getElementById("modalCancel");

// Tabs
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tabpane").forEach(p=>p.classList.add("hidden"));
    document.getElementById("tab-"+tab).classList.remove("hidden");
  });
});

document.getElementById("refreshAll").onclick = async ()=>{
  await Promise.all([loadDashboard(), loadLeads(), loadProjects(), loadEquipment(), loadTasks(), loadReservations()]);
};

function setMsg(el, txt=""){ el.textContent = txt; }

function showModal(title, bodyHTML, onSubmit){
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  modalMsg.textContent = "";
  modal.classList.remove("hidden");
  modalForm.onsubmit = async (e)=>{
    e.preventDefault();
    try{
      await onSubmit(new FormData(modalForm));
      closeModal();
    }catch(err){
      console.error(err);
      modalMsg.textContent = err?.message || String(err);
    }
  };
}
function closeModal(){
  modal.classList.add("hidden");
  modalBody.innerHTML = "";
  modalForm.onsubmit = null;
}
modalClose.onclick = closeModal;
modalCancel.onclick = closeModal;

function htmlEscape(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// =======================
// AUTH
// =======================
loginForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  setMsg(loginMsg,"");
  const fd = new FormData(loginForm);
  const email = fd.get("email");
  const password = fd.get("password");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if(error) return setMsg(loginMsg, error.message);
});

signupForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  setMsg(signupMsg,"");
  const fd = new FormData(signupForm);
  const email = fd.get("email");
  const password = fd.get("password");
  const { error } = await supabase.auth.signUp({ email, password });
  if(error) return setMsg(signupMsg, error.message);
  setMsg(signupMsg, "✅ Пользователь создан. Теперь можно войти.");
});

logoutBtn.addEventListener("click", async ()=>{
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange(async (_event, session)=>{
  if(session?.user){
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    userBadge.textContent = session.user.email;
    userBadge.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    await bootstrapUI();
  }else{
    authView.classList.remove("hidden");
    appView.classList.add("hidden");
    userBadge.classList.add("hidden");
    logoutBtn.classList.add("hidden");
  }
});

(async ()=>{
  const { data } = await supabase.auth.getSession();
  if(data?.session?.user){
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    userBadge.textContent = data.session.user.email;
    userBadge.classList.remove("hidden");
    logoutBtn.classList.remove("hidden");
    await bootstrapUI();
  }
})();

// =======================
// Boot
// =======================
async function bootstrapUI(){
  // fill selects
  document.getElementById("leadStatus").innerHTML =
    '<option value="">Все статусы</option>' + LEAD_STATUSES.map(s=>`<option value="${s}">${s}</option>`).join("");

  document.getElementById("projectStage").innerHTML =
    '<option value="">Все этапы</option>' + PROJECT_STAGES.map(s=>`<option value="${s}">${s}</option>`).join("");

  // bind refresh
  document.getElementById("leadRefresh").onclick = loadLeads;
  document.getElementById("projectRefresh").onclick = loadProjects;
  document.getElementById("equipmentRefresh").onclick = loadEquipment;
  document.getElementById("taskRefresh").onclick = loadTasks;
  document.getElementById("resRefresh").onclick = loadReservations;

  // bind create
  document.getElementById("leadNewBtn").onclick = ()=>leadEdit(null);
  document.getElementById("projectNewBtn").onclick = ()=>projectEdit(null);
  document.getElementById("equipmentNewBtn").onclick = ()=>equipmentEdit(null);
  document.getElementById("taskNewBtn").onclick = ()=>taskEdit(null);
  document.getElementById("reserveNewBtn").onclick = ()=>reservationCreate();

  await Promise.all([loadDashboard(), loadLeads(), loadProjects(), loadEquipment(), loadTasks(), loadReservations()]);
}

// =======================
// Dashboard
// =======================
async function loadDashboard(){
  // counts
  const [leadsC, projC, eqC, taskC] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("equipment").select("id", { count: "exact", head: true }),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("done", false),
  ]);

  // conflicts count via view
  const conflicts = await supabase.from("reservation_conflicts").select("*", { count: "exact", head: true });

  const kpis = document.getElementById("kpis");
  kpis.innerHTML = "";
  const items = [
    ["Лиды", leadsC.count ?? 0],
    ["Проекты", projC.count ?? 0],
    ["Склад позиции", eqC.count ?? 0],
    ["Задачи (открытые)", taskC.count ?? 0],
  ];
  for(const [k,v] of items){
    const div = document.createElement("div");
    div.className="kpi";
    div.innerHTML = `<div class="muted small">${htmlEscape(k)}</div><div class="v">${htmlEscape(v)}</div>`;
    kpis.appendChild(div);
  }
  const note = document.getElementById("conflictsNote");
  note.textContent = `Конфликты резерва: ${conflicts.count ?? 0} (если >0 — значит где-то не хватает количества в выбранные даты)`;
}

// =======================
// Leads
// =======================
async function loadLeads(){
  const q = document.getElementById("leadSearch").value?.trim();
  const status = document.getElementById("leadStatus").value;

  let query = supabase.from("leads").select("*").order("created_at",{ascending:false}).limit(200);
  if(status) query = query.eq("status", status);
  if(q) query = query.or(`title.ilike.%${q}%,source.ilike.%${q}%,city.ilike.%${q}%`);

  const { data, error } = await query;
  if(error) return alert(error.message);

  const tbody = document.querySelector("#leadsTable tbody");
  tbody.innerHTML = "";
  for(const r of data){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${htmlEscape(r.title)}</b></td>
      <td><span class="pill">${htmlEscape(r.status || "")}</span></td>
      <td>${htmlEscape(r.source||"—")}</td>
      <td>${htmlEscape(r.event_date||"—")}</td>
      <td>${htmlEscape(r.city||"—")}</td>
      <td class="right">
        <button class="btn btn-ghost" data-act="edit">✏️</button>
        <button class="btn btn-ghost" data-act="del">🗑</button>
      </td>
    `;
    tr.querySelector('[data-act="edit"]').onclick = ()=>leadEdit(r);
    tr.querySelector('[data-act="del"]').onclick = ()=>leadDelete(r.id);
    tbody.appendChild(tr);
  }
}

function leadEdit(row){
  const r = row || { title:"", status:"Новый", source:"", budget:"", event_date:"", city:"", venue:"", notes:"" };
  showModal(row? "Лид: редактирование" : "Лид: создать", `
    <label>Название*</label>
    <input name="title" value="${htmlEscape(r.title)}" required />
    <label>Статус</label>
    <select name="status">${LEAD_STATUSES.map(s=>`<option ${s===r.status?"selected":""} value="${s}">${s}</option>`).join("")}</select>
    <label>Источник</label>
    <input name="source" value="${htmlEscape(r.source||"")}" placeholder="Instagram / сайт / рекомендация" />
    <label>Бюджет</label>
    <input name="budget" value="${htmlEscape(r.budget||"")}" placeholder="например: 5000€" />
    <div class="grid2">
      <div>
        <label>Дата мероприятия</label>
        <input name="event_date" type="date" value="${htmlEscape(r.event_date||"")}" />
      </div>
      <div>
        <label>Город</label>
        <input name="city" value="${htmlEscape(r.city||"")}" />
      </div>
    </div>
    <label>Площадка</label>
    <input name="venue" value="${htmlEscape(r.venue||"")}" />
    <label>Заметки</label>
    <textarea name="notes" rows="4">${htmlEscape(r.notes||"")}</textarea>
  `, async (fd)=>{
    const payload = {
      title: fd.get("title").toString().trim(),
      status: fd.get("status"),
      source: fd.get("source"),
      budget: fd.get("budget"),
      event_date: fd.get("event_date") || null,
      city: fd.get("city"),
      venue: fd.get("venue"),
      notes: fd.get("notes"),
    };
    if(!payload.title) throw new Error("Название обязательно");
    if(row?.id){
      const { error } = await supabase.from("leads").update(payload).eq("id", row.id);
      if(error) throw error;
    }else{
      const { error } = await supabase.from("leads").insert(payload);
      if(error) throw error;
    }
    await loadLeads(); await loadDashboard();
  });
}

async function leadDelete(id){
  if(!confirm("Удалить лид?")) return;
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if(error) return alert(error.message);
  await loadLeads(); await loadDashboard();
}

// =======================
// Projects
// =======================
async function loadProjects(){
  const q = document.getElementById("projectSearch").value?.trim();
  const stage = document.getElementById("projectStage").value;

  let query = supabase.from("projects").select("*").order("created_at",{ascending:false}).limit(200);
  if(stage) query = query.eq("stage", stage);
  if(q) query = query.or(`title.ilike.%${q}%,client_name.ilike.%${q}%,venue.ilike.%${q}%,city.ilike.%${q}%`);

  const { data, error } = await query;
  if(error) return alert(error.message);

  const tbody = document.querySelector("#projectsTable tbody");
  tbody.innerHTML = "";
  for(const r of data){
    const period = (r.start_date || r.end_date) ? `${r.start_date||"—"} → ${r.end_date||"—"}` : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${htmlEscape(r.title)}</b><div class="muted small">${htmlEscape(r.client_name||"—")}</div></td>
      <td><span class="pill">${htmlEscape(r.stage||"")}</span></td>
      <td>${htmlEscape(period)}</td>
      <td>${htmlEscape(r.city||"—")}</td>
      <td>${htmlEscape(r.venue||"—")}</td>
      <td class="right">
        <button class="btn btn-ghost" data-act="edit">✏️</button>
        <button class="btn btn-ghost" data-act="del">🗑</button>
      </td>
    `;
    tr.querySelector('[data-act="edit"]').onclick = ()=>projectEdit(r);
    tr.querySelector('[data-act="del"]').onclick = ()=>projectDelete(r.id);
    tbody.appendChild(tr);
  }
}

function projectEdit(row){
  const r = row || { title:"", stage:"Проект", client_name:"", start_date:"", end_date:"", city:"", venue:"", expected_budget:"", notes:"" };
  showModal(row? "Проект: редактирование" : "Проект: создать", `
    <label>Название*</label>
    <input name="title" value="${htmlEscape(r.title)}" required />
    <label>Этап</label>
    <select name="stage">${PROJECT_STAGES.map(s=>`<option ${s===r.stage?"selected":""} value="${s}">${s}</option>`).join("")}</select>
    <label>Клиент</label>
    <input name="client_name" value="${htmlEscape(r.client_name||"")}" placeholder="Компания / контакт" />
    <div class="grid2">
      <div>
        <label>Дата начала</label>
        <input name="start_date" type="date" value="${htmlEscape(r.start_date||"")}" />
      </div>
      <div>
        <label>Дата конца</label>
        <input name="end_date" type="date" value="${htmlEscape(r.end_date||"")}" />
      </div>
    </div>
    <div class="grid2">
      <div>
        <label>Бюджет (ожид.)</label>
        <input name="expected_budget" value="${htmlEscape(r.expected_budget||"")}" placeholder="например: 12000€" />
      </div>
      <div>
        <label>Город</label>
        <input name="city" value="${htmlEscape(r.city||"")}" />
      </div>
    </div>
    <label>Площадка</label>
    <input name="venue" value="${htmlEscape(r.venue||"")}" />
    <label>Заметки</label>
    <textarea name="notes" rows="4">${htmlEscape(r.notes||"")}</textarea>
    <div class="muted small">Период нужен для резерва оборудования по датам.</div>
  `, async (fd)=>{
    const payload = {
      title: fd.get("title").toString().trim(),
      stage: fd.get("stage"),
      client_name: fd.get("client_name"),
      start_date: fd.get("start_date") || null,
      end_date: fd.get("end_date") || null,
      expected_budget: fd.get("expected_budget"),
      city: fd.get("city"),
      venue: fd.get("venue"),
      notes: fd.get("notes"),
    };
    if(!payload.title) throw new Error("Название обязательно");
    if(payload.start_date && payload.end_date && payload.end_date < payload.start_date){
      throw new Error("Дата конца не может быть раньше даты начала");
    }

    if(row?.id){
      const { error } = await supabase.from("projects").update(payload).eq("id", row.id);
      if(error) throw error;
    }else{
      const { error } = await supabase.from("projects").insert(payload);
      if(error) throw error;
    }
    await loadProjects(); await loadDashboard();
  });
}

async function projectDelete(id){
  if(!confirm("Удалить проект? (удалятся и резервы/задачи)")) return;
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if(error) return alert(error.message);
  await loadProjects(); await loadReservations(); await loadTasks(); await loadDashboard();
}

// =======================
// Equipment
// =======================
async function loadEquipment(){
  const q = document.getElementById("equipmentSearch").value?.trim();
  let query = supabase.from("equipment").select("*").order("created_at",{ascending:false}).limit(300);
  if(q) query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%`);

  const { data, error } = await query;
  if(error) return alert(error.message);

  const tbody = document.querySelector("#equipmentTable tbody");
  tbody.innerHTML = "";
  for(const r of data){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${htmlEscape(r.name)}</b></td>
      <td>${htmlEscape(r.category||"—")}</td>
      <td>${htmlEscape(r.qty_total ?? 0)}</td>
      <td class="right">
        <button class="btn btn-ghost" data-act="edit">✏️</button>
        <button class="btn btn-ghost" data-act="del">🗑</button>
      </td>
    `;
    tr.querySelector('[data-act="edit"]').onclick = ()=>equipmentEdit(r);
    tr.querySelector('[data-act="del"]').onclick = ()=>equipmentDelete(r.id);
    tbody.appendChild(tr);
  }
}

function equipmentEdit(row){
  const r = row || { name:"", category:"", qty_total:0, notes:"" };
  showModal(row? "Склад: редактирование" : "Склад: добавить", `
    <label>Название*</label>
    <input name="name" value="${htmlEscape(r.name)}" required />
    <label>Категория</label>
    <input name="category" value="${htmlEscape(r.category||"")}" placeholder="Свет / Звук / LED / Фермы" />
    <label>Количество всего</label>
    <input name="qty_total" type="number" min="0" step="0.5" value="${htmlEscape(r.qty_total ?? 0)}" />
    <label>Заметки</label>
    <textarea name="notes" rows="4">${htmlEscape(r.notes||"")}</textarea>
  `, async (fd)=>{
    const payload = {
      name: fd.get("name").toString().trim(),
      category: fd.get("category"),
      qty_total: Number(fd.get("qty_total") || 0),
      notes: fd.get("notes"),
    };
    if(!payload.name) throw new Error("Название обязательно");

    if(row?.id){
      const { error } = await supabase.from("equipment").update(payload).eq("id", row.id);
      if(error) throw error;
    }else{
      const { error } = await supabase.from("equipment").insert(payload);
      if(error) throw error;
    }
    await loadEquipment(); await loadDashboard();
  });
}

async function equipmentDelete(id){
  if(!confirm("Удалить позицию склада? (если есть резервы — удаление может не пройти)")) return;
  const { error } = await supabase.from("equipment").delete().eq("id", id);
  if(error) return alert(error.message);
  await loadEquipment(); await loadDashboard();
}

// =======================
// Tasks (linked to projects)
// =======================
async function loadTasks(){
  const doneVal = document.getElementById("taskDone").value; // "0","1",""
  let query = supabase.from("tasks_view").select("*").order("due_date",{ascending:true}).limit(300);
  if(doneVal !== "") query = query.eq("done", doneVal === "1");
  const { data, error } = await query;
  if(error) return alert(error.message);

  const tbody = document.querySelector("#tasksTable tbody");
  tbody.innerHTML = "";
  for(const r of data){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${htmlEscape(r.title)}</b><div class="muted small">${htmlEscape(r.notes||"")}</div></td>
      <td>${htmlEscape(r.due_date||"—")}</td>
      <td>${htmlEscape(r.project_title||"—")}</td>
      <td>${r.done ? '<span class="pill">done</span>' : '<span class="pill">todo</span>'}</td>
      <td class="right">
        <button class="btn btn-ghost" data-act="toggle">${r.done ? "↩️" : "✅"}</button>
        <button class="btn btn-ghost" data-act="edit">✏️</button>
        <button class="btn btn-ghost" data-act="del">🗑</button>
      </td>
    `;
    tr.querySelector('[data-act="toggle"]').onclick = ()=>taskToggle(r);
    tr.querySelector('[data-act="edit"]').onclick = ()=>taskEdit(r);
    tr.querySelector('[data-act="del"]').onclick = ()=>taskDelete(r.id);
    tbody.appendChild(tr);
  }
}

async function taskToggle(row){
  const { error } = await supabase.from("tasks").update({ done: !row.done }).eq("id", row.id);
  if(error) return alert(error.message);
  await loadTasks(); await loadDashboard();
}

async function taskEdit(row){
  const projects = await supabase.from("projects").select("id,title").order("created_at",{ascending:false}).limit(200);
  const opts = (projects.data||[]).map(p=>`<option value="${p.id}" ${row?.project_id===p.id?"selected":""}>${htmlEscape(p.title)}</option>`).join("");

  const r = row || { title:"", due_date:"", project_id:"", notes:"", done:false };
  showModal(row? "Задача: редактирование" : "Задача: создать", `
    <label>Задача*</label>
    <input name="title" value="${htmlEscape(r.title)}" required />
    <div class="grid2">
      <div>
        <label>Срок</label>
        <input name="due_date" type="date" value="${htmlEscape(r.due_date||"")}" />
      </div>
      <div>
        <label>Проект</label>
        <select name="project_id">
          <option value="">—</option>
          ${opts}
        </select>
      </div>
    </div>
    <label>Комментарий</label>
    <textarea name="notes" rows="4">${htmlEscape(r.notes||"")}</textarea>
    <label>Статус</label>
    <select name="done">
      <option value="0" ${!r.done?"selected":""}>todo</option>
      <option value="1" ${r.done?"selected":""}>done</option>
    </select>
  `, async (fd)=>{
    const payload = {
      title: fd.get("title").toString().trim(),
      due_date: fd.get("due_date") || null,
      project_id: fd.get("project_id") || null,
      notes: fd.get("notes"),
      done: fd.get("done")==="1",
    };
    if(!payload.title) throw new Error("Название обязательно");

    if(row?.id){
      const { error } = await supabase.from("tasks").update(payload).eq("id", row.id);
      if(error) throw error;
    }else{
      const { error } = await supabase.from("tasks").insert(payload);
      if(error) throw error;
    }
    await loadTasks(); await loadDashboard();
  });
}

async function taskDelete(id){
  if(!confirm("Удалить задачу?")) return;
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if(error) return alert(error.message);
  await loadTasks(); await loadDashboard();
}

// =======================
// Reservations (date-based)
// =======================
async function loadReservations(){
  const q = document.getElementById("resSearch").value?.trim();
  const from = document.getElementById("resFrom").value || null;
  const to = document.getElementById("resTo").value || null;

  let query = supabase.from("reservations_view").select("*").order("start_date",{ascending:false}).limit(300);
  if(from) query = query.gte("end_date", from); // overlap filter
  if(to) query = query.lte("start_date", to);
  if(q) query = query.or(`project_title.ilike.%${q}%,equipment_name.ilike.%${q}%`);

  const { data, error } = await query;
  if(error) return alert(error.message);

  const tbody = document.querySelector("#resTable tbody");
  tbody.innerHTML = "";
  for(const r of data){
    const period = `${r.start_date||"—"} → ${r.end_date||"—"}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${htmlEscape(r.project_title||"—")}</b></td>
      <td>${htmlEscape(r.equipment_name||"—")}</td>
      <td>${htmlEscape(r.qty||0)}</td>
      <td>${htmlEscape(period)}</td>
      <td class="right">
        <button class="btn btn-ghost" data-act="del">🗑</button>
      </td>
    `;
    tr.querySelector('[data-act="del"]').onclick = ()=>reservationDelete(r.id);
    tbody.appendChild(tr);
  }
}

async function reservationCreate(){
  const [projects, equipment] = await Promise.all([
    supabase.from("projects").select("id,title,start_date,end_date").order("created_at",{ascending:false}).limit(200),
    supabase.from("equipment").select("id,name,qty_total").order("name",{ascending:true}).limit(400),
  ]);
  const pOpts = (projects.data||[]).map(p=>`<option value="${p.id}">${htmlEscape(p.title)}</option>`).join("");
  const eOpts = (equipment.data||[]).map(e=>`<option value="${e.id}">${htmlEscape(e.name)} (всего ${e.qty_total})</option>`).join("");

  showModal("Новый резерв", `
    <label>Проект*</label>
    <select name="project_id" required>
      <option value="">—</option>
      ${pOpts}
    </select>

    <label>Оборудование*</label>
    <select name="equipment_id" required>
      <option value="">—</option>
      ${eOpts}
    </select>

    <div class="grid2">
      <div>
        <label>Начало*</label>
        <input name="start_date" type="date" required />
      </div>
      <div>
        <label>Конец*</label>
        <input name="end_date" type="date" required />
      </div>
    </div>

    <label>Количество*</label>
    <input name="qty" type="number" min="0.5" step="0.5" value="1" required />

    <div class="muted small">Проверка доступности делается в базе (RPC <span class="mono">create_reservation</span>). Если не хватает — вернёт ошибку.</div>
  `, async (fd)=>{
    const payload = {
      p_project_id: Number(fd.get("project_id")),
      p_equipment_id: Number(fd.get("equipment_id")),
      p_start: fd.get("start_date"),
      p_end: fd.get("end_date"),
      p_qty: Number(fd.get("qty")),
    };
    if(!payload.p_project_id || !payload.p_equipment_id) throw new Error("Проект и оборудование обязательны");
    if(payload.p_end < payload.p_start) throw new Error("Дата конца не может быть раньше начала");

    const { data, error } = await supabase.rpc("create_reservation", payload);
    if(error) throw error;
    await loadReservations(); await loadDashboard();
  });
}

async function reservationDelete(id){
  if(!confirm("Удалить резерв?")) return;
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if(error) return alert(error.message);
  await loadReservations(); await loadDashboard();
}
