import requests, json, os, datetime

# === CONFIGURAÇÕES ===
CLOUD_NAME = "seu_cloud_name_aqui"
API_KEY = "sua_api_key_aqui"
API_SECRET = "seu_api_secret_aqui"

# ID da pasta "Vídeos" no seu Drive
DRIVE_FOLDER_ID = "1-ojnnUVDm83ZujgQ6dc6jbU2kt927V5x"
GOOGLE_API_KEY = "AIzaSyC17AFArmOqDC7kkbTrYHRutSjuOd5nWsk"

# Arquivo JSON gerado
JSON_FILE = "cloudinary_videos.json"

def listar_videos_drive():
    url = f"https://www.googleapis.com/drive/v3/files?q='{DRIVE_FOLDER_ID}'+in+parents&fields=files(id,name,mimeType)&key={GOOGLE_API_KEY}"
    res = requests.get(url)
    data = res.json()
    return [f for f in data.get("files", []) if f["mimeType"].startswith("video/")]

def carregar_json():
    if os.path.exists(JSON_FILE):
        with open(JSON_FILE, "r") as f:
            return json.load(f)
    return {}

def salvar_json(data):
    with open(JSON_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def enviar_para_cloudinary(video_id, nome):
    print(f"⬆️ Enviando {nome}...")
    link_drive = f"https://drive.google.com/uc?id={video_id}&export=download"
    upload_url = f"https://api.cloudinary.com/v1_1/{CLOUD_NAME}/video/upload"
    data = {"file": link_drive, "upload_preset": "ml_default", "public_id": nome}
    res = requests.post(upload_url, data=data, auth=(API_KEY, API_SECRET))
    if res.status_code == 200:
        return res.json()["secure_url"]
    else:
        print("❌ Erro Cloudinary:", res.text)
        return None

def deletar_do_cloudinary(nome):
    print(f"🗑️ Removendo {nome} do Cloudinary...")
    delete_url = f"https://api.cloudinary.com/v1_1/{CLOUD_NAME}/resources/video/upload/{nome}"
    requests.delete(delete_url, auth=(API_KEY, API_SECRET))

def sincronizar():
    drive_videos = listar_videos_drive()
    atual = carregar_json()

    novos = {}
    drive_nomes = [v["name"].rsplit(".", 1)[0] for v in drive_videos]

    # Adicionar ou atualizar
    for v in drive_videos:
        nome = v["name"].rsplit(".", 1)[0]
        if nome not in atual:
            url = enviar_para_cloudinary(v["id"], nome)
            if url:
                novos[nome] = url
        else:
            novos[nome] = atual[nome]

    # Remover os que não existem mais no Drive
    for antigo in list(atual.keys()):
        if antigo not in drive_nomes:
            deletar_do_cloudinary(antigo)

    # Atualizar JSON
    salvar_json(novos)
    print(f"✅ Sincronização concluída ({len(novos)} vídeos).")

if __name__ == "__main__":
    print("=== SINCRONIZANDO DRIVE → CLOUDINARY ===")
    sincronizar()
    print(f"🕒 Atualizado em {datetime.datetime.now().isoformat()}")
