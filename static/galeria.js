// ======================= Pisos Elite — Galeria Dinâmica =======================
document.addEventListener("DOMContentLoaded", iniciarGaleria);

let dadosGaleria = [];
let _videoAtivo = null; // só um vídeo tocando por vez

/* =================== Inicialização =================== */
async function iniciarGaleria() {
  const galeria = getContainer();
  if (!galeria) return;
  galeria.innerHTML = "<p class='loading'>Carregando galeria...</p>";

  try {
    const resposta = await fetch("/static/galeria.json", { cache: "no-store" });
    if (!resposta.ok) throw new Error("galeria.json não encontrado");
    const data = await resposta.json();
    if (!data.categorias) throw new Error("Formato incorreto do JSON");

    dadosGaleria = data.categorias;
    criarFiltros();
    renderGaleria("Todos");     // renderiza cards
    configurarDelegacaoClicks(); // delegação de clique (só vídeos)
    configurarPausaForaDeVista(); // pausa vídeos fora da viewport
  } catch (erro) {
    galeria.innerHTML = `<p class='erro'>Erro ao carregar galeria: ${erro.message}</p>`;
    console.error("[Galeria] Erro:", erro);
  }
}

function getContainer() {
  return document.querySelector(".galeria-feed");
}

/* =================== Filtros =================== */
function criarFiltros() {
  const filtros = document.getElementById("filtros");
  if (!filtros) return;
  filtros.innerHTML = "";

  const btnTodos = document.createElement("button");
  btnTodos.textContent = "Todos";
  btnTodos.classList.add("ativo");
  btnTodos.onclick = () => ativarFiltro("Todos", btnTodos);
  filtros.appendChild(btnTodos);

  dadosGaleria.forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat.nome;
    btn.onclick = () => ativarFiltro(cat.nome, btn);
    filtros.appendChild(btn);
  });
}

function ativarFiltro(nome, btn) {
  document.querySelectorAll("#filtros button").forEach(b => b.classList.remove("ativo"));
  if (btn) btn.classList.add("ativo");
  renderGaleria(nome);
}

/* =================== Renderização (em lotes) =================== */
function renderGaleria(filtro) {
  const galeria = getContainer();
  if (!galeria) return;
  galeria.innerHTML = "";

  // ==== 1️⃣ Monta a lista conforme o filtro ====
  let lista = [];

  if (filtro === "Todos") {
    // --- Lógica inteligente: intercala itens das categorias ---
    const grupos = {};

    // Agrupa itens por categoria
    dadosGaleria.forEach(cat => {
      grupos[cat.nome] = cat.itens.map(item => ({
        ...item,
        categoria: cat.nome
      }));
    });

    // Intercala os itens: 1 de cada categoria, depois repete
    const categorias = Object.keys(grupos);
    let index = 0;
    while (true) {
      let adicionou = false;
      for (const cat of categorias) {
        const item = grupos[cat][index];
        if (item) {
          lista.push(item);
          adicionou = true;
        }
      }
      if (!adicionou) break;
      index++;
    }
  } else {
    // --- Filtro normal (exibe apenas a categoria escolhida) ---
    lista = dadosGaleria
      .filter(cat => cat.nome === filtro)
      .flatMap(cat =>
        cat.itens.map(item => ({
          ...item,
          categoria: cat.nome
        }))
      );
  }

  // ==== 2️⃣ Se não houver itens ====
  if (!lista.length) {
    galeria.innerHTML = "<p>Nenhum item encontrado nesta categoria.</p>";
    return;
  }

  // ==== 3️⃣ Renderização progressiva por lotes (lazy render) ====
  const batchSize = 12;
  let rendered = 0;

  const renderBatch = () => {
    const fragment = document.createDocumentFragment();
    const slice = lista.slice(rendered, rendered + batchSize);

    slice.forEach(item => {
      const card = document.createElement("div");
      card.className = `galeria-item ${item.tipo}`;
      card.dataset.tipo = item.tipo;
      card.dataset.url = item.url || "";
      card.dataset.titulo = item.titulo || "";
      card.dataset.categoria = item.categoria || "";

      if (item.tipo === "video") {
        // Vídeo inline: cria <video> oculto por padrão
        card.innerHTML = `
          <div class="video-wrap">
            <img data-src="${item.thumb}" alt="${item.titulo}" class="video-thumb lazy">
            <button class="play-overlay" type="button" aria-label="Reproduzir vídeo">▶</button>
            <video preload="metadata" playsinline webkit-playsinline controls style="display:none;">
              <!-- src injetado no clique -->
            </video>
          </div>
          <div class="titulo">${item.titulo || ""}</div>
        `;
      } else {
        // Imagem normal
        card.innerHTML = `
          <img data-src="${item.thumb}" alt="${item.titulo}" class="lazy">
          <div class="titulo">${item.titulo || ""}</div>
        `;
      }

      fragment.appendChild(card);
    });

    galeria.appendChild(fragment);

    // ==== 4️⃣ Funções auxiliares (mantidas) ====
    configurarLazyLoad();
    preaquecerVideosEmViewport(galeria);
    preloadProximosVideos();
    configurarDelegacaoClicks();
    configurarPausaForaDeVista();

    rendered += slice.length;

    // Sentinel para carregar o próximo lote (scroll infinito)
    if (rendered < lista.length) {
      const sentinel = document.createElement("div");
      sentinel.style.height = "1px";
      sentinel.style.width = "100%";
      galeria.appendChild(sentinel);

      const io = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              io.disconnect();
              sentinel.remove();
              renderBatch();
            }
          });
        },
        { rootMargin: "120px" }
      );

      io.observe(sentinel);
    }
  };

  // ==== 5️⃣ Inicia a renderização ====
  renderBatch();
}

