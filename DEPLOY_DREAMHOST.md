# Deploy TWill to DreamHost VPS

## Deployment Information

**Server:** vps18270.dreamhostps.com  
**User:** dh_ahsqxk  
**Directory:** twill1400.com  
**Site URL:** https://twill1400.com (once deployed)

---

## Option 1: Automated Deployment Script

### 1. Create SSH Key for Passwordless Login (Recommended)

```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy SSH key to server
ssh-copy-id dh_ahsqxk@vps18270.dreamhostps.com
```

### 2. Build and Deploy

```bash
cd /Users/brandonsmith/Desktop/twill

# Build frontend
npm run build

# Build backend
cd backend && npm run build && cd ..

# Create deployment package
tar -czf twill-deploy.tar.gz \
  dist/ \
  backend/dist/ \
  backend/package.json \
  backend/.env.example \
  package.json \
  index.html

# Upload to server
scp twill-deploy.tar.gz dh_ahsqxk@vps18270.dreamhostps.com:~/

# SSH into server and extract
ssh dh_ahsqxk@vps18270.dreamhostps.com << 'ENDSSH'
cd ~/twill1400.com
tar -xzf ../twill-deploy.tar.gz
cd backend
npm install --production
pm2 start dist/server.js --name twill-backend
pm2 save
exit
ENDSSH
```

---

## Option 2: Manual Deployment

### 1. Build Locally

```bash
cd /Users/brandonsmith/Desktop/twill

# Build frontend
npm run build

# Build backend  
cd backend
npm run build
cd ..
```

### 2. Connect to Server

```bash
ssh dh_ahsqxk@vps18270.dreamhostps.com
```

### 3. On the Server

```bash
cd ~/twill1400.com

# If directory doesn't exist, create it
mkdir -p ~/twill1400.com
cd ~/twill1400.com
```

### 4. Upload Files (From Your Local Machine)

```bash
# Upload frontend build
scp -r dist/ dh_ahsqxk@vps18270.dreamhostps.com:~/twill1400.com/

# Upload backend
scp -r backend/dist/ dh_ahsqxk@vps18270.dreamhostps.com:~/twill1400.com/backend/
scp backend/package.json dh_ahsqxk@vps18270.dreamhostps.com:~/twill1400.com/backend/
scp backend/.env dh_ahsqxk@vps18270.dreamhostps.com:~/twill1400.com/backend/

# Upload other necessary files
scp index.html dh_ahsqxk@vps18270.dreamhostps.com:~/twill1400.com/
scp -r public/ dh_ahsqxk@vps18270.dreamhostps.com:~/twill1400.com/
```

### 5. Setup on Server

```bash
ssh dh_ahsqxk@vps18270.dreamhostps.com

cd ~/twill1400.com/backend
npm install --production

# Install PM2 for process management
npm install -g pm2

# Install system dependencies
sudo apt-get update
sudo apt-get install -y ffmpeg python3-pip
pip3 install --user yt-dlp

# Start backend with PM2
pm2 start dist/server.js --name twill-backend
pm2 startup
pm2 save
```

---

## Option 3: Git Clone Method (Recommended)

### 1. Push to GitHub First

```bash
cd /Users/brandonsmith/Desktop/twill
git add .
git commit -m "Production ready"
git push origin main
```

### 2. Clone on Server

```bash
ssh dh_ahsqxk@vps18270.dreamhostps.com

cd ~/twill1400.com
git clone https://github.com/bsmitty909/twill1400.git .

# Install frontend dependencies and build
npm install
npm run build

# Install backend dependencies and build
cd backend
npm install
npm run build

# Copy and configure .env
cp .env.example .env
# Edit .env with your credentials
nano .env

# Install system dependencies
sudo apt-get install -y ffmpeg
pip3 install --user yt-dlp

# Start backend
pm2 start dist/server.js --name twill-backend
pm2 startup
pm2 save
```

---

## Configure Web Server (Nginx/Apache)

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name twill1400.com www.twill1400.com;

    # Frontend
    location / {
        root /home/dh_ahsqxk/twill1400.com/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Environment Variables on Server

Create `backend/.env` with:

```env
PORT=3001
B2_KEY_ID=005b47fe07ba9f70000000002
B2_APPLICATION_KEY=K005WQkI0Pfr2U3SpIYKZrfNmmIFAwY
B2_BUCKET_NAME=ytvideostwill
B2_ENDPOINT=s3.us-east-005.dream.io
B2_REGION=us-east-005
NODE_ENV=production
```

---

## Verify Deployment

```bash
# Check backend is running
pm2 status

# Check backend logs
pm2 logs twill-backend

# Test backend
curl http://localhost:3001/api/health

# Test from web
curl https://twill1400.com/api/health
```

---

## Update/Redeploy

```bash
cd ~/twill1400.com
git pull origin main
npm install
npm run build
cd backend
npm install
npm run build
pm2 restart twill-backend
```

---

Choose the method that works best for you! Git clone is recommended for easy updates.
