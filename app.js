/*
  StarBintang
  Demo mode works locally in this browser. For shared public uploads, configure Supabase
  in the SUPABASE section below and follow SETUP.md.
*/
const SUPABASE_URL = ""; // contoh: https://xxxx.supabase.co
const SUPABASE_ANON_KEY = ""; // gunakan publishable/anon key, JANGAN service_role key
const STORAGE_BUCKET = "StarB1ntang-media";
const TABLE_NAME = "memories";
const MAX_FILE_MB = 100;

const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
const client = supabaseReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const gallery = document.querySelector("#gallery");
const uploadDialog = document.querySelector("#uploadDialog");
const viewerDialog = document.querySelector("#viewerDialog");
const uploadForm = document.querySelector("#uploadForm");
const fileInput = document.querySelector("#mediaFile");
const titleInput = document.querySelector("#mediaTitle");
const dateInput = document.querySelector("#mediaDate");
const errorBox = document.querySelector("#uploadError");
const storageNotice = document.querySelector("#storageNotice");
let memories = [];
let activeFilter = "all";
let toastTimer;

document.querySelector("#year").textContent = new Date().getFullYear();
storageNotice.innerHTML = supabaseReady
  ? '<span>✓</span> Mode online aktif. Kenangan yang diunggah akan disimpan di cloud dan dapat dilihat pengunjung.'
  : '<span>ℹ</span> Mode demo: unggahan hanya tersimpan di browser ini. Hubungkan Supabase agar semua orang dapat melihat galeri dan unggahan tersimpan online.';

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}
function openUpload() { errorBox.textContent = ""; uploadForm.reset(); uploadDialog.showModal(); }
["openUploadTop","openUploadHero","emptyUpload","openUploadBanner"].forEach(id => document.getElementById(id).addEventListener("click", openUpload));
document.querySelector("#closeUpload").addEventListener("click", () => uploadDialog.close());
document.querySelector("#closeViewer").addEventListener("click", () => { closeViewerMedia(); viewerDialog.close(); });
viewerDialog.addEventListener("click", e => { if (e.target === viewerDialog) { closeViewerMedia(); viewerDialog.close(); } });

function dateLabel(value) {
  if (!value) return "Tanggal tidak dicantumkan";
  const date = new Date(value + (value.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day:"numeric", month:"short", year:"numeric" }).format(date);
}
function isVideo(item) { return item.kind === "video" || (item.mime || "").startsWith("video/"); }
function updateStats() {
  document.querySelector("#memoryCount").textContent = memories.length;
  document.querySelector("#photoCount").textContent = memories.filter(x => !isVideo(x)).length;
  document.querySelector("#videoCount").textContent = memories.filter(isVideo).length;
}
function renderGallery() {
  updateStats();
  const items = memories.filter(item => activeFilter === "all" || (activeFilter === "video" ? isVideo(item) : !isVideo(item)));
  if (!items.length) {
    gallery.innerHTML = `<div class="empty-state"><div class="empty-icon">✧</div><h3>${memories.length ? "Belum ada item di kategori ini" : "Galeri siap diisi!"}</h3><p>${memories.length ? "Pilih kategori lain atau tambahkan kenangan baru." : "Tambahkan foto atau video pertama untuk mulai menyimpan kenangan."}</p><button class="btn btn-dark" id="emptyUploadDynamic">＋ Tambah kenangan</button></div>`;
    document.querySelector("#emptyUploadDynamic").addEventListener("click", openUpload);
    return;
  }
  gallery.innerHTML = items.map(item => {
    const video = isVideo(item);
    const media = video
      ? `<video src="${escapeHTML(item.url)}" preload="metadata" muted playsinline></video>`
      : `<img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.title || "Foto kenangan")}" loading="lazy">`;
    return `<article class="memory-card">
      <div class="thumb-wrap" role="button" tabindex="0" data-open="${escapeHTML(item.id)}" aria-label="Buka ${escapeHTML(item.title || "kenangan")}">
        ${media}<span class="media-type">${video ? "▶ VIDEO" : "✦ FOTO"}</span>
      </div>
      <div class="card-info"><div><div class="card-title">${escapeHTML(item.title || (video ? "Video kenangan" : "Foto kenangan"))}</div><div class="card-date">${escapeHTML(dateLabel(item.date))}</div></div><span class="card-spacer"></span><button class="download-mini" data-download="${escapeHTML(item.id)}" aria-label="Download media" title="Download">↓</button></div>
    </article>`;
  }).join("");
  gallery.querySelectorAll("[data-open]").forEach(el => {
    const handler = () => openViewer(el.dataset.open);
    el.addEventListener("click", handler);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(); } });
  });
  gallery.querySelectorAll("[data-download]").forEach(el => el.addEventListener("click", () => downloadMemory(el.dataset.download)));
}
document.querySelectorAll(".filter").forEach(btn => btn.addEventListener("click", () => {
  activeFilter = btn.dataset.filter;
  document.querySelectorAll(".filter").forEach(x => x.classList.toggle("active", x === btn));
  renderGallery();
}));

