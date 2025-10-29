import requests, json, os, datetime

# === CONFIGURAÇÕES ===
CLOUD_NAME = os.getenv("CLOUD_NAME")
API_KEY = os.getenv("API_KEY")
API_SECRET = os.getenv("API_SECRET")

# ID da pasta "Vídeos" no seu Drive
DRIVE_FOLDER_ID = "1-ojnnUVDm83ZujgQ6dc6jbU2kt927V5x"
GOOGLE_API_KEY = "AIzaSyC17AFArmOqDC7kkbTrYHRutSjuOd5nWsk"

# Arquivo JSON gerado
JSON_FILE = "cloudinary_videos.json"


def listar_videos_drive():
    """Lista vídeos da pasta do Drive, com links diretos"""
    print("🔍 Buscando vídeos no Google Drive...")
    url = f"https://www.googleapis.com/drive/v3/files?q='{DRIVE_FOLDER_ID}'+in+parents&fields=files(id,name,mimeType)&key={GOOGLE_API_KEY}"
    res = requests.get(url)
    data = res.json()
    videos = []

    if "files" not in data:
        print("⚠️ Nenhum arquivo retornado. Resposta da API:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return []

    for f in data["files"]:
        if f["mimeType"].startswith("video/"):
            video_info = {
                "id": f["id"],
                "name": f["name"].rsplit(".", 1)[0],
                "link": f"https://drive.google.com/uc?export=download&id={f['id']}"
            }
            videos.append(video_info)

    print(f"📂 {len(videos)} vídeos encontrados.")
    for v in videos:
        print(f"  - {v['name']} ({v['link']})")

    return videos


def carregar_json():
    if os.path.exists(JSON_FILE):
        with open(JSON_FILE, "r") as f:
            return json.load(f)
    return {}


def salvar_json(data):
    with open(JSON_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def enviar_para_cloudinary(video):
    """Envia o vídeo para o Cloudinary"""
    nome = video["name"]
    link = video["link"]
    print(f"⬆️ Enviando: {nome} ...")

    upload_url = f"https://api.cloudinary.com/v1_1/{CLOUD_NAME}/video/upload"
    data = {
        "file": link,
        "public_id": nome,
        "upload_preset": "ml_default"
    }

    res = requests.post(upload_url, data=data, auth=(API_KEY, API_SECRET))

    if res.status_code == 200:
        url = res.json().get("secure_url")
        print(f"✅ Enviado com sucesso: {url}")
        return url
    else:
        print(f"❌ Erro ao enviar {nome} (HTTP {res.status_code})")
        try:
            print(res.json())
        except:
            print(res.text)
        return None


def sincronizar():
    drive_videos = listar_videos_drive()
    if not drive_videos:
        print("⚠️ Nenhum vídeo encontrado no Drive. Encerrando sincronização.")
        return

    atual = carregar_json()
    novos = {}
    enviados = []

    for video in drive_videos:
        nome = video["name"]
        if nome not in atual:
            url = enviar_para_cloudinary(video)
            if url:
                novos[nome] = url
                enviados.append(nome)
        else:
            novos[nome] = atual[nome]

    salvar_json(novos)
    print(f"✅ Sincronização concluída ({len(novos)} vídeos no total).")

    if enviados:
        print("🎥 Vídeos enviados nesta execução:")
        for nome in enviados:
            print(f"   - {nome}")
    else:
        print("ℹ️ Nenhum vídeo novo foi enviado (todos já estavam sincronizados).")


if __name__ == "__main__":
    print("=== SINCRONIZANDO DRIVE → CLOUDINARY ===")
    sincronizar()
    print(f"🕒 Finalizado em {datetime.datetime.now().isoformat()}")