/* =================== Lazy loading de imagens =================== */
function configurarLazyLoad() {
  const lazyElements = document.querySelectorAll(".lazy[data-src]");
  if (!lazyElements.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.src = el.dataset.src;
        el.removeAttribute("data-src");
        el.classList.add("loaded");
        observer.unobserve(el);
      }
    });
  }, { rootMargin: "140px" });

  lazyElements.forEach(el => observer.observe(el));
}

/* =================== Pré-aquecimento de vídeos (metadados) =================== */
function preaquecerVideosEmViewport(rootEl = document) {
  const cards = rootEl.querySelectorAll(".galeria-item.video");
  if (!cards.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const card  = entry.target;
      const video = card.querySelector("video");
      const url   = card.dataset.url;
      const thumb = card.querySelector(".video-thumb");

      // injeta o src só uma vez (preload de metadados) e define poster
      if (video && url && !video.src) {
        video.poster = thumb?.getAttribute("src") || thumb?.dataset.src || "";
        video.preload = "metadata";
        video.src = url;
        // não chamamos play(); o browser só pega cabeçalhos
        try { video.load(); } catch(e) {}
      }

      io.unobserve(card);
    });
  }, { rootMargin: "250px" });

  cards.forEach(c => io.observe(c));
}

/* =================== Pré-carregamento seletivo (2 próximos vídeos) =================== */
function preloadProximosVideos() {
  const cards = Array.from(document.querySelectorAll(".galeria-item.video"));
  if (!cards.length) return;

  const io = new IntersectionObserver((entries) => {
    // ordena por proximidade (mais próximo do viewport primeiro)
    const visiveis = entries
      .filter(e => e.isIntersecting)
      .map(e => e.target)
      .slice(0, 2); // limita aos 2 primeiros

    visiveis.forEach(card => {
      const video = card.querySelector("video");
      const url   = card.dataset.url;
      const thumb = card.querySelector(".video-thumb");

      if (!video || video.src || !url) return;

      // define poster e pré-carrega metadados
      video.poster = thumb?.getAttribute("src") || thumb?.dataset.src || "";
      video.preload = "metadata";
      video.src = url;

      try { video.load(); } catch (e) { console.warn("Falha preload", e); }
    });
  }, { rootMargin: "300px 0px 600px 0px" }); // detecta 300px acima e 600px abaixo da viewport

  cards.forEach(card => io.observe(card));
}

/* =================== UI de loading no vídeo =================== */
function toggleLoading(card, on) {
  if (!card) return;
  const wrap = card.querySelector(".video-wrap");
  if (!wrap) return;

  if (on) {
    wrap.classList.add("loading");
    if (!wrap.querySelector(".loading-overlay")) {
      const el = document.createElement("div");
      el.className = "loading-overlay";
      el.innerHTML = `<div class="ring"></div>`;
      wrap.appendChild(el);
    }
  } else {
    wrap.classList.remove("loading");
    const el = wrap.querySelector(".loading-overlay");
    if (el) el.remove();
  }
}

