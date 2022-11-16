const fetch = require('node-fetch');
const fs = require('fs');

const downloadFile = (async (url, path) => {
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(path);
  await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on("error", reject);
      fileStream.on("finish", resolve);
  });
  fs.chmodSync(path, fs.constants.S_IRWXU);
});

const downloadKaotoBackendNativeExecutable = (backendVersion, platform) => {
	downloadFile(`https://github.com/KaotoIO/kaoto-backend/releases/download/${backendVersion}/kaoto-${platform}`, `./binaries/kaoto-${platform}`);
}

const backendVersion = "v0.4.0";
downloadKaotoBackendNativeExecutable(backendVersion, 'linux-amd64');
downloadKaotoBackendNativeExecutable(backendVersion, 'macos-amd64');
