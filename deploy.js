import { execSync } from "child_process";

const CONFIG = {
  vps: "ubuntu@51.77.146.56",
  remotePath: "/var/www/site/jeux-de-la-vie",
  serviceName: "jeux-de-la-vie",
  buildCommand: "npm run build",
};

const SSH = `ssh -o BatchMode=yes -o LogLevel=ERROR ${CONFIG.vps}`;
const SCP = `scp -o BatchMode=yes -o LogLevel=ERROR`;

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

try {
  console.log("🔨 Build en cours...");
  run(CONFIG.buildCommand);

  console.log("⏹️  Arrêt du service...");
  run(`${SSH} "sudo systemctl stop ${CONFIG.serviceName} || true"`);

  console.log("📦 Envoi sur le VPS...");
  run(`${SSH} "sudo mkdir -p ${CONFIG.remotePath} && sudo chown -R ubuntu:ubuntu ${CONFIG.remotePath}"`);
  run(`${SCP} -r ./dist ${CONFIG.vps}:${CONFIG.remotePath}/`);

  console.log("🔄 Démarrage du service...");
  run(`${SSH} "sudo systemctl start ${CONFIG.serviceName} && sudo systemctl enable ${CONFIG.serviceName}"`);

  console.log("✅ Déployé avec succès !");
} catch (err) {
  console.error("❌ Erreur lors du déploiement :", err.message);
  process.exit(1);
}
