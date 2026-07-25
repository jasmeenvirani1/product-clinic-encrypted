# MedLeads CI/CD Setup (Frontend + Backend in One Repo)

This project now has:
- CI checks for `backend` and `frontend`
- CD deploy to one Linux VPS over SSH
- Docker Compose production stack (`postgres`, `backend`, `frontend`, `nginx`)

## 1) What Was Added

- `.github/workflows/cicd.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `docker-compose.prod.yml`
- `deploy/nginx/default.conf`
- `.env.production.example`

## 2) One-Time Server Setup (Ubuntu)

Run on your server:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git

# Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and log in again (or reboot) after adding your user to docker group.

## 3) Prepare App Directory On Server

```bash
sudo mkdir -p /opt/medleads
sudo chown -R $USER:$USER /opt/medleads
cd /opt/medleads
git clone <your-repo-url> app
cd app
cp .env.production.example .env.production
```

Now edit `.env.production` with real values.

## 4) First Manual Deploy (Server)

```bash
cd /opt/medleads/app
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

## 5) GitHub Secrets Needed

In GitHub repo: `Settings -> Secrets and variables -> Actions`, add:

- `SSH_HOST` = your server public IP or hostname
- `SSH_USER` = linux username (for example `ubuntu`)
- `SSH_PORT` = usually `22` (optional, defaults to 22)
- `SSH_PRIVATE_KEY` = private key that can SSH into server
- `SERVER_APP_DIR` = absolute path to repo on server (example `/opt/medleads/app`)

## 6) How CD Works

On every push to `Master`:
1. Backend CI runs (`npm ci` + `node --check index.js`)
2. Frontend CI runs (`npm ci` + `npm run lint` + `npm run build`)
3. If both pass, deploy job SSHes to server and runs:

```bash
git pull origin Master
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker image prune -f
```

## 7) DNS + HTTPS (Recommended)

- Point your domain DNS `A` record to server IP.
- Put HTTPS in front of this stack (for example Cloudflare proxy, Caddy, or Nginx + Certbot on host).
- If you use a domain, set `NEXT_PUBLIC_API_URL` accordingly in `.env.production`.

## 8) Useful Commands (Server)

```bash
cd /opt/medleads/app
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml restart frontend
docker compose -f docker-compose.prod.yml down
```
