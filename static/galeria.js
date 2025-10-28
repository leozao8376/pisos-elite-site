const API_KEY = "AIzaSyC17AFArmOqDC7kkbTrYHRutSjuOd5nWsk";
const PASTAS = {
  "Piso Polido": "1-UM6kfGLymj1FPFKUtogRVBy6b9rEMIf",
  "Camurçado": "1-dINacHKz0MfkqcFn69znJ5rXi8XYVNe",
  "Vassourado": "14KZUG00xKAeu1vRv6Qsc3QphzCtM4iZ5",
  "Finalização": "1-gmpVRmAME7-0Cm1GEuJ4n5RAGqDr5Dv",
  "Depoimentos": "1Hc3o1RxZumw3HZHmAXcRXdVpb5L0rVar",
  "Vídeos": "1-ojnnUVDm83ZujgQ6dc6jbU2kt927V5x"
};

const galeria = document.getElementById("galeria-pisos");
const filtros = document.getElementById("filtros");
let arquivos = [];
let cacheArquivos = {}; // cache simples por categoria

async function carregarGaleria() {
  galeria.innerHTML = "<p class='loading'>Carregando galeria...</p>";
  arquivos = [];

  for (const [categoria, id] of Object.entries(PASTAS)) {
    // evita refazer requisição se já estiver no cache
    if (cacheArquivos[categoria]) {
      arquivos.push(...cacheArquivos[categoria]);
      continue;
    }

    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${id}'+in+parents&key=${API_KEY}&fields=files(id,name,mimeType)&pageSize=100`
      );
      const data = await res.json();
      if (data.files) {
        const lista = data.files.map(file => {
          const nomeOriginal = file.name;
          const nomeFormatado = formatarNome(nomeOriginal);
          const tipo = file.mimeType.startsWith("video/") ? "video" : "imagem";
          const thumb =
            tipo === "video"
              ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w800`
              : `https://lh3.googleusercontent.com/d/${file.id}=w800`;

          return {
            id: file.id,
            nome: nomeFormatado,
            tipo,
            categoria,
            thumb
          };
        });
        cacheArquivos[categoria] = lista; // salva no cache
        arquivos.push(...lista);
      }
    } catch (err) {
      console.error("Erro ao carregar pasta:", err);
    }
  }

  criarFiltros();
  renderGaleria("todos");
}

function formatarNome(nome) {
  return nome.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim();
}

function criarFiltros() {
  filtros.innerHTML = `<button class="ativo" data-filtro="todos">Todos</button>`;
  Object.keys(PASTAS).forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.dataset.filtro = cat;
    btn.onclick = () => {
      document.querySelectorAll(".galeria-filtros button").forEach(b =>
        b.classList.remove("ativo")
      );
      btn.classList.add("ativo");
      renderGaleria(cat);
    };
    filtros.appendChild(btn);
  });
}

function renderGaleria(filtro) {
  const lista =
    filtro === "todos"
      ? arquivos
      : arquivos.filter(a => a.categoria === filtro);

  galeria.innerHTML =
    lista
      .map(a => {
        if (a.tipo === "video") {
          // thumbnail de vídeo com play (lazy iframe)
          return `
          <div class="galeria-item video" data-tipo="video" data-id="${a.id}" data-nome="${a.nome}" data-cat="${a.categoria}">
            <img src="${a.thumb}" alt="${a.nome}" loading="lazy" class="video-thumb">
            <div class="play-overlay">▶</div>
            <div class="titulo">${a.nome}</div>
          </div>`;
        } else {
          // imagem normal
          return `
          <div class="galeria-item imagem" data-tipo="imagem" data-id="${a.id}" data-nome="${a.nome}" data-cat="${a.categoria}">
            <img src="${a.thumb}" alt="${a.nome}" loading="lazy">
            <div class="titulo">${a.nome}</div>
          </div>`;
        }
      })
      .join("") || "<p>Nenhum arquivo encontrado.</p>";

  configurarLightbox();
  configurarVideosLazy();
}

/* ==========================
   Lazy loading seguro p/ vídeos
   ========================== */
function configurarVideosLazy() {
  const videos = document.querySelectorAll(".galeria-item.video");

  videos.forEach(item => {
    const id = item.dataset.id;
    item.addEventListener("click", () => {
      abrirVideoNoLightbox(id, item.dataset.nome, item.dataset.cat);
    });
  });
}

/* ==========================
   Lightbox otimizado
   ========================== */
function configurarLightbox() {
  const imagens = document.querySelectorAll(".galeria-item.imagem");
  let lightbox = document.querySelector(".lightbox");

  if (!lightbox) {
    lightbox = document.createElement("div");
    lightbox.classList.add("lightbox");
    lightbox.innerHTML = `
      <div class="lightbox-inner">
        <span class="lightbox-close">&times;</span>
        <div class="lightbox-content"></div>
      </div>
    `;
    document.body.appendChild(lightbox);
  }

  const content = lightbox.querySelector(".lightbox-content");
  const close = lightbox.querySelector(".lightbox-close");
  let startY = 0;
  let isDragging = false;

  imagens.forEach(item => {
    item.onclick = () => {
      const { id, nome, cat } = item.dataset;
      lightbox.classList.add("active");

      const titulo = `<p class="titulo-lightbox">${cat} — ${nome}</p>`;
      const midia = `<img src="https://lh3.googleusercontent.com/d/${id}=w1600" alt="${nome}" class="img-fullscreen">`;
      content.innerHTML = titulo + midia;

      const lightboxInner = lightbox.querySelector(".lightbox-inner");
      lightboxInner.addEventListener("touchstart", e => {
        startY = e.touches[0].clientY;
        isDragging = true;
      });
      lightboxInner.addEventListener("touchmove", e => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 80) fecharLightbox();
      });
      lightboxInner.addEventListener("touchend", () => (isDragging = false));
    };
  });

  close.onclick = () => fecharLightbox();
  lightbox.onclick = e => {
    if (e.target === lightbox) fecharLightbox();
  };
}

/* ==========================
   Lightbox dedicado p/ vídeos
   ========================== */
function abrirVideoNoLightbox(id, nome, cat) {
  let lightbox = document.querySelector(".lightbox");
  const content = lightbox.querySelector(".lightbox-content");
  if (!lightbox.classList.contains("active")) lightbox.classList.add("active");

  const titulo = `<p class="titulo-lightbox">${cat} — ${nome}</p>`;
  const iframe = `
    <div class="video-wrapper">
      <iframe 
        src="https://drive.google.com/file/d/${id}/preview" 
        frameborder="0" 
        allow="autoplay; fullscreen" 
        allowfullscreen 
        loading="lazy">
      </iframe>
    </div>`;

  content.innerHTML = titulo + iframe;
}

function fecharLightbox() {
  const lightbox = document.querySelector(".lightbox");
  if (!lightbox) return;
  const iframe = lightbox.querySelector("iframe");
  if (iframe) iframe.src = ""; // pausa o vídeo
  lightbox.classList.remove("active");
}

carregarGaleria();