/* =================== Delegação de cliques (SOMENTE VÍDEOS) =================== */
function configurarDelegacaoClicks() {
  const galeria = getContainer();
  if (!galeria || galeria._delegatedBound) return;
  galeria._delegatedBound = true;

  galeria.addEventListener("click", async (e) => {
    const card = e.target.closest(".galeria-item.video");
    if (!card) return;

    const isPlayBtn = e.target.closest(".play-overlay");
    const isThumb   = e.target.closest(".video-thumb");

    if (!isPlayBtn && !isThumb) return; // clicou em outra coisa

    const url   = card.dataset.url;
    const video = card.querySelector("video");
    const thumb = card.querySelector(".video-thumb");
    const play  = card.querySelector(".play-overlay");

    if (!url || !video) return;

    // pausa o vídeo anterior, se houver
    if (_videoAtivo && _videoAtivo !== video) {
      pararVideo(_videoAtivo);
    }

    // injeta o src apenas uma vez
    if (!video.src) {
      video.src = url;
      video.load();
    }

    // mostra vídeo e oculta thumb/botão com loading suave
    thumb.style.display = "none";
    play.style.display  = "none";
    video.style.display = "block";
    video.style.opacity = "0"; // fade-in controlado via JS/CSS
    toggleLoading(card, true);

    // aguarda o player estar pronto para tocar
    const ensureReady = () =>
      new Promise((resolve) => {
        if (video.readyState >= 2) return resolve(); // HAVE_CURRENT_DATA
        const onCanplay = () => {
          video.removeEventListener("canplay", onCanplay);
          resolve();
        };
        video.addEventListener("canplay", onCanplay, { once: true });
        // fallback de 1.5 s caso o evento demore (rede lenta)
        setTimeout(resolve, 1500);
      });

    try {
      await ensureReady();
      video.style.transition = "opacity .35s ease";
      requestAnimationFrame(() => (video.style.opacity = "1"));
      await video.play();
      ativarModoCinema(card);
      _videoAtivo = video;
    } catch (err) {
      console.warn("[Galeria] play falhou:", err);
      // se não conseguir tocar inline, abre em nova aba como último recurso
      // window.open(url, "_blank");
    } finally {
      toggleLoading(card, false);
    }

    // listeners (mantidos)
    const onPause = () => {
      if (!video.paused && !video.ended) return;
      desativarModoCinema(card);
      restaurarCard(card);
    };
    if (!video._handlersBound) {
      video._handlersBound = true;
      video.addEventListener("pause", onPause);
      video.addEventListener("ended", onPause);
    }
  });
}

/* ===================  Modo Cinema (inline, suave e responsivo) =================== */
function ativarModoCinema(card) {
  const galeria = getContainer();
  if (!galeria) return;

  galeria.classList.add("expanded-mode");
  card.classList.add("expanded");
  card.dataset.expanding = "true";

  // evita pausas acidentais
  if (_videoAtivo) _videoAtivo.closest(".galeria-item")?.classList.add("focus-video");

  // rola até o card ficar visível
  const y = card.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.15;
  window.scrollTo({ top: y, behavior: "smooth" });

  // remove a flag depois da animação
  setTimeout(() => (card.dataset.expanding = "false"), 600);
}

function desativarModoCinema(card) {
  const galeria = getContainer();
  if (!galeria) return;

  galeria.classList.remove("expanded-mode");
  card.classList.remove("expanded");
  card.classList.remove("focus-video");
  card.dataset.expanding = "false";
}

/* =================== Pausa automática fora de vista =================== */
function configurarPausaForaDeVista() {
  const galeria = getContainer();
  if (!galeria) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      const card = video.closest(".galeria-item.video");
      if (!card || !video) return;

      // não pausar se está expandindo
      if (card.dataset.expanding === "true") return;

      // se saiu da tela, pausa e restaura
      if (!entry.isIntersecting && !video.paused) {
        pararVideo(video);
        restaurarCard(card);
      }
    });
  }, { rootMargin: "0px", threshold: 0 });

  // observar cada vídeo novo
  const observarVideos = () => {
    document.querySelectorAll(".galeria-item.video video").forEach(v => {
      if (!v._observed) {
        v._observed = true;
        io.observe(v);
      }
    });
  };

  observarVideos();

  // reobserva sempre que a galeria mudar
  const mo = new MutationObserver(() => observarVideos());
  mo.observe(galeria, { childList: true, subtree: true });
}

/* =================== Helpers de vídeo =================== */
function pararVideo(video) {
  try { video.pause(); } catch(e) {}
  try { video.currentTime = 0; } catch(e) {}
  if (_videoAtivo === video) _videoAtivo = null;
}
function restaurarCard(card) {
  const thumb = card.querySelector(".video-thumb");
  const play  = card.querySelector(".play-overlay");
  const video = card.querySelector("video");
  if (video) video.style.display = "none";
  if (thumb) thumb.style.display = "block";
  if (play)  play.style.display  = "block";
}