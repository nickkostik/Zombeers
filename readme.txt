cd /home/opc/zombieserver
npm install
npm run dev
cloudflared tunnel --config /home/opc/.cloudflared/config.yml run zombie-server-tunnel