function closeViewerMedia() { document.querySelector("#viewerMedia").innerHTML = ""; }
function openViewer(id) {
  const item = memories.find(x => String(x.id) === String(id));
  if (!item) return;
  const video = isVideo(item);
  document.querySelector("#viewerTitle").textContent = item.title || (video ? "Video kenangan" : "Foto kenangan");
  document.querySelector("#viewerDate").textContent = dateLabel(item.date);
  const media = document.querySelector("#viewerMedia");
  media.innerHTML = video
    ? `<video src="${escapeHTML(item.url)}" controls autoplay playsinline></video>`
    : `<img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.title || "Foto kenangan")}">`;
  const link = document.querySelector("#downloadButton");
  link.href = item.url;
  link.download = item.fileName || (video ? "starbintang-video" : "starbintang-foto");
  link.onclick = async e => {
    e.preventDefault();
    await downloadMemory(id);
  };
  viewerDialog.showModal();
}
async function downloadMemory(id) {
  const item = memories.find(x => String(x.id) === String(id));
  if (!item) return;
  const filename = item.fileName || ((item.title || "starbintang-kenangan").replace(/[^\w\-]+/g, "_") + (isVideo(item) ? ".mp4" : ".jpg"));
  try {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error("Tidak dapat mengambil file");
    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = objectURL; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(objectURL);
  } catch (err) {
    // Cross-origin fallback: opens the public media URL if browser blocks a direct fetch.
    const a = document.createElement("a"); a.href = item.url; a.target = "_blank"; a.rel = "noopener";
    a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    toast("Jika file tidak terunduh otomatis, buka tab media lalu simpan dari menu browser.");
  }
}

async function loadMemories() {
  if (!supabaseReady) {
    renderGallery();
    return;
  }
  const { data, error } = await client.from(TABLE_NAME).select("*").order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    toast("Gagal memuat galeri. Periksa tabel/policy Supabase.");
    renderGallery(); return;
  }
  memories = (data || []).map(row => ({
    id: row.id,
    title: row.title || "",
    date: row.memory_date || row.created_at || "",
    url: row.public_url || row.url || "",
    fileName: row.file_name || "",
    mime: row.mime_type || "",
    kind: (row.mime_type || "").startsWith("video/") ? "video" : "photo"
  })).filter(x => x.url);
  renderGallery();
}
uploadForm.addEventListener("submit", async e => {
  e.preventDefault(); errorBox.textContent = "";
  const file = fileInput.files[0];
  if (!file) { errorBox.textContent = "Pilih foto atau video terlebih dahulu."; return; }
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) { errorBox.textContent = "Format file tidak didukung."; return; }
  if (file.size > MAX_FILE_MB * 1024 * 1024) { errorBox.textContent = `Ukuran file maksimal ${MAX_FILE_MB} MB.`; return; }
  const title = titleInput.value.trim() || file.name.replace(/\.[^.]+$/, "");
  const memoryDate = dateInput.value || new Date().toISOString().slice(0,10);
  const submit = document.querySelector("#uploadSubmit");
  submit.disabled = true; submit.textContent = "Mengunggah…";
  try {
    if (supabaseReady) {
      const safeName = file.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-90);
      const path = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await client.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: publicData } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      const row = { title, memory_date: memoryDate, public_url: publicData.publicUrl, file_name: file.name, mime_type: file.type, storage_path: path };
      const { data, error } = await client.from(TABLE_NAME).insert(row).select().single();
      if (error) throw error;
      memories.unshift({ id: data.id, title, date: memoryDate, url: publicData.publicUrl, fileName: file.name, mime: file.type, kind: file.type.startsWith("video/") ? "video" : "photo" });
      toast("Kenangan berhasil diunggah dan dipublikasikan!");
    } else {
      const localUrl = URL.createObjectURL(file);
      memories.unshift({ id: crypto.randomUUID(), title, date: memoryDate, url: localUrl, fileName: file.name, mime: file.type, kind: file.type.startsWith("video/") ? "video" : "photo" });
      toast("Ditambahkan untuk demo browser ini saja. Hubungkan Supabase agar online.");
    }
    uploadDialog.close(); renderGallery();
  } catch (err) {
    console.error(err);
    errorBox.textContent = "Unggah gagal. Pastikan URL/key, bucket, tabel, dan policy Supabase sesuai SETUP.md. Detail: " + (err.message || "kesalahan tidak diketahui");
  } finally {
    submit.disabled = false; submit.innerHTML = 'Unggah kenangan <span>↗</span>';
  }
});
loadMemories();
