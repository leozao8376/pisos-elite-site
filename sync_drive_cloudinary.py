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
    """Lista vídeos da pasta do Drive, com links diretos de download"""
    url = f"https://www.googleapis.com/drive/v3/files?q='{DRIVE_FOLDER_ID}'+in+parents&fields=files(id,name,mimeType,webContentLink)&key={GOOGLE_API_KEY}"
    res = requests.get(url)
    data = res.json()
    videos = []
    for f in data.get("files", []):
        if f["mimeType"].startswith("video/"):
            link = f"https://drive.google.com/uc?export=download&id={f['id']}"
            videos.append({
                "id": f["id"],
                "name": f["name"].rsplit(".", 1)[0],
                "link": link
            })
    print(f"🔍 {len(videos)} vídeos encontrados no Drive.")
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
    print(f"⬆️ Enviando: {nome}")

    upload_url = f"https://api.cloudinary.com/v1_1/{CLOUD_NAME}/video/upload"
    data = {
        "file": link,
        "public_id": nome,
        "upload_preset": "ml_default"
    }

    res = requests.post(upload_url, data=data, auth=(API_KEY, API_SECRET))

    if res.status_code == 200:
        url = res.json()["secure_url"]
        print(f"✅ Enviado com sucesso: {url}")
        return url
    else:
        print(f"❌ Erro ao enviar {nome}: {res.text}")
        return None


def sincronizar():
    drive_videos = listar_videos_drive()
    atual = carregar_json()
    novos = {}

    for video in drive_videos:
        nome = video["name"]
        if nome not in atual:
            url = enviar_para_cloudinary(video)
            if url:
                novos[nome] = url
        else:
            novos[nome] = atual[nome]

    salvar_json(novos)
    print(f"✅ Sincronização concluída ({len(novos)} vídeos).")


if __name__ == "__main__":
    print("=== SINCRONIZANDO DRIVE → CLOUDINARY ===")
    sincronizar()
    print(f"🕒 Finalizado em {datetime.datetime.now().isoformat()}